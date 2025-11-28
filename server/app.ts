import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";
import { initializeDatabaseSequences } from "./db";
import { fetchAndParsePlans, isSMEDataConfigured } from "./smedata";
import { sendErrorReportToAdmin } from "./email-service";

// VTU auto-sync configuration
const AUTO_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let autoSyncTimer: NodeJS.Timeout | null = null;

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const app = express();

// Trust proxy for proper HTTPS detection behind load balancers
app.set('trust proxy', 1);

// Security middleware - HTTPS redirect and security headers
app.use((req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Skip security redirect for WebSocket upgrades and internal health checks
  const isWebSocketUpgrade = req.headers.upgrade?.toLowerCase() === 'websocket';
  const isHealthCheck = req.path === '/health' || req.path === '/healthz';
  
  // HTTPS redirect in production - only if explicitly coming from HTTP
  // Platforms like Render/Replit terminate TLS at the edge and forward HTTP
  // We only redirect if x-forwarded-proto explicitly says 'http', not when it's undefined
  const forwardedProto = req.headers['x-forwarded-proto'];
  if (isProduction && !isWebSocketUpgrade && !isHealthCheck && forwardedProto === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (relaxed for development)
  if (isProduction) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: https:; frame-ancestors 'self';"
    );
  }
  
  // Strict Transport Security (HSTS) - only in production over HTTPS
  if (isProduction && (req.secure || forwardedProto === 'https')) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  
  next();
});

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Auto-sync VTU plans from SME Data API
async function autoSyncVtuPlans() {
  if (!isSMEDataConfigured()) {
    log("VTU auto-sync skipped: SME Data API not configured", "vtu-sync");
    return;
  }

  try {
    log("Starting VTU plans auto-sync...", "vtu-sync");
    const result = await fetchAndParsePlans();
    
    if (!result.success) {
      log(`VTU auto-sync failed: ${result.message}`, "vtu-sync");
      return;
    }

    log(`VTU auto-sync: fetched ${result.plans.length} plans from SME Data API`, "vtu-sync");
    
    // Import storage dynamically to avoid circular dependencies
    const { storage } = await import("./storage");
    let created = 0, updated = 0;
    
    for (const plan of result.plans) {
      try {
        const existing = await storage.getVtuPlanByNetworkAndDataAmount(plan.network, plan.dataAmount);
        await storage.upsertVtuPlan({
          network: plan.network as any,
          planName: plan.planName,
          dataAmount: plan.dataAmount,
          validity: plan.validity,
          costPrice: plan.costPrice,
          sellingPrice: plan.sellingPrice,
          planCode: plan.planCode,
          isActive: true,
          sortOrder: plan.sortOrder,
        });
        if (existing) updated++; else created++;
      } catch (err: any) {
        log(`VTU auto-sync: failed to sync plan ${plan.planName}: ${err.message}`, "vtu-sync");
      }
    }
    
    log(`VTU auto-sync completed: ${created} created, ${updated} updated`, "vtu-sync");
  } catch (error: any) {
    log(`VTU auto-sync error: ${error.message}`, "vtu-sync");
    sendErrorReportToAdmin("VTU Auto-Sync Failed", error.message, { stack: error.stack }).catch(console.error);
  }
}

// Schedule periodic VTU plan sync
function scheduleVtuSync() {
  // Initial sync after 30 seconds (give server time to fully start)
  setTimeout(() => {
    autoSyncVtuPlans();
  }, 30000);
  
  // Schedule recurring sync every 24 hours
  autoSyncTimer = setInterval(() => {
    autoSyncVtuPlans();
  }, AUTO_SYNC_INTERVAL_MS);
  
  log(`VTU auto-sync scheduled (every ${AUTO_SYNC_INTERVAL_MS / 1000 / 60 / 60} hours)`, "vtu-sync");
}

export default async function runApp(
  setup: (app: Express, server: Server) => Promise<void>,
) {
  // Initialize database sequences on startup
  await initializeDatabaseSequences();
  
  const server = await registerRoutes(app);

  // Centralized error handling middleware
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Log full error details server-side
    const errorDetails = {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      timestamp: new Date().toISOString(),
    };
    console.error("[Error Handler]", JSON.stringify(errorDetails, null, 2));
    
    // Determine user-friendly message
    let userMessage = "An unexpected error occurred. Please try again later.";
    
    if (err.userMessage) {
      userMessage = err.userMessage;
    } else if (status === 400) {
      userMessage = err.message || "Invalid request. Please check your input.";
    } else if (status === 401) {
      userMessage = "Please log in to continue.";
    } else if (status === 403) {
      userMessage = "You don't have permission to perform this action.";
    } else if (status === 404) {
      userMessage = "The requested resource was not found.";
    } else if (status === 429) {
      userMessage = "Too many requests. Please wait a moment and try again.";
    } else if (status >= 500 && !isProduction) {
      // In development, show actual error message
      userMessage = err.message || "Internal server error.";
    }
    
    // Send error report to admin for 500 errors
    if (status >= 500) {
      sendErrorReportToAdmin(
        `Server Error [${status}]`,
        err.message || "Unknown error",
        {
          path: req.path,
          method: req.method,
          stack: err.stack,
          userId: (req as any).user?.id,
        }
      ).catch(console.error);
    }

    res.status(status).json({ 
      message: userMessage,
      code: err.code || (status >= 500 ? "INTERNAL_ERROR" : "ERROR"),
      ...(err.isRetryable !== undefined && { isRetryable: err.isRetryable }),
    });
  });

  // importantly run the final setup after setting up all the other routes so
  // the catch-all route doesn't interfere with the other routes
  await setup(app, server);

  // Schedule VTU auto-sync
  scheduleVtuSync();

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
}
