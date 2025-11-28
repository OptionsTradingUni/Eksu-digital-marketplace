import { type Server } from "node:http";

import express, {
  type Express,
  type Request,
  Response,
  NextFunction,
} from "express";

import { registerRoutes } from "./routes";
import { initializeDatabaseSequences } from "./db";
import { isSMEDataConfigured } from "./smedata";
import { sendErrorReportToAdmin } from "./email-service";

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

// Initialize default VTU plans if none exist (admin can modify prices)
async function initializeDefaultVtuPlans() {
  try {
    const { storage } = await import("./storage");
    const existingPlans = await storage.getVtuPlans();
    
    if (existingPlans.length > 0) {
      log(`VTU plans already exist (${existingPlans.length} plans), skipping initialization`, "vtu-init");
      return;
    }
    
    log("Initializing default VTU plans...", "vtu-init");
    
    // Default plans based on SMEDATA.NG pricing (admin can update via admin panel)
    // The dataAmount field MUST match what SMEDATA API expects: "500MB", "1GB", "2GB", etc.
    const defaultPlans = [
      // MTN SME Plans
      { network: "mtn_sme", planName: "MTN 500MB - 30 Days", dataAmount: "500MB", validity: "30 days", costPrice: "140.00", sellingPrice: "150.00", planCode: "mtn_500mb", sortOrder: 1 },
      { network: "mtn_sme", planName: "MTN 1GB - 30 Days", dataAmount: "1GB", validity: "30 days", costPrice: "245.00", sellingPrice: "260.00", planCode: "mtn_1gb", sortOrder: 2 },
      { network: "mtn_sme", planName: "MTN 2GB - 30 Days", dataAmount: "2GB", validity: "30 days", costPrice: "490.00", sellingPrice: "520.00", planCode: "mtn_2gb", sortOrder: 3 },
      { network: "mtn_sme", planName: "MTN 3GB - 30 Days", dataAmount: "3GB", validity: "30 days", costPrice: "735.00", sellingPrice: "780.00", planCode: "mtn_3gb", sortOrder: 4 },
      { network: "mtn_sme", planName: "MTN 5GB - 30 Days", dataAmount: "5GB", validity: "30 days", costPrice: "1225.00", sellingPrice: "1300.00", planCode: "mtn_5gb", sortOrder: 5 },
      { network: "mtn_sme", planName: "MTN 10GB - 30 Days", dataAmount: "10GB", validity: "30 days", costPrice: "2450.00", sellingPrice: "2600.00", planCode: "mtn_10gb", sortOrder: 6 },
      
      // GLO CG Plans
      { network: "glo_cg", planName: "GLO 500MB - 30 Days", dataAmount: "500MB", validity: "30 days", costPrice: "135.00", sellingPrice: "145.00", planCode: "glo_500mb", sortOrder: 10 },
      { network: "glo_cg", planName: "GLO 1GB - 30 Days", dataAmount: "1GB", validity: "30 days", costPrice: "240.00", sellingPrice: "255.00", planCode: "glo_1gb", sortOrder: 11 },
      { network: "glo_cg", planName: "GLO 2GB - 30 Days", dataAmount: "2GB", validity: "30 days", costPrice: "480.00", sellingPrice: "510.00", planCode: "glo_2gb", sortOrder: 12 },
      { network: "glo_cg", planName: "GLO 3GB - 30 Days", dataAmount: "3GB", validity: "30 days", costPrice: "720.00", sellingPrice: "765.00", planCode: "glo_3gb", sortOrder: 13 },
      { network: "glo_cg", planName: "GLO 5GB - 30 Days", dataAmount: "5GB", validity: "30 days", costPrice: "1200.00", sellingPrice: "1275.00", planCode: "glo_5gb", sortOrder: 14 },
      { network: "glo_cg", planName: "GLO 10GB - 30 Days", dataAmount: "10GB", validity: "30 days", costPrice: "2400.00", sellingPrice: "2550.00", planCode: "glo_10gb", sortOrder: 15 },
      
      // Airtel CG Plans
      { network: "airtel_cg", planName: "Airtel 500MB - 30 Days", dataAmount: "500MB", validity: "30 days", costPrice: "140.00", sellingPrice: "150.00", planCode: "airtel_500mb", sortOrder: 20 },
      { network: "airtel_cg", planName: "Airtel 1GB - 30 Days", dataAmount: "1GB", validity: "30 days", costPrice: "250.00", sellingPrice: "265.00", planCode: "airtel_1gb", sortOrder: 21 },
      { network: "airtel_cg", planName: "Airtel 2GB - 30 Days", dataAmount: "2GB", validity: "30 days", costPrice: "500.00", sellingPrice: "530.00", planCode: "airtel_2gb", sortOrder: 22 },
      { network: "airtel_cg", planName: "Airtel 3GB - 30 Days", dataAmount: "3GB", validity: "30 days", costPrice: "750.00", sellingPrice: "795.00", planCode: "airtel_3gb", sortOrder: 23 },
      { network: "airtel_cg", planName: "Airtel 5GB - 30 Days", dataAmount: "5GB", validity: "30 days", costPrice: "1250.00", sellingPrice: "1325.00", planCode: "airtel_5gb", sortOrder: 24 },
      { network: "airtel_cg", planName: "Airtel 10GB - 30 Days", dataAmount: "10GB", validity: "30 days", costPrice: "2500.00", sellingPrice: "2650.00", planCode: "airtel_10gb", sortOrder: 25 },
      
      // 9mobile Plans
      { network: "9mobile", planName: "9mobile 500MB - 30 Days", dataAmount: "500MB", validity: "30 days", costPrice: "130.00", sellingPrice: "140.00", planCode: "9mobile_500mb", sortOrder: 30 },
      { network: "9mobile", planName: "9mobile 1GB - 30 Days", dataAmount: "1GB", validity: "30 days", costPrice: "230.00", sellingPrice: "245.00", planCode: "9mobile_1gb", sortOrder: 31 },
      { network: "9mobile", planName: "9mobile 2GB - 30 Days", dataAmount: "2GB", validity: "30 days", costPrice: "460.00", sellingPrice: "490.00", planCode: "9mobile_2gb", sortOrder: 32 },
      { network: "9mobile", planName: "9mobile 3GB - 30 Days", dataAmount: "3GB", validity: "30 days", costPrice: "690.00", sellingPrice: "735.00", planCode: "9mobile_3gb", sortOrder: 33 },
      { network: "9mobile", planName: "9mobile 5GB - 30 Days", dataAmount: "5GB", validity: "30 days", costPrice: "1150.00", sellingPrice: "1225.00", planCode: "9mobile_5gb", sortOrder: 34 },
      { network: "9mobile", planName: "9mobile 10GB - 30 Days", dataAmount: "10GB", validity: "30 days", costPrice: "2300.00", sellingPrice: "2450.00", planCode: "9mobile_10gb", sortOrder: 35 },
    ];
    
    let created = 0;
    for (const plan of defaultPlans) {
      try {
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
        created++;
      } catch (err: any) {
        log(`Failed to create VTU plan ${plan.planName}: ${err.message}`, "vtu-init");
      }
    }
    
    log(`VTU initialization complete: ${created} default plans created`, "vtu-init");
    log("Admin can update prices via Admin Panel > VTU Management", "vtu-init");
  } catch (error: any) {
    log(`VTU initialization error: ${error.message}`, "vtu-init");
  }
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

  // Initialize default VTU plans if none exist
  initializeDefaultVtuPlans();

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
