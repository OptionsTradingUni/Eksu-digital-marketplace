import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth as setupPassportAuth, isAuthenticated } from "./auth";
import passport from "passport";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { uploadToObjectStorage, uploadMultipleToObjectStorage, uploadVideoToStorage, isCloudinaryConfigured } from "./object-storage";
import { z } from "zod";
import Groq from "groq-sdk";
import { 
  insertProductSchema, 
  insertMessageSchema, 
  insertReviewSchema, 
  insertReportSchema, 
  insertWatchlistSchema,
  roleUpdateSchema,
  createReferralSchema,
  createSavedSearchSchema,
  saveDraftSchema,
  createScheduledPostSchema,
  createBoostSchema,
  createDisputeSchema,
  createSupportTicketSchema,
  createGameSchema,
  completeGameSchema,
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
  initiateSquadPaymentSchema,
  insertNegotiationSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  purchaseVtuSchema,
  purchaseAirtimeSchema,
  createBeneficiarySchema,
  updateUserSettingsSchema,
  requestAccountDeletionSchema,
  initiateKycSchema,
  reviewKycSchema,
  createScheduledPurchaseApiSchema,
  createGiftDataApiSchema,
  createStorySchema,
  createSecretMessageLinkSchema,
  sendSecretMessageSchema,
  purchaseExamPinSchema,
  payBillSchema,
  validateCustomerSchema,
  createResellerSiteSchema,
  updateResellerSiteSchema,
  createResellerWithdrawalSchema,
  updateResellerWithdrawalSchema,
  type Order,
} from "../shared/schema";
import { getChatbotResponse, getChatbotResponseWithHandoff, checkForPaymentScam, detectHandoffNeed, type ChatMessage, type ChatbotResponse } from "./chatbot";
import { squad, generatePaymentReference, generateTransferReference, isSquadConfigured, getSquadConfigStatus, getTestCardInfo, SquadApiError, SquadErrorType } from "./squad";
import { calculatePricingFromSellerPrice, calculateSquadFee, getCommissionRate, getSecurityDepositAmount, isWithdrawalAllowed } from "./pricing";
import { 
  purchaseData, purchaseAirtime, isInlomaxConfigured, isValidNigerianPhone, 
  checkTransactionStatus, getAllDataPlans, getDataPlanById, getDataPlansByNetwork, 
  detectNetwork, getDiscountInfo, NETWORK_INFO, getAllCablePlans, getCablePlanById,
  getCablePlansByProvider, validateSmartCard, subscribeCableTV, validateMeterNumber,
  payElectricityBill, purchaseExamPin, getExamPins, getDiscos, CABLE_PROVIDER_INFO,
  type NetworkType, type DataPlan, type CablePlan
} from "./inlomax";
import { 
  sendEmailVerificationCode, 
  sendErrorReportToAdmin, 
  sendMessageNotification, 
  sendOrderMessageNotification,
  sendMessageReplyNotification,
  sendOrderEmail,
  sendWelcomeEmail,
  sendNewFollowerEmail,
  sendNewPostFromFollowingEmail,
  sendNewProductFromFollowingEmail,
  sendTestEmail,
  sendNewTicketNotificationToAdmin,
  sendTicketReplyNotification
} from "./email-service";

// Module-level WebSocket connections map for broadcasting notifications
// Changed from Map<string, WebSocket> to Map<string, Set<WebSocket>> to support multiple connections per user
// This fixes the issue where NotificationBell and Messages page connections were overwriting each other
const wsConnections = new Map<string, Set<WebSocket>>();

// Helper function to add a WebSocket connection for a user
function addWsConnection(userId: string, ws: WebSocket) {
  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set());
  }
  wsConnections.get(userId)!.add(ws);
}

// Helper function to remove a WebSocket connection for a user
function removeWsConnection(userId: string, ws: WebSocket) {
  const connections = wsConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      wsConnections.delete(userId);
    }
  }
}

// Helper function to broadcast a notification to all of a user's WebSocket connections
async function broadcastNotification(userId: string, notification: any) {
  const connections = wsConnections.get(userId);
  if (connections) {
    const message = JSON.stringify({
      type: "new_notification",
      notification,
    });
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Helper function to broadcast any message to all of a user's WebSocket connections
function broadcastToUser(userId: string, data: any) {
  const connections = wsConnections.get(userId);
  if (connections) {
    const message = JSON.stringify(data);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Helper function to get all online user IDs
function getOnlineUserIds(): string[] {
  return Array.from(wsConnections.keys());
}

// Helper function to check if a specific user is online
function isUserOnline(userId: string): boolean {
  return wsConnections.has(userId);
}

// Game room WebSocket connections map: roomCode -> Set of user WebSocket connections
const gameRoomConnections = new Map<string, Map<string, WebSocket>>();

// Add a WebSocket connection to a game room
function addGameRoomConnection(roomCode: string, userId: string, ws: WebSocket) {
  if (!gameRoomConnections.has(roomCode)) {
    gameRoomConnections.set(roomCode, new Map());
  }
  gameRoomConnections.get(roomCode)!.set(userId, ws);
}

// Remove a WebSocket connection from a game room
function removeGameRoomConnection(roomCode: string, userId: string) {
  const room = gameRoomConnections.get(roomCode);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      gameRoomConnections.delete(roomCode);
    }
  }
}

// Broadcast message to all players in a game room
function broadcastToGameRoom(roomCode: string, data: any, excludeUserId?: string) {
  const room = gameRoomConnections.get(roomCode);
  if (room) {
    const message = JSON.stringify(data);
    room.forEach((ws, odID) => {
      if (odID !== excludeUserId && ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
}

// Get count of connected players in a game room
function getGameRoomPlayerCount(roomCode: string): number {
  const room = gameRoomConnections.get(roomCode);
  return room ? room.size : 0;
}

// Helper function to broadcast user online/offline status to all connected users
function broadcastUserStatusChange(userId: string, isOnline: boolean) {
  const statusMessage = JSON.stringify({
    type: "user_status_change",
    userId,
    isOnline,
  });
  
  // Broadcast to all connected users
  wsConnections.forEach((connections, connectedUserId) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(statusMessage);
      }
    });
  });
}

// Helper function to create and broadcast a notification
async function createAndBroadcastNotification(data: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  relatedUserId?: string;
  relatedProductId?: string;
}) {
  try {
    const notification = await storage.createNotification(data);
    await broadcastNotification(data.userId, notification);
    return notification;
  } catch (error) {
    console.error("Error creating/broadcasting notification:", error);
    return null;
  }
}

// Setup multer for image uploads - use memory storage for object storage
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Memory storage for object storage uploads (images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Memory storage for media uploads (images and videos)
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for videos
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

// Disk storage fallback for local development
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

// Helper to get user ID from session (Passport.js)
function getUserId(req: any): string | null {
  return req.user?.id || null;
}

// Helper functions for Admin/Support role checks via environment variables
function isSuperAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const adminIds = process.env.SUPER_ADMIN_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(userId);
}

function isSupportRep(userId: string | null): boolean {
  if (!userId) return false;
  const supportIds = process.env.SUPPORT_IDS?.split(',').map(id => id.trim()) || [];
  return supportIds.includes(userId);
}

function hasAdminAccess(userId: string | null): boolean {
  return isSuperAdmin(userId);
}

function hasSupportAccess(userId: string | null): boolean {
  return isSuperAdmin(userId) || isSupportRep(userId);
}

// Combined admin check - checks both database role AND environment variable
async function isAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  
  // Check environment variable first (faster)
  if (isSuperAdmin(userId)) return true;
  
  // Fall back to database role check
  const user = await storage.getUser(userId);
  return user?.role === "admin";
}

// Email verification enforcement configuration
const MAX_LISTINGS_UNVERIFIED = 3; // Unverified users can only create 3 listings

// Middleware to check if user has verified their email
// Returns null if verified, error message if not
async function checkEmailVerified(userId: string): Promise<{ verified: boolean; message?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { verified: false, message: "User not found" };
  }
  
  // System accounts are always considered verified
  const systemUserId = process.env.SYSTEM_USER_ID || process.env.SYSTEM_WELCOME_USER_ID;
  if (userId === systemUserId) {
    return { verified: true };
  }
  
  // Admins are always considered verified
  if (user.role === "admin" || isSuperAdmin(userId)) {
    return { verified: true };
  }
  
  if (!user.emailVerified) {
    return { 
      verified: false, 
      message: "Please verify your email to use this feature. Check your inbox for the verification link."
    };
  }
  
  return { verified: true };
}

// Middleware to enforce email verification for critical actions
// SECURITY: Fail-closed - blocks on any error (never allows unverified access)
function requireEmailVerified(req: any, res: any, next: any) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  checkEmailVerified(userId).then(result => {
    if (!result.verified) {
      return res.status(403).json({ 
        message: result.message,
        code: "EMAIL_NOT_VERIFIED",
        action: "verify_email"
      });
    }
    next();
  }).catch(err => {
    console.error("Email verification check error:", err);
    // SECURITY: Fail closed - block access on any error
    return res.status(500).json({ 
      message: "Unable to verify email status. Please try again.",
      code: "VERIFICATION_ERROR"
    });
  });
}

// Synchronous admin check middleware (uses cached check, then DB fallback)
function requireAdmin(req: any, res: any, next: any) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // First check super admin (fast, synchronous)
  if (isSuperAdmin(userId)) {
    return next();
  }
  
  // Fall back to database check
  isAdminUser(userId).then(isAdmin => {
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  }).catch(err => {
    console.error("Admin check error:", err);
    return res.status(500).json({ message: "Unable to verify admin status" });
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Passport.js authentication (email/password) for Render deployment
  await setupPassportAuth(app);

  // Serve uploaded images from disk (legacy)
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  app.use("/uploads", express.static(uploadDir));

  // Legacy storage route - redirect to proper URLs
  // With Cloudinary, images are served directly from Cloudinary URLs
  // This route handles any legacy /storage/ URLs by returning 404
  app.get("/storage/:objectName(*)", async (req, res) => {
    res.status(404).json({ 
      message: "Legacy storage URL - image may have been uploaded before Cloudinary migration" 
    });
  });
  
  // API route to check storage configuration status
  app.get("/api/storage/status", (req, res) => {
    res.json({ 
      cloudinaryConfigured: isCloudinaryConfigured(),
      message: isCloudinaryConfigured() 
        ? "Cloudinary is configured for persistent image storage" 
        : "Using disk storage (images may not persist after restart)"
    });
  });

  // Comprehensive API status endpoint for all services
  app.get("/api/status", (req, res) => {
    const squadStatus = getSquadConfigStatus();
    const inlomaxConfigured = isInlomaxConfigured();
    const cloudinaryReady = isCloudinaryConfigured();
    
    res.json({
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        squad: {
          configured: squadStatus.configured,
          mode: squadStatus.mode, // 'sandbox', 'live', or 'unknown'
          features: {
            payments: squadStatus.configured,
            transfers: squadStatus.configured ? 'requires_activation' : false,
            bankLookup: squadStatus.configured
          },
          note: squadStatus.mode === 'sandbox' ? 'Using sandbox/test environment' : undefined
        },
        vtu: {
          configured: inlomaxConfigured,
          provider: 'inlomax',
          features: {
            data: inlomaxConfigured,
            airtime: inlomaxConfigured,
            cableTV: inlomaxConfigured,
            electricity: inlomaxConfigured,
            examPins: inlomaxConfigured
          },
          note: inlomaxConfigured ? undefined : 'API key not configured'
        },
        storage: {
          configured: cloudinaryReady,
          provider: cloudinaryReady ? 'cloudinary' : 'disk',
          persistent: cloudinaryReady
        },
        email: {
          configured: !!process.env.RESEND_API_KEY,
          provider: 'resend'
        },
        database: {
          configured: !!process.env.DATABASE_URL,
          provider: 'postgresql'
        }
      },
      wallet: {
        minWithdrawal: 500,
        commissionRate: getCommissionRate(),
        securityDeposit: getSecurityDepositAmount()
      }
    });
  });

  // Health check endpoint (simple)
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString() 
    });
  });

  // Squad test cards endpoint (for sandbox testing)
  app.get("/api/squad/test-cards", (req, res) => {
    const testInfo = getTestCardInfo();
    
    if (!testInfo.isSandbox) {
      return res.json({
        isSandbox: false,
        message: "Test cards are only available in sandbox mode. Current mode is production.",
        testCards: [],
        instructions: []
      });
    }
    
    res.json(testInfo);
  });

  // ==================== NEW AUTH ROUTES (Passport.js Local) ====================
  
  // Simple in-memory rate limiting for username checks
  const usernameCheckRateLimits = new Map<string, { count: number; resetTime: number }>();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute
  
  // Check username availability endpoint with rate limiting
  app.get("/api/auth/check-username/:username", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      const now = Date.now();
      
      // Rate limiting check
      const rateLimit = usernameCheckRateLimits.get(clientIp);
      if (rateLimit) {
        if (now < rateLimit.resetTime) {
          if (rateLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
            return res.status(429).json({ 
              message: "Too many requests. Please try again later.",
              available: false
            });
          }
          rateLimit.count++;
        } else {
          usernameCheckRateLimits.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        }
      } else {
        usernameCheckRateLimits.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }
      
      const { username } = req.params;
      
      // Validate username format
      if (!username || username.length < 3) {
        return res.status(400).json({ 
          available: false, 
          message: "Username must be at least 3 characters" 
        });
      }
      
      if (username.length > 30) {
        return res.status(400).json({ 
          available: false, 
          message: "Username must be at most 30 characters" 
        });
      }
      
      // Only allow alphanumeric and underscore
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ 
          available: false, 
          message: "Username can only contain letters, numbers, and underscores" 
        });
      }
      
      // Check if username is taken (case-insensitive)
      const existingUser = await storage.getUserByUsername(username.toLowerCase());
      
      if (existingUser) {
        return res.json({ 
          available: false, 
          message: "Username is already taken" 
        });
      }
      
      return res.json({ 
        available: true, 
        message: "Username is available" 
      });
    } catch (error: any) {
      console.error("Error checking username:", error);
      return res.status(500).json({ 
        available: false, 
        message: "Error checking username availability" 
      });
    }
  });
  
  // Registration route
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Validate request body with Zod schema
      const validationResult = registerSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.flatten();
        console.log("Registration validation failed:", errors);
        return res.status(400).json({ 
          message: "Validation failed",
          errors: errors.fieldErrors
        });
      }

      const { email, password, firstName, lastName, username, phoneNumber, role, referralCode } = validationResult.data;

      // Check if user already exists by email
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Check if username is already taken
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(400).json({ message: "Username is already taken" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user - only pass phoneNumber if it's not empty
      const userData: { 
        email: string; 
        password: string; 
        firstName: string; 
        lastName: string;
        username: string; 
        phoneNumber?: string; 
        role: "buyer" | "seller" | "both" 
      } = {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username, // Already lowercase from schema transform
        role: role || "buyer",
      };
      
      // Only include phoneNumber if it's a non-empty string
      if (phoneNumber && phoneNumber.trim().length > 0) {
        userData.phoneNumber = phoneNumber.trim();
      }

      console.log("Creating user with data:", { ...userData, password: "[HIDDEN]" });

      const user = await storage.createUser(userData);

      // Handle referral code if provided
      if (referralCode && referralCode.trim().length > 0) {
        try {
          const trimmedCode = referralCode.trim().toUpperCase();
          // Look up the referrer by their unique referral code
          const referrer = await storage.getUserByReferralCode(trimmedCode);
          
          if (referrer && referrer.id !== user.id) {
            // Create the referral record
            await storage.createReferral(referrer.id, user.id);
            console.log(`Referral created: ${referrer.email} referred ${user.email}`);
          } else if (!referrer) {
            console.log(`Invalid referral code: ${trimmedCode} (user not found)`);
          }
        } catch (referralError: any) {
          // Log but don't fail registration if referral creation fails
          console.error("Error processing referral code:", referralError.message);
        }
      }

      // Auto-follow system user and send welcome DM
      const systemUserId = process.env.SYSTEM_USER_ID;
      if (systemUserId) {
        try {
          // Check if system user exists
          const systemUser = await storage.getUser(systemUserId);
          if (systemUser) {
            // Create follow relationship (new user follows system user)
            await storage.followUser(user.id, systemUserId);
            console.log(`New user ${user.email} now follows system user @${systemUser.firstName || 'EKSUMarketplace'}`);
            
            // Send welcome DM from system user
            const welcomeMessage = `Welcome to EKSU Marketplace! We're excited to have you join our campus trading community.

Here are some quick tips to get started:
1. Complete your profile to build trust with other users
2. Always use our in-app payment system for safe transactions
3. Meet in public places on campus for item exchanges
4. Report any suspicious activity to keep our community safe

Need help? Just reply to this message or use the Help button in the app.

Happy trading!`;

            await storage.createMessage({
              senderId: systemUserId,
              receiverId: user.id,
              content: welcomeMessage,
            });
            console.log(`Welcome DM sent to ${user.email} from system user`);
            
            // Also create a welcome notification
            await createAndBroadcastNotification({
              userId: user.id,
              type: "welcome",
              title: "Welcome to EKSU Marketplace!",
              message: `Hey ${user.firstName || 'there'}! Your account is ready. Start exploring deals on campus or list your own items to sell.`,
              link: "/",
              relatedUserId: systemUserId,
            });
            console.log(`Welcome notification sent to ${user.email}`);
          } else {
            console.log(`System user with ID ${systemUserId} not found`);
          }
        } catch (autoFollowError: any) {
          // Log but don't fail registration if auto-follow fails
          console.error("Error processing auto-follow/welcome DM:", autoFollowError.message);
        }
      }

      // Send email verification (don't block registration if this fails)
      try {
        const { token, code } = await storage.createEmailVerificationToken(user.id);
        const appUrl = process.env.APP_URL || 'https://eksuplug.com.ng';
        const verificationLink = `${appUrl}/verify-email?token=${token}`;
        await sendEmailVerificationCode(user.email, user.firstName || 'User', code, verificationLink);
        console.log(`Verification email sent to ${user.email}`);
      } catch (emailError: any) {
        console.error("Error sending verification email:", emailError.message);
        // Don't fail registration if email fails - user can request resend later
      }

      // Send welcome email (don't block registration if this fails)
      try {
        await sendWelcomeEmail(user.email, user.firstName || 'User');
        console.log(`Welcome email sent to ${user.email}`);
      } catch (welcomeEmailError: any) {
        console.error("Error sending welcome email:", welcomeEmailError.message);
      }

      // Remove password from user object before storing in session/sending to client
      const { password: _, ...safeUser } = user;

      // Log the user in
      req.login(safeUser, (err) => {
        if (err) {
          console.error("Error logging in after registration:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        console.log("User registered and logged in successfully:", safeUser.email);
        res.json(safeUser);
      });
    } catch (error: any) {
      console.error("Error registering user:", error);
      
      // Handle specific database errors
      if (error.message?.includes("duplicate key") || error.code === "23505") {
        return res.status(400).json({ message: "Email already registered" });
      }
      
      // Hide developer details from user
      const userMessage = "Failed to create account. Please try again or contact support.";
      
      // Send error to admin
      sendErrorReportToAdmin("Registration Error", error.message, { 
        email: req.body.email,
        stack: error.stack 
      }).catch(err => {
        console.error("Failed to send registration error email:", err);
      });

      res.status(500).json({ message: userMessage });
    }
  });

  // ==================== EMAIL VERIFICATION ROUTES ====================

  // Send/resend verification email
  app.post("/api/auth/send-verification-email", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: "Email is already verified" });
      }

      // Generate verification token and code
      const { token, code } = await storage.createEmailVerificationToken(userId);
      
      // Build verification link
      const appUrl = process.env.APP_URL || 'https://eksu-marketplace.com';
      const verificationLink = `${appUrl}/verify-email?token=${token}`;

      // Send verification email
      await sendEmailVerificationCode(user.email, user.firstName || 'User', code, verificationLink);

      console.log(`Verification email sent to ${user.email}`);
      res.json({ 
        message: "Verification email sent successfully",
        success: true 
      });
    } catch (error: any) {
      console.error("Error sending verification email:", error);
      res.status(500).json({ message: "Failed to send verification email" });
    }
  });

  // Verify email via link token
  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const verified = await storage.verifyEmailToken(token);
      
      if (!verified) {
        return res.status(400).json({ 
          message: "Invalid or expired verification link. Please request a new one.",
          success: false 
        });
      }

      console.log(`Email verified via link token`);
      res.json({ 
        message: "Email verified successfully!",
        success: true 
      });
    } catch (error: any) {
      console.error("Error verifying email token:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Verify email via 6-digit code
  app.post("/api/auth/verify-email-code", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const { code } = req.body;
      
      if (!code || typeof code !== 'string' || code.length !== 6) {
        return res.status(400).json({ message: "Valid 6-digit verification code is required" });
      }

      const verified = await storage.verifyEmailCode(userId, code);
      
      if (!verified) {
        return res.status(400).json({ 
          message: "Invalid or expired verification code. Please request a new one.",
          success: false 
        });
      }

      console.log(`Email verified via code for user ${userId}`);
      res.json({ 
        message: "Email verified successfully!",
        success: true 
      });
    } catch (error: any) {
      console.error("Error verifying email code:", error);
      res.status(500).json({ message: "Failed to verify email" });
    }
  });

  // Check email verification status
  app.get("/api/auth/email-verification-status", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const isVerified = await storage.isUserEmailVerified(userId);
      res.json({ emailVerified: isVerified });
    } catch (error: any) {
      console.error("Error checking email verification status:", error);
      res.status(500).json({ message: "Failed to check email verification status" });
    }
  });

  // Login route
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Error during login:", err);
        return res.status(500).json({ message: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      // Remove password from user object before storing in session/sending to client
      const { password: _, ...safeUser } = user;
      
      req.login(safeUser, (err) => {
        if (err) {
          console.error("Error establishing session:", err);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        res.json(safeUser);
      });
    })(req, res, next);
  });

  // Logout route
  app.post("/api/auth/logout", (req, res) => {
    const sessionId = req.sessionID;
    
    req.logout((err) => {
      if (err) {
        console.error("Error logging out:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      
      // Destroy the session completely
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Error destroying session:", sessionErr);
        }
        
        // Clear the session cookie
        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax"
        });
        
        console.log("User logged out, session destroyed:", sessionId);
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  // Forgot password route - generates reset token
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const validationResult = forgotPasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ message: "Valid email is required" });
      }

      const { email } = validationResult.data;
      
      // Check if user exists
      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      
      // For security, always return success even if user doesn't exist
      // This prevents email enumeration attacks
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.json({ 
          message: "If an account exists with this email, a password reset link will be sent.",
          success: true
        });
      }

      // Generate a secure random token
      const resetToken = crypto.randomBytes(32).toString("hex");
      
      // Token expires in 1 hour
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
      
      // Store the token in database
      await storage.createPasswordResetToken(user.id, resetToken, expiresAt);
      
      console.log(`Password reset token generated for user: ${email}`);
      console.log(`Reset token (for development): ${resetToken}`);
      
      // In production, send email with reset link
      // For now, include the token in the response for development/testing
      // The frontend can use this to navigate to /reset-password?token=xxx
      
      res.json({ 
        message: "If an account exists with this email, a password reset link will be sent.",
        success: true,
        // Include token in development mode for testing
        ...(process.env.NODE_ENV === "development" && { resetToken })
      });
    } catch (error) {
      console.error("Error in forgot password:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Reset password route - validates token and updates password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const validationResult = resetPasswordSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        const errors = validationResult.error.flatten();
        return res.status(400).json({ 
          message: "Validation failed",
          errors: errors.fieldErrors
        });
      }

      const { token, password } = validationResult.data;
      
      // Find the reset token
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.status(400).json({ 
          message: "Invalid or expired reset token. Please request a new password reset." 
        });
      }
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 12);
      
      // Update the user's password
      await storage.updateUserPassword(resetToken.userId, hashedPassword);
      
      // Mark the token as used
      await storage.markPasswordResetTokenUsed(token);
      
      console.log(`Password reset successful for user: ${resetToken.userId}`);
      
      res.json({ 
        message: "Password has been reset successfully. You can now log in with your new password.",
        success: true
      });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  // Validate reset token route - checks if token is valid before showing reset form
  app.get("/api/auth/validate-reset-token", async (req, res) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== "string") {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }
      
      const resetToken = await storage.getPasswordResetToken(token);
      
      if (!resetToken) {
        return res.json({ 
          valid: false, 
          message: "Invalid or expired reset token" 
        });
      }
      
      res.json({ valid: true });
    } catch (error) {
      console.error("Error validating reset token:", error);
      res.status(500).json({ valid: false, message: "Failed to validate token" });
    }
  });

  // ==================== TRANSACTION PIN ROUTES ====================

  // Set up initial transaction PIN
  app.post("/api/auth/pin/setup", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { pin, confirmPin } = req.body;

      // Validate PIN format
      if (!pin || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 4-6 digits" });
      }

      if (pin !== confirmPin) {
        return res.status(400).json({ message: "PINs do not match" });
      }

      // Check if PIN is already set
      const pinData = await storage.getTransactionPin(userId);
      if (pinData?.transactionPinSet) {
        return res.status(400).json({ message: "Transaction PIN is already set. Use change PIN instead." });
      }

      // Hash and store the PIN
      const hashedPin = await bcrypt.hash(pin, 10);
      await storage.setTransactionPin(userId, hashedPin);

      res.json({ message: "Transaction PIN set successfully", success: true });
    } catch (error) {
      console.error("Error setting up PIN:", error);
      res.status(500).json({ message: "Failed to set up transaction PIN" });
    }
  });

  // Change existing transaction PIN
  app.post("/api/auth/pin/change", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { currentPin, newPin, confirmNewPin } = req.body;

      // Validate PIN formats
      if (!currentPin || typeof currentPin !== "string" || !/^\d{4,6}$/.test(currentPin)) {
        return res.status(400).json({ message: "Current PIN must be 4-6 digits" });
      }

      if (!newPin || typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
        return res.status(400).json({ message: "New PIN must be 4-6 digits" });
      }

      if (newPin !== confirmNewPin) {
        return res.status(400).json({ message: "New PINs do not match" });
      }

      // Check if user is locked out
      const isLocked = await storage.isUserPinLocked(userId);
      if (isLocked) {
        return res.status(429).json({ 
          message: "PIN is temporarily locked due to too many failed attempts. Please try again later.",
          locked: true
        });
      }

      // Verify current PIN
      const pinData = await storage.getTransactionPin(userId);
      if (!pinData?.transactionPin || !pinData.transactionPinSet) {
        return res.status(400).json({ message: "No transaction PIN set. Use setup PIN instead." });
      }

      const isValid = await bcrypt.compare(currentPin, pinData.transactionPin);
      if (!isValid) {
        const attempts = await storage.incrementPinAttempts(userId);
        const remainingAttempts = 5 - attempts;
        
        if (remainingAttempts <= 0) {
          // Lock the PIN for 30 minutes
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
          await storage.lockPin(userId, lockUntil);
          return res.status(429).json({ 
            message: "Too many failed attempts. PIN is locked for 30 minutes.",
            locked: true
          });
        }
        
        return res.status(401).json({ 
          message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
          remainingAttempts
        });
      }

      // Reset attempts on success
      await storage.resetPinAttempts(userId);

      // Hash and store the new PIN
      const hashedPin = await bcrypt.hash(newPin, 10);
      await storage.setTransactionPin(userId, hashedPin);

      res.json({ message: "Transaction PIN changed successfully", success: true });
    } catch (error) {
      console.error("Error changing PIN:", error);
      res.status(500).json({ message: "Failed to change transaction PIN" });
    }
  });

  // Verify transaction PIN
  app.post("/api/auth/pin/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { pin } = req.body;

      // Validate PIN format
      if (!pin || typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ message: "PIN must be 4-6 digits" });
      }

      // Check if user is locked out
      const isLocked = await storage.isUserPinLocked(userId);
      if (isLocked) {
        const pinData = await storage.getTransactionPin(userId);
        const lockUntil = pinData?.pinLockUntil;
        const remainingMinutes = lockUntil ? Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 60000) : 30;
        
        return res.status(429).json({ 
          message: `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`,
          locked: true,
          remainingMinutes
        });
      }

      // Verify PIN
      const pinData = await storage.getTransactionPin(userId);
      if (!pinData?.transactionPin || !pinData.transactionPinSet) {
        return res.status(400).json({ message: "No transaction PIN set", pinRequired: false });
      }

      const isValid = await bcrypt.compare(pin, pinData.transactionPin);
      if (!isValid) {
        const attempts = await storage.incrementPinAttempts(userId);
        const remainingAttempts = 5 - attempts;
        
        if (remainingAttempts <= 0) {
          // Lock the PIN for 30 minutes
          const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
          await storage.lockPin(userId, lockUntil);
          return res.status(429).json({ 
            message: "Too many failed attempts. PIN is locked for 30 minutes.",
            locked: true,
            remainingMinutes: 30
          });
        }
        
        return res.status(401).json({ 
          message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
          verified: false,
          remainingAttempts
        });
      }

      // Reset attempts on success
      await storage.resetPinAttempts(userId);

      res.json({ verified: true, message: "PIN verified successfully" });
    } catch (error) {
      console.error("Error verifying PIN:", error);
      res.status(500).json({ message: "Failed to verify PIN" });
    }
  });

  // Get PIN status
  app.get("/api/auth/pin/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const pinData = await storage.getTransactionPin(userId);
      const isLocked = await storage.isUserPinLocked(userId);

      let lockRemainingMinutes = 0;
      if (isLocked && pinData?.pinLockUntil) {
        lockRemainingMinutes = Math.ceil((new Date(pinData.pinLockUntil).getTime() - Date.now()) / 60000);
      }

      res.json({
        pinSet: pinData?.transactionPinSet || false,
        isLocked,
        lockRemainingMinutes: isLocked ? lockRemainingMinutes : 0,
        attemptsRemaining: pinData?.pinAttempts ? 5 - pinData.pinAttempts : 5,
      });
    } catch (error) {
      console.error("Error getting PIN status:", error);
      res.status(500).json({ message: "Failed to get PIN status" });
    }
  });

  // Request PIN reset via email
  app.post("/api/auth/pin/reset-request", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Generate 6-digit reset code
      const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store the code with expiration (15 minutes)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await storage.createPasswordResetToken(userId, `PIN_RESET_${resetCode}`, expiresAt);

      // Send email with reset code
      await sendEmail({
        to: user.email,
        subject: "EKSUPlug - PIN Reset Code",
        text: `Your PIN reset code is: ${resetCode}\n\nThis code expires in 15 minutes.\n\nIf you didn't request this, please ignore this email.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">PIN Reset Code</h2>
            <p>Your PIN reset code is:</p>
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 32px; letter-spacing: 8px; font-family: monospace; margin: 20px 0;">
              ${resetCode}
            </div>
            <p>This code expires in <strong>15 minutes</strong>.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this PIN reset, please ignore this email.</p>
          </div>
        `,
      });

      res.json({ message: "PIN reset code sent to your email", success: true });
    } catch (error) {
      console.error("Error requesting PIN reset:", error);
      res.status(500).json({ message: "Failed to send PIN reset code" });
    }
  });

  // Confirm PIN reset with code
  app.post("/api/auth/pin/reset-confirm", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code, newPin, confirmNewPin } = req.body;

      // Validate inputs
      if (!code || typeof code !== "string" || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Invalid reset code format" });
      }

      if (!newPin || typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
        return res.status(400).json({ message: "New PIN must be 4-6 digits" });
      }

      if (newPin !== confirmNewPin) {
        return res.status(400).json({ message: "New PINs do not match" });
      }

      // Verify the reset code
      const tokenKey = `PIN_RESET_${code}`;
      const resetToken = await storage.getPasswordResetToken(tokenKey);
      
      if (!resetToken || resetToken.userId !== userId) {
        return res.status(400).json({ message: "Invalid or expired reset code" });
      }

      // Mark token as used
      await storage.markPasswordResetTokenUsed(tokenKey);

      // Reset PIN attempts and set new PIN
      await storage.resetPinAttempts(userId);
      const hashedPin = await bcrypt.hash(newPin, 10);
      await storage.setTransactionPin(userId, hashedPin);

      res.json({ message: "Transaction PIN reset successfully", success: true });
    } catch (error) {
      console.error("Error resetting PIN:", error);
      res.status(500).json({ message: "Failed to reset transaction PIN" });
    }
  });

  // ==================== EXISTING AUTH ROUTES ====================
  
  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      // Remove password from user object before sending to client
      const { password: _, ...safeUser } = user;
      
      // Add admin/support access flags based on both database role and environment variables
      const isAdmin = user.role === "admin" || isSuperAdmin(userId);
      const isSupport = hasSupportAccess(userId);
      
      res.json({
        ...safeUser,
        isAdmin,
        isSupport,
      });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ==================== ERROR REPORTING API ROUTES ====================

  // Error reporting endpoint for ErrorBoundary
  app.post("/api/errors/report", async (req, res) => {
    try {
      const { message, stack, componentStack, url, userAgent, timestamp } = req.body;

      // Log error to console
      console.error("Frontend Error Report:", {
        message,
        stack,
        componentStack,
        url,
        userAgent,
        timestamp,
      });

      // Send error report to admin email
      sendErrorReportToAdmin("Frontend Error Report", `URL: ${url}\n\nError: ${message}\n\nStack: ${stack}`, {
        componentStack,
        userAgent,
        timestamp,
      }).catch(err => {
        console.error("Failed to send error report email:", err);
      });

      // For now, just acknowledge receipt
      res.json({ success: true, message: "Error report received" });
    } catch (error) {
      console.error("Error processing error report:", error);
      res.status(500).json({ message: "Failed to process error report" });
    }
  });

  // ==================== NEW FEATURES API ROUTES ====================

  // Wallet routes
  app.get('/api/wallet', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wallet = await storage.getOrCreateWallet(userId);
      res.json(wallet);
    } catch (error) {
      console.error("Error fetching wallet:", error);
      res.status(500).json({ message: "Failed to fetch wallet" });
    }
  });

  app.get('/api/wallet/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const wallet = await storage.getOrCreateWallet(userId);
      const transactions = await storage.getUserTransactions(wallet.id);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.post('/api/wallet/deposit', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount } = req.body;

      if (!amount || parseFloat(amount) < 100) {
        return res.status(400).json({ message: "Minimum deposit is 100 NGN" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'deposit',
        amount: amount.toString(),
        description: 'Wallet deposit',
        status: 'pending',
      });

      res.json({ 
        message: "Deposit initiated. Please complete payment.",
        amount: amount
      });
    } catch (error) {
      console.error("Error initiating deposit:", error);
      res.status(500).json({ message: "Failed to initiate deposit" });
    }
  });

  app.post('/api/wallet/withdraw', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, bankName, accountNumber, accountName, pin } = req.body;

      if (!amount || parseFloat(amount) < 500) {
        return res.status(400).json({ message: "Minimum withdrawal is 500 NGN" });
      }

      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details are required" });
      }

      // Check if user has PIN set and verify it
      const pinData = await storage.getTransactionPin(userId);
      if (pinData?.transactionPinSet) {
        // PIN is required
        if (!pin) {
          return res.status(400).json({ 
            message: "Transaction PIN is required for withdrawals",
            pinRequired: true
          });
        }

        // Check if user is locked out
        const isLocked = await storage.isUserPinLocked(userId);
        if (isLocked) {
          const lockUntil = pinData?.pinLockUntil;
          const remainingMinutes = lockUntil ? Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 60000) : 30;
          return res.status(429).json({ 
            message: `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`,
            locked: true,
            remainingMinutes
          });
        }

        // Verify PIN
        const isValid = await bcrypt.compare(pin, pinData.transactionPin!);
        if (!isValid) {
          const attempts = await storage.incrementPinAttempts(userId);
          const remainingAttempts = 5 - attempts;
          
          if (remainingAttempts <= 0) {
            const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
            await storage.lockPin(userId, lockUntil);
            return res.status(429).json({ 
              message: "Too many failed attempts. PIN is locked for 30 minutes.",
              locked: true,
              remainingMinutes: 30
            });
          }
          
          return res.status(401).json({ 
            message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
            remainingAttempts
          });
        }

        // Reset attempts on success
        await storage.resetPinAttempts(userId);
      }

      const wallet = await storage.getOrCreateWallet(userId);
      
      if (parseFloat(wallet.balance) < parseFloat(amount)) {
        return res.status(400).json({ message: "Insufficient balance" });
      }

      await storage.updateWalletBalance(userId, amount.toString(), 'subtract');
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: amount.toString(),
        description: `Withdrawal to ${bankName} - ${accountNumber}`,
        status: 'pending',
      });

      res.json({ message: "Withdrawal request submitted successfully" });
    } catch (error) {
      console.error("Error processing withdrawal:", error);
      res.status(500).json({ message: "Failed to process withdrawal" });
    }
  });

  // ==================== SQUAD PAYMENT ROUTES ====================

  // Check if Squad is configured - includes test card info for sandbox mode
  app.get('/api/squad/status', (req, res) => {
    const status = getSquadConfigStatus();
    
    // Squad sandbox test cards
    const testCards = status.mode === 'sandbox' ? {
      success: {
        cardNumber: '5200000000000007',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Successful transaction'
      },
      declined: {
        cardNumber: '5200000000000015',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Declined transaction'
      },
      insufficientFunds: {
        cardNumber: '5200000000000023',
        expiryDate: '12/25',
        cvv: '123',
        pin: '1234',
        otp: '123456',
        description: 'Insufficient funds'
      }
    } : null;
    
    res.json({ 
      configured: status.configured,
      mode: status.mode,
      testCards,
      message: status.mode === 'sandbox' 
        ? 'Sandbox mode: Use test cards above for testing. For bank transfer, payments complete instantly.'
        : status.configured ? 'Live mode: Real transactions enabled' : 'Payment not configured'
    });
  });

  // Admin: Get detailed Squad payment configuration status
  // SECURITY: Protected by requireAdmin middleware - only admins can view payment configuration
  app.get('/api/admin/payment/config', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const squadStatus = getSquadConfigStatus();
      const inlomaxConfigured = isInlomaxConfigured();

      res.json({
        squad: squadStatus,
        vtu: {
          configured: inlomaxConfigured,
          provider: "Inlomax",
        },
        message: squadStatus.configured 
          ? `Squad is configured in ${squadStatus.mode} mode`
          : "Squad is not configured. Please set SQUAD_SECRET_KEY and SQUAD_PUBLIC_KEY environment variables.",
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch payment configuration" });
    }
  });

  // Initialize a Squad payment
  app.post('/api/squad/initialize', isAuthenticated, async (req: any, res) => {
    const requestId = crypto.randomBytes(4).toString('hex');
    
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ 
          message: "Payment service is not configured. Please contact support.",
          code: "SERVICE_UNAVAILABLE"
        });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const validated = initiateSquadPaymentSchema.parse(req.body);
      const amount = parseFloat(validated.amount);

      if (amount < 100) {
        return res.status(400).json({ message: "Minimum payment amount is ₦100" });
      }

      const paymentReference = generatePaymentReference();
      const redirectUrl = `${process.env.APP_URL || 'https://eksu-marketplace.replit.app'}/payment/callback`;

      // Determine payment channels based on request
      const paymentChannels: ('card' | 'bank' | 'ussd' | 'transfer')[] = validated.paymentChannel 
        ? [validated.paymentChannel] 
        : ['transfer', 'card', 'ussd'];

      console.log(`[Payment ${requestId}] Initializing Squad payment for user ${userId}, amount: ₦${amount}`);

      const paymentResult = await squad.initializePayment({
        amount,
        email: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        transactionRef: paymentReference,
        callbackUrl: redirectUrl,
        paymentChannels,
        metadata: {
          userId,
          purpose: validated.purpose,
          paymentDescription: validated.paymentDescription || `${validated.purpose} - EKSU Marketplace`,
        },
      });

      // Store payment record in database
      await storage.createSquadPayment({
        userId,
        transactionReference: paymentResult.transactionRef,
        amount: amount.toString(),
        purpose: validated.purpose,
        status: 'pending',
        paymentDescription: validated.paymentDescription || null,
      });

      console.log(`[Payment ${requestId}] Squad payment initialized successfully: ${paymentResult.transactionRef}`);

      res.json({
        checkoutUrl: paymentResult.checkoutUrl,
        transactionReference: paymentResult.transactionRef,
        paymentReference,
      });
    } catch (error) {
      // Handle Zod validation errors
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid payment details. Please check your input and try again.",
          code: "VALIDATION_ERROR",
          errors: error.errors 
        });
      }

      // Handle Squad API errors with user-friendly messages
      if (error instanceof SquadApiError) {
        console.error(`[Payment ${requestId}] Squad API Error:`, {
          type: error.type,
          message: error.message,
          statusCode: error.statusCode,
          userMessage: error.userMessage,
        });

        // Send error report to admin for non-retryable errors
        if (!error.isRetryable) {
          sendErrorReportToAdmin(
            `Squad Payment Error [${requestId}]`,
            error.message,
            {
              type: error.type,
              statusCode: error.statusCode,
              rawError: error.rawError,
              userId: req.user?.id,
            }
          ).catch(console.error);
        }

        return res.status(getHttpStatusForSquadError(error.type)).json({
          message: error.userMessage,
          code: error.type,
          isRetryable: error.isRetryable,
        });
      }

      // Handle generic errors
      console.error(`[Payment ${requestId}] Unexpected error initializing Squad payment:`, error);
      
      // Send error report to admin
      sendErrorReportToAdmin(
        `Unexpected Payment Error [${requestId}]`,
        error instanceof Error ? error.message : 'Unknown error',
        { stack: error instanceof Error ? error.stack : undefined, userId: req.user?.id }
      ).catch(console.error);

      res.status(500).json({ 
        message: "Unable to process your payment at this time. Please try again later or contact support.",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Helper function to map Squad error types to HTTP status codes
  function getHttpStatusForSquadError(errorType: SquadErrorType): number {
    switch (errorType) {
      case SquadErrorType.INVALID_REQUEST:
        return 400;
      case SquadErrorType.INVALID_CREDENTIALS:
        return 503;
      case SquadErrorType.INSUFFICIENT_FUNDS:
        return 402;
      case SquadErrorType.RATE_LIMITED:
        return 429;
      case SquadErrorType.TIMEOUT:
      case SquadErrorType.NETWORK_ERROR:
      case SquadErrorType.SERVER_ERROR:
        return 503;
      default:
        return 500;
    }
  }

  // Verify a Squad payment by reference
  app.get('/api/squad/verify/:reference', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { reference } = req.params;
      const userId = req.user.id;

      // Get payment from database
      const payment = await storage.getSquadPaymentByReference(reference);
      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      if (payment.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to verify this payment" });
      }

      // Verify with Squad
      const transactionStatus = await squad.verifyTransaction(reference);

      // Update payment status in database
      const paidAt = transactionStatus.transactionStatus === 'success' && transactionStatus.createdAt
        ? new Date(transactionStatus.createdAt)
        : undefined;
      
      await storage.updateSquadPaymentStatus(reference, transactionStatus.transactionStatus, paidAt);

      // If payment is successful, credit wallet
      if (transactionStatus.transactionStatus === 'success' && payment.status !== 'success') {
        const wallet = await storage.getOrCreateWallet(userId);
        await storage.updateWalletBalance(userId, payment.amount, 'add');
        
        await storage.createTransaction({
          walletId: wallet.id,
          type: 'deposit',
          amount: payment.amount,
          description: `Squad deposit - ${payment.purpose}`,
          status: 'completed',
        });
      }

      res.json({
        status: transactionStatus.transactionStatus,
        amountPaid: transactionStatus.transactionAmount,
        paymentMethod: transactionStatus.transactionType || 'unknown',
        paidOn: transactionStatus.createdAt,
      });
    } catch (error) {
      console.error("Error verifying Squad payment:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify payment" });
    }
  });

  // Get user's Squad payments
  app.get('/api/squad/payments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const payments = await storage.getUserSquadPayments(userId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching Squad payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  // Squad webhook handler (no auth - verified by signature)
  app.post('/api/squad/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const signature = req.headers['squad-signature'] as string;
      const payload = req.body.toString();

      if (!signature || !squad.verifyWebhookSignature(payload, signature)) {
        console.error("Invalid Squad webhook signature");
        return res.status(401).json({ message: "Invalid signature" });
      }

      const webhookData = JSON.parse(payload);
      const { transactionReference, paymentStatus, amountPaid, paidOn } = webhookData;

      // Find payment in database
      const payment = await storage.getSquadPaymentByReference(transactionReference);
      if (!payment) {
        console.error(`Squad webhook: Payment not found for reference ${transactionReference}`);
        return res.status(404).json({ message: "Payment not found" });
      }

      // Update payment status
      const paidAtDate = paymentStatus === 'success' && paidOn ? new Date(paidOn) : undefined;
      await storage.updateSquadPaymentStatus(transactionReference, paymentStatus, paidAtDate);

      // Credit wallet if payment is successful
      if (paymentStatus === 'success' && payment.status !== 'success') {
        const wallet = await storage.getOrCreateWallet(payment.userId);
        await storage.updateWalletBalance(payment.userId, amountPaid.toString(), 'add');
        
        await storage.createTransaction({
          walletId: wallet.id,
          type: 'deposit',
          amount: amountPaid.toString(),
          description: `Squad deposit - ${payment.purpose}`,
          status: 'completed',
        });

        console.log(`Squad webhook: Credited ₦${amountPaid} to user ${payment.userId}`);
      }

      res.json({ message: "Webhook processed successfully" });
    } catch (error) {
      console.error("Error processing Squad webhook:", error);
      res.status(500).json({ message: "Failed to process webhook" });
    }
  });

  // Get list of banks
  app.get('/api/squad/banks', async (req, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const banks = await squad.getBankList();
      res.json(banks);
    } catch (error) {
      console.error("Error fetching bank list:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to fetch bank list" });
    }
  });

  // Verify bank account (POST - legacy)
  app.post('/api/squad/verify-bank', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { accountNumber, bankCode } = req.body;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({ message: "Account number and bank code are required" });
      }

      const accountDetails = await squad.verifyBankAccount(accountNumber, bankCode);
      res.json(accountDetails);
    } catch (error) {
      console.error("Error verifying bank account:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify bank account" });
    }
  });

  // Verify bank account (GET with query params)
  app.get('/api/squad/verify-account', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const { accountNumber, bankCode } = req.query;

      if (!accountNumber || !bankCode) {
        return res.status(400).json({ message: "Account number and bank code are required" });
      }

      if (typeof accountNumber !== 'string' || accountNumber.length !== 10) {
        return res.status(400).json({ message: "Account number must be 10 digits" });
      }

      if (typeof bankCode !== 'string') {
        return res.status(400).json({ message: "Bank code is required" });
      }

      const accountDetails = await squad.verifyBankAccount(accountNumber, bankCode);
      res.json(accountDetails);
    } catch (error) {
      console.error("Error verifying bank account:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to verify bank account" });
    }
  });

  // Initiate withdrawal via Squad transfer
  app.post('/api/squad/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
      }

      const userId = req.user.id;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { amount, bankCode, bankName, accountNumber, accountName } = req.body;
      const withdrawAmount = parseFloat(amount);

      if (!withdrawAmount || withdrawAmount < 500) {
        return res.status(400).json({ message: "Minimum withdrawal is ₦500" });
      }

      if (!bankCode || !bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details are required" });
      }

      const wallet = await storage.getOrCreateWallet(userId);
      const balance = parseFloat(wallet.balance);

      // Check if withdrawal is allowed
      const withdrawalCheck = isWithdrawalAllowed(
        withdrawAmount,
        user.isVerified || false,
        balance,
        0
      );

      if (!withdrawalCheck.allowed) {
        return res.status(400).json({ message: withdrawalCheck.reason });
      }

      // Generate transfer reference
      const reference = generateTransferReference();

      // Create transfer record
      await storage.createSquadTransfer({
        userId,
        transactionReference: reference,
        amount: withdrawAmount.toString(),
        destinationBankCode: bankCode,
        destinationAccountNumber: accountNumber,
        destinationAccountName: accountName,
        status: 'pending',
      });

      // Deduct from wallet first
      await storage.updateWalletBalance(userId, withdrawAmount.toString(), 'subtract');

      // Create pending transaction
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'withdrawal',
        amount: withdrawAmount.toString(),
        description: `Withdrawal to ${bankName} - ${accountNumber}`,
        status: 'pending',
      });

      // Initiate transfer with Squad
      try {
        const transferResult = await squad.initiateTransfer({
          amount: withdrawAmount,
          transactionReference: reference,
          remark: `EKSU Marketplace withdrawal - ${user.firstName} ${user.lastName}`,
          bankCode,
          accountNumber,
          accountName,
        });

        // Update transfer status
        await storage.updateSquadTransferStatus(
          reference,
          transferResult.status,
          undefined,
          transferResult.status === 'success' ? new Date() : undefined
        );

        res.json({
          message: "Withdrawal initiated successfully",
          reference,
          status: transferResult.status,
        });
      } catch (transferError: any) {
        // Check for merchant eligibility errors and handle gracefully
        const errorMessage = transferError?.message?.toLowerCase() || '';
        const isSquadError = transferError?.name === 'SquadApiError';
        
        const isMerchantEligibilityError = isSquadError && (
          errorMessage.includes('not eligible') || 
          errorMessage.includes('merchant') ||
          transferError?.type === 'INVALID_CREDENTIALS'
        );
        
        if (isMerchantEligibilityError) {
          console.log('[Withdrawal] Merchant eligibility issue detected, marking for manual processing');
          
          // Keep the wallet deducted - this is a REAL withdrawal request
          // Update the transfer to require manual processing (NOT failed)
          await storage.updateSquadTransferStatus(reference, 'manual_review', 'Merchant account requires transfer activation - manual payout required');
          
          // Return success - the withdrawal IS accepted, just needs manual processing
          return res.json({ 
            message: "Withdrawal request accepted. Due to a temporary system issue, your withdrawal will be processed manually within 24 hours. You will receive a notification when complete.",
            reference,
            status: 'manual_review',
            amount: withdrawAmount,
            bankDetails: { bankName, accountNumber, accountName },
            manualProcessing: true
          });
        }
        
        // For other errors, refund and fail
        await storage.updateWalletBalance(userId, withdrawAmount.toString(), 'add');
        await storage.updateSquadTransferStatus(reference, 'failed', String(transferError));
        
        throw transferError;
      }
    } catch (error: any) {
      console.error("Error processing Squad withdrawal:", error);
      
      // Provide user-friendly error messages
      const userMessage = error?.userMessage || error?.message || "Failed to process withdrawal";
      res.status(500).json({ message: userMessage });
    }
  });

  // ==================== NEGOTIATION ROUTES ====================

  // Submit a price offer on a product
  app.post('/api/negotiations', isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = req.user.id;

      const { productId, offerPrice, message } = req.body;

      // Validate required fields
      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }
      if (!offerPrice || isNaN(parseFloat(offerPrice))) {
        return res.status(400).json({ message: "Valid offer price is required" });
      }

      const offerPriceNum = parseFloat(offerPrice);

      // Validate offer price is positive
      if (offerPriceNum <= 0) {
        return res.status(400).json({ message: "Offer price must be greater than 0" });
      }

      // Get the product and validate it exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      // Check product is available
      if (!product.isAvailable || product.isSold) {
        return res.status(400).json({ message: "Product is not available for negotiation" });
      }

      // Validate buyer is not the seller
      if (product.sellerId === userId) {
        return res.status(400).json({ message: "You cannot make an offer on your own product" });
      }

      // Validate offer is not above original price
      const originalPrice = parseFloat(product.price);
      if (offerPriceNum > originalPrice) {
        return res.status(400).json({ message: "Offer price cannot be higher than the original price" });
      }

      // Create the negotiation record
      const negotiation = await storage.createNegotiation({
        productId,
        buyerId: userId,
        sellerId: product.sellerId,
        originalPrice: product.price,
        offerPrice: offerPriceNum.toFixed(2),
        buyerMessage: message || null,
        status: 'pending',
      });

      // Return with product details
      res.status(201).json({
        ...negotiation,
        product: {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
        },
      });
    } catch (error) {
      console.error("Error creating negotiation:", error);
      res.status(500).json({ message: "Failed to create negotiation" });
    }
  });

  // Get offers received on seller's products
  app.get('/api/negotiations/received', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const statusFilter = req.query.status as string | undefined;

      // Get all negotiations where user is the seller
      const negotiations = await storage.getUserNegotiations(userId);
      
      // Filter to only received negotiations (where user is seller)
      let receivedNegotiations = negotiations.filter(n => n.sellerId === userId);

      // Apply status filter if provided
      if (statusFilter) {
        receivedNegotiations = receivedNegotiations.filter(n => n.status === statusFilter);
      }

      // Enrich with product and buyer details
      const enrichedNegotiations = await Promise.all(
        receivedNegotiations.map(async (negotiation) => {
          const product = await storage.getProduct(negotiation.productId);
          const buyer = await storage.getUser(negotiation.buyerId);
          return {
            ...negotiation,
            product: product ? {
              id: product.id,
              title: product.title,
              price: product.price,
              images: product.images,
            } : null,
            buyer: buyer ? {
              id: buyer.id,
              firstName: buyer.firstName,
              lastName: buyer.lastName,
              profileImageUrl: buyer.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedNegotiations);
    } catch (error) {
      console.error("Error fetching received negotiations:", error);
      res.status(500).json({ message: "Failed to fetch received negotiations" });
    }
  });

  // Get offers sent by buyer
  app.get('/api/negotiations/sent', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;

      // Get all negotiations where user is the buyer
      const negotiations = await storage.getUserNegotiations(userId);
      
      // Filter to only sent negotiations (where user is buyer)
      const sentNegotiations = negotiations.filter(n => n.buyerId === userId);

      // Enrich with product and seller details
      const enrichedNegotiations = await Promise.all(
        sentNegotiations.map(async (negotiation) => {
          const product = await storage.getProduct(negotiation.productId);
          const seller = await storage.getUser(negotiation.sellerId);
          return {
            ...negotiation,
            product: product ? {
              id: product.id,
              title: product.title,
              price: product.price,
              images: product.images,
            } : null,
            seller: seller ? {
              id: seller.id,
              firstName: seller.firstName,
              lastName: seller.lastName,
              profileImageUrl: seller.profileImageUrl,
            } : null,
          };
        })
      );

      res.json(enrichedNegotiations);
    } catch (error) {
      console.error("Error fetching sent negotiations:", error);
      res.status(500).json({ message: "Failed to fetch sent negotiations" });
    }
  });

  // Get single negotiation
  app.get('/api/negotiations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      // Validate user is buyer or seller
      if (negotiation.buyerId !== userId && negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "You do not have access to this negotiation" });
      }

      // Get product and user details
      const product = await storage.getProduct(negotiation.productId);
      const buyer = await storage.getUser(negotiation.buyerId);
      const seller = await storage.getUser(negotiation.sellerId);

      res.json({
        ...negotiation,
        product: product ? {
          id: product.id,
          title: product.title,
          price: product.price,
          images: product.images,
          description: product.description,
        } : null,
        buyer: buyer ? {
          id: buyer.id,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          profileImageUrl: buyer.profileImageUrl,
        } : null,
        seller: seller ? {
          id: seller.id,
          firstName: seller.firstName,
          lastName: seller.lastName,
          profileImageUrl: seller.profileImageUrl,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching negotiation:", error);
      res.status(500).json({ message: "Failed to fetch negotiation" });
    }
  });

  // Accept an offer
  app.post('/api/negotiations/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      // Validate user is the seller
      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can accept an offer" });
      }

      // Validate negotiation is pending
      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot accept a negotiation with status '${negotiation.status}'` });
      }

      // Update status to accepted
      const updated = await storage.updateNegotiationStatus(id, 'accepted', {
        acceptedAt: new Date(),
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error accepting negotiation:", error);
      res.status(500).json({ message: "Failed to accept negotiation" });
    }
  });

  // Reject an offer
  app.post('/api/negotiations/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      // Validate user is the seller
      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can reject an offer" });
      }

      // Validate negotiation is pending
      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot reject a negotiation with status '${negotiation.status}'` });
      }

      // Update status to rejected
      const updated = await storage.updateNegotiationStatus(id, 'rejected', {
        rejectedAt: new Date(),
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error rejecting negotiation:", error);
      res.status(500).json({ message: "Failed to reject negotiation" });
    }
  });

  // Counter offer
  app.post('/api/negotiations/:id/counter', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { counterPrice, counterMessage } = req.body;

      // Validate counter price
      if (!counterPrice || isNaN(parseFloat(counterPrice))) {
        return res.status(400).json({ message: "Valid counter price is required" });
      }

      const counterPriceNum = parseFloat(counterPrice);
      if (counterPriceNum <= 0) {
        return res.status(400).json({ message: "Counter price must be greater than 0" });
      }

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      // Validate user is the seller
      if (negotiation.sellerId !== userId) {
        return res.status(403).json({ message: "Only the seller can make a counter offer" });
      }

      // Validate negotiation is pending
      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot counter a negotiation with status '${negotiation.status}'` });
      }

      // Validate counter price is reasonable (should be between offer and original price)
      const offerPriceNum = parseFloat(negotiation.offerPrice);
      const originalPriceNum = parseFloat(negotiation.originalPrice);
      
      if (counterPriceNum < offerPriceNum) {
        return res.status(400).json({ message: "Counter price cannot be lower than the buyer's offer" });
      }
      if (counterPriceNum > originalPriceNum) {
        return res.status(400).json({ message: "Counter price cannot be higher than the original price" });
      }

      // Update status to countered
      const updated = await storage.updateNegotiationStatus(id, 'countered', {
        counterOfferPrice: counterPriceNum.toFixed(2),
        sellerMessage: counterMessage || null,
        rejectedAt: new Date(), // Using rejectedAt as respondedAt for counter offers
      });

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error creating counter offer:", error);
      res.status(500).json({ message: "Failed to create counter offer" });
    }
  });

  // Cancel an offer (buyer only)
  app.post('/api/negotiations/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const negotiation = await storage.getNegotiation(id);
      if (!negotiation) {
        return res.status(404).json({ message: "Negotiation not found" });
      }

      // Validate user is the buyer
      if (negotiation.buyerId !== userId) {
        return res.status(403).json({ message: "Only the buyer can cancel an offer" });
      }

      // Validate negotiation is pending
      if (negotiation.status !== 'pending') {
        return res.status(400).json({ message: `Cannot cancel a negotiation with status '${negotiation.status}'` });
      }

      // Update status to cancelled
      const updated = await storage.updateNegotiationStatus(id, 'cancelled', {});

      if (!updated) {
        return res.status(500).json({ message: "Failed to update negotiation" });
      }

      res.json(updated);
    } catch (error) {
      console.error("Error cancelling negotiation:", error);
      res.status(500).json({ message: "Failed to cancel negotiation" });
    }
  });

  // ==================== PRICING API ROUTES ====================

  // Calculate pricing from seller price
  app.post('/api/pricing/calculate', (req, res) => {
    try {
      const { sellerPrice, paymentMethod } = req.body;
      
      if (!sellerPrice || isNaN(parseFloat(sellerPrice))) {
        return res.status(400).json({ message: "Valid seller price is required" });
      }

      const pricing = calculatePricingFromSellerPrice(
        parseFloat(sellerPrice),
        paymentMethod || 'CARD'
      );

      res.json(pricing);
    } catch (error) {
      console.error("Error calculating pricing:", error);
      res.status(500).json({ message: "Failed to calculate pricing" });
    }
  });

  // Get current commission rate and config
  app.get('/api/pricing/config', (req, res) => {
    res.json({
      commissionRate: getCommissionRate(),
      securityDepositAmount: getSecurityDepositAmount(),
    });
  });

  // Role switcher
  app.put('/api/users/role', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = roleUpdateSchema.parse(req.body);

      const user = await storage.updateUserProfile(userId, { role: validated.role });
      
      // Create seller analytics if switching to seller
      if (validated.role === 'seller') {
        await storage.getOrCreateSellerAnalytics(userId);
      }

      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // Referral routes
  app.get('/api/referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const referrals = await storage.getUserReferrals(userId);
      res.json(referrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  app.post('/api/referrals', isAuthenticated, async (req: any, res) => {
    try {
      const referrerId = req.user.id;
      const validated = createReferralSchema.parse(req.body);
      
      // Create referral first - this validates no duplicates/self-referral
      const referral = await storage.createReferral(referrerId, validated.referredUserId);
      
      // Only proceed with payment if referral creation succeeded
      const wallet = await storage.getOrCreateWallet(referrerId);
      const updatedWallet = await storage.updateWalletBalance(referrerId, '500', 'add');
      
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'referral_bonus',
        amount: '500',
        description: 'Referral bonus',
        relatedUserId: validated.referredUserId,
        status: 'completed',
      });
      
      await storage.markReferralPaid(referral.id);

      res.json({ ...referral, newBalance: updatedWallet.balance });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating referral:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create referral" });
    }
  });

  // Login streak rate limiting store (in-memory, per-user tracking)
  const loginStreakRateLimits: Map<string, { count: number; windowStart: number }> = new Map();
  const STREAK_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
  const STREAK_RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per minute per user

  // Helper function to get client IP address
  function getClientIp(req: any): string {
    // Check for forwarded headers (common in reverse proxy setups)
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      // x-forwarded-for can contain multiple IPs, take the first one
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return ips[0];
    }
    // Fallback to direct connection IP
    return req.ip || req.connection?.remoteAddress || 'unknown';
  }

  // Helper function to check rate limit
  function checkStreakRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const userLimit = loginStreakRateLimits.get(userId);
    
    if (!userLimit || (now - userLimit.windowStart) > STREAK_RATE_LIMIT_WINDOW_MS) {
      // New window or expired window
      loginStreakRateLimits.set(userId, { count: 1, windowStart: now });
      return { allowed: true, remaining: STREAK_RATE_LIMIT_MAX_REQUESTS - 1, resetIn: STREAK_RATE_LIMIT_WINDOW_MS };
    }
    
    if (userLimit.count >= STREAK_RATE_LIMIT_MAX_REQUESTS) {
      const resetIn = STREAK_RATE_LIMIT_WINDOW_MS - (now - userLimit.windowStart);
      return { allowed: false, remaining: 0, resetIn };
    }
    
    userLimit.count++;
    loginStreakRateLimits.set(userId, userLimit);
    return { allowed: true, remaining: STREAK_RATE_LIMIT_MAX_REQUESTS - userLimit.count, resetIn: STREAK_RATE_LIMIT_WINDOW_MS - (now - userLimit.windowStart) };
  }

  // Login streak routes
  app.post('/api/login-streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check rate limit
      const rateCheck = checkStreakRateLimit(userId);
      if (!rateCheck.allowed) {
        console.log(`Rate limit exceeded for user ${userId}. Reset in ${rateCheck.resetIn}ms`);
        return res.status(429).json({ 
          message: "Too many requests. Please try again later.",
          retryAfter: Math.ceil(rateCheck.resetIn / 1000),
          remaining: 0
        });
      }
      
      // Get client IP address for security tracking
      const ipAddress = getClientIp(req);
      
      // Update login streak with IP tracking
      const result = await storage.updateLoginStreak(userId, ipAddress);
      
      // Include rate limit info in response
      res.json({
        ...result,
        rateLimit: {
          remaining: rateCheck.remaining,
          resetIn: rateCheck.resetIn
        }
      });
    } catch (error) {
      console.error("Error updating login streak:", error);
      res.status(500).json({ message: "Failed to update login streak" });
    }
  });

  app.get('/api/login-streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const streak = await storage.getOrCreateLoginStreak(userId);
      res.json(streak);
    } catch (error) {
      console.error("Error fetching login streak:", error);
      res.status(500).json({ message: "Failed to fetch login streak" });
    }
  });

  // Saved searches
  app.get('/api/saved-searches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const searches = await storage.getUserSavedSearches(userId);
      res.json(searches);
    } catch (error) {
      console.error("Error fetching saved searches:", error);
      res.status(500).json({ message: "Failed to fetch saved searches" });
    }
  });

  app.post('/api/saved-searches', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = createSavedSearchSchema.parse({ ...req.body, userId });
      const search = await storage.createSavedSearch(validated);
      res.json(search);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error saving search:", error);
      res.status(500).json({ message: "Failed to save search" });
    }
  });

  app.delete('/api/saved-searches/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteSavedSearch(req.params.id);
      res.json({ message: "Search deleted" });
    } catch (error) {
      console.error("Error deleting search:", error);
      res.status(500).json({ message: "Failed to delete search" });
    }
  });

  // Draft products
  app.get('/api/drafts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const drafts = await storage.getUserDrafts(userId);
      res.json(drafts);
    } catch (error) {
      console.error("Error fetching drafts:", error);
      res.status(500).json({ message: "Failed to fetch drafts" });
    }
  });

  app.post('/api/drafts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = saveDraftSchema.parse(req.body);
      const draft = await storage.saveDraft(userId, validated);
      res.json(draft);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error saving draft:", error);
      res.status(500).json({ message: "Failed to save draft" });
    }
  });

  app.delete('/api/drafts/:id', isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteDraft(req.params.id);
      res.json({ message: "Draft deleted" });
    } catch (error) {
      console.error("Error deleting draft:", error);
      res.status(500).json({ message: "Failed to delete draft" });
    }
  });

  // Scheduled posts
  app.get('/api/scheduled-posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const posts = await storage.getUserScheduledPosts(userId);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching scheduled posts:", error);
      res.status(500).json({ message: "Failed to fetch scheduled posts" });
    }
  });

  app.post('/api/scheduled-posts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = createScheduledPostSchema.parse({ ...req.body, sellerId: userId });
      const post = await storage.createScheduledPost(validated);
      res.json(post);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating scheduled post:", error);
      res.status(500).json({ message: "Failed to create scheduled post" });
    }
  });

  // Boost requests
  app.get('/api/boosts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const boosts = await storage.getUserBoostRequests(userId);
      res.json(boosts);
    } catch (error) {
      console.error("Error fetching boosts:", error);
      res.status(500).json({ message: "Failed to fetch boosts" });
    }
  });

  app.post('/api/boosts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check KYC verification - sellers must be verified before boosting products
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      if (!user.isVerified && !user.ninVerified) {
        return res.status(403).json({ 
          message: "Please complete identity verification before boosting products. Go to Settings > KYC Verification to get started." 
        });
      }
      
      const validated = createBoostSchema.parse(req.body);
      
      // Verify sufficient balance before deducting
      const wallet = await storage.getOrCreateWallet(userId);
      const currentBalance = parseFloat(wallet.balance);
      const boostCost = parseFloat(validated.amount);
      
      if (currentBalance < boostCost) {
        return res.status(400).json({ 
          message: `Insufficient balance. Available: ₦${currentBalance}, Required: ₦${boostCost}` 
        });
      }
      
      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + validated.duration);

      // Deduct from wallet first
      const updatedWallet = await storage.updateWalletBalance(userId, validated.amount, 'subtract');
      
      // Then create boost request
      const boost = await storage.createBoostRequest({
        productId: validated.productId,
        sellerId: userId,
        type: validated.type,
        duration: validated.duration,
        amount: validated.amount,
        expiresAt,
      });

      // Log transaction
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'boost_payment',
        amount: validated.amount,
        description: `${validated.type} listing for ${validated.duration} hours`,
        relatedProductId: validated.productId,
        status: 'completed',
      });

      res.json({ ...boost, newBalance: updatedWallet.balance });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating boost:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to create boost" });
    }
  });

  // Disputes
  app.get('/api/disputes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const disputes = await storage.getUserDisputes(userId);
      res.json(disputes);
    } catch (error) {
      console.error("Error fetching disputes:", error);
      res.status(500).json({ message: "Failed to fetch disputes" });
    }
  });

  app.post('/api/disputes', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = createDisputeSchema.parse({ ...req.body, buyerId: userId });
      const dispute = await storage.createDispute(validated);
      res.json(dispute);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating dispute:", error);
      res.status(500).json({ message: "Failed to create dispute" });
    }
  });

  // Support tickets
  app.get('/api/support', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const tickets = await storage.getUserSupportTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post('/api/support', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = createSupportTicketSchema.parse({ ...req.body, userId });
      const ticket = await storage.createSupportTicketWithNumber(validated);
      
      // Send email notification to admin
      try {
        const user = await storage.getUser(userId);
        await sendNewTicketNotificationToAdmin({
          id: ticket.id,
          ticketNumber: ticket.ticketNumber || undefined,
          subject: ticket.subject,
          description: ticket.message,
          priority: ticket.priority || 'medium',
          category: ticket.category || 'general',
          userName: user ? `${user.firstName} ${user.lastName}` : undefined,
          userEmail: user?.email || undefined,
        });
      } catch (emailError) {
        console.error("Failed to send ticket notification email:", emailError);
        // Don't fail the request if email fails
      }
      
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Get single ticket with replies
  app.get('/api/support/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const ticket = await storage.getSupportTicketById(id);
      
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Check if user owns the ticket or is admin
      if (ticket.userId !== userId && user.role !== 'admin') {
        return res.status(403).json({ message: "Not authorized to view this ticket" });
      }
      
      const replies = await storage.getTicketReplies(id);
      res.json({ ...ticket, replies });
    } catch (error) {
      console.error("Error fetching ticket:", error);
      res.status(500).json({ message: "Failed to fetch ticket" });
    }
  });

  // Add reply to ticket
  app.post('/api/support/:id/reply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id: ticketId } = req.params;
      const { message } = req.body;
      
      if (!message || message.trim().length < 5) {
        return res.status(400).json({ message: "Reply must be at least 5 characters" });
      }
      
      const ticket = await storage.getSupportTicketById(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Check if user exists and get their role
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const isAdmin = user.role === 'admin';
      
      // Check if user owns the ticket or is admin
      if (ticket.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to reply to this ticket" });
      }
      
      const reply = await storage.createTicketReply({
        ticketId,
        userId,
        message: message.trim(),
        isAdminReply: isAdmin,
      });
      
      // If admin replied, update ticket status to in_progress
      if (isAdmin) {
        await storage.updateSupportTicket(ticketId, { status: 'in_progress' });
      }
      
      // Send email notification for the reply
      try {
        if (isAdmin) {
          // Admin replied - notify the ticket owner
          const ticketOwner = await storage.getUser(ticket.userId);
          if (ticketOwner?.email) {
            await sendTicketReplyNotification(ticketOwner.email, {
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber || undefined,
              ticketSubject: ticket.subject,
              replyMessage: message.trim(),
              replierName: `${user.firstName} ${user.lastName}`,
              isAdminReply: true,
            });
          }
        } else {
          // User replied - notify admin about new activity
          await sendNewTicketNotificationToAdmin({
            id: ticket.id,
            ticketNumber: ticket.ticketNumber || undefined,
            subject: `Reply: ${ticket.subject}`,
            description: message.trim(),
            priority: ticket.priority || 'medium',
            category: ticket.category || 'general',
            userName: `${user.firstName} ${user.lastName}`,
            userEmail: user.email || undefined,
          });
        }
      } catch (emailError) {
        console.error("Failed to send reply notification email:", emailError);
        // Don't fail the request if email fails
      }
      
      // Return reply with user info
      res.json({
        ...reply,
        user: {
          id: user.id,
          username: user.username,
          profileImageUrl: user.profileImageUrl,
        }
      });
    } catch (error) {
      console.error("Error adding reply:", error);
      res.status(500).json({ message: "Failed to add reply" });
    }
  });

  // Create ticket from chatbot handoff
  app.post('/api/tickets/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { subject, message, category, chatHistory } = req.body;
      
      if (!message || message.trim().length < 10) {
        return res.status(400).json({ message: "Message must be at least 10 characters" });
      }
      
      // Create ticket with chat history context
      const fullMessage = chatHistory 
        ? `${message}\n\n--- Previous Chat Context ---\n${chatHistory}`
        : message;
      
      const ticket = await storage.createSupportTicketWithNumber({
        userId,
        subject: subject || "Issue from Chatbot",
        message: fullMessage,
        category: category || "technical",
        priority: "medium",
      });
      
      res.json({
        success: true,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        message: `Ticket ${ticket.ticketNumber} created successfully. You can track it in My Tickets.`,
      });
    } catch (error) {
      console.error("Error creating ticket from chatbot:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Check if user has open tickets (for chatbot)
  app.get('/api/tickets/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const openCount = await storage.getUserOpenTicketCount(userId);
      const tickets = await storage.getUserSupportTickets(userId);
      
      res.json({
        hasOpenTickets: openCount > 0,
        openTicketCount: openCount,
        recentTickets: tickets.slice(0, 5),
      });
    } catch (error) {
      console.error("Error checking ticket status:", error);
      res.status(500).json({ message: "Failed to check ticket status" });
    }
  });

  // Admin: Get all support tickets
  app.get('/api/admin/tickets', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { status, priority, category, page = 1, limit = 20 } = req.query;
      const allTickets = await storage.getAllSupportTickets();
      
      // Filter tickets based on query params
      let filteredTickets = allTickets;
      if (status) {
        filteredTickets = filteredTickets.filter(t => t.status === status);
      }
      if (priority) {
        filteredTickets = filteredTickets.filter(t => t.priority === priority);
      }
      if (category) {
        filteredTickets = filteredTickets.filter(t => t.category === category);
      }
      
      // Pagination
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;
      const paginatedTickets = filteredTickets.slice(offset, offset + limitNum);
      
      // Get user info for each ticket
      const ticketsWithUsers = await Promise.all(
        paginatedTickets.map(async (ticket) => {
          const ticketUser = await storage.getUser(ticket.userId);
          return {
            ...ticket,
            user: ticketUser ? { 
              id: ticketUser.id, 
              username: ticketUser.username, 
              email: ticketUser.email,
              profileImageUrl: ticketUser.profileImageUrl 
            } : null,
          };
        })
      );
      
      res.json({
        tickets: ticketsWithUsers,
        total: filteredTickets.length,
        page: pageNum,
        totalPages: Math.ceil(filteredTickets.length / limitNum),
      });
    } catch (error) {
      console.error("Error fetching admin tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  // Admin: Update ticket status/priority
  app.patch('/api/admin/tickets/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { id } = req.params;
      const { status, priority, assignedTo } = req.body;
      
      const updateData: any = {};
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      
      const ticket = await storage.updateSupportTicket(id, updateData);
      res.json(ticket);
    } catch (error) {
      console.error("Error updating ticket:", error);
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  // Admin: Get ticket stats
  app.get('/api/admin/tickets/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (user?.role !== 'admin') {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const allTickets = await storage.getAllSupportTickets();
      
      const stats = {
        total: allTickets.length,
        open: allTickets.filter(t => t.status === 'open').length,
        pending: allTickets.filter(t => t.status === 'pending').length,
        inProgress: allTickets.filter(t => t.status === 'in_progress').length,
        resolved: allTickets.filter(t => t.status === 'resolved').length,
        closed: allTickets.filter(t => t.status === 'closed').length,
        byPriority: {
          low: allTickets.filter(t => t.priority === 'low').length,
          medium: allTickets.filter(t => t.priority === 'medium').length,
          high: allTickets.filter(t => t.priority === 'high').length,
          urgent: allTickets.filter(t => t.priority === 'urgent').length,
        },
        byCategory: {
          technical: allTickets.filter(t => t.category === 'technical').length,
          payment: allTickets.filter(t => t.category === 'payment').length,
          account: allTickets.filter(t => t.category === 'account').length,
          scam_report: allTickets.filter(t => t.category === 'scam_report').length,
          general: allTickets.filter(t => t.category === 'general').length,
        },
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching ticket stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Seller analytics
  app.get('/api/seller/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const analytics = await storage.getOrCreateSellerAnalytics(userId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // WebSocket token endpoint - generates a signed token for WebSocket authentication
  app.get("/api/auth/ws-token", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Generate a short-lived JWT token (15 minutes)
      const token = jwt.sign(
        { userId, purpose: "websocket" },
        process.env.SESSION_SECRET!,
        { expiresIn: "15m" }
      );

      res.json({ token });
    } catch (error) {
      console.error("Error generating WebSocket token:", error);
      res.status(500).json({ message: "Failed to generate token" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Product routes
  app.get("/api/products", async (req, res) => {
    try {
      const { search, category, condition, location, sellerId } = req.query;
      const products = await storage.getProducts({
        search: search as string,
        categoryId: category as string,
        condition: condition as string,
        location: location as string,
        sellerId: sellerId as string,
      });
      
      // Include seller's location settings for distance calculation
      const productsWithSellerSettings = await Promise.all(
        products.map(async (product) => {
          try {
            const sellerSettings = await storage.getOrCreateUserSettings(product.sellerId);
            return {
              ...product,
              sellerSettings: sellerSettings.locationVisible ? {
                latitude: sellerSettings.latitude,
                longitude: sellerSettings.longitude,
                locationVisible: sellerSettings.locationVisible,
              } : null,
            };
          } catch (err) {
            return { ...product, sellerSettings: null };
          }
        })
      );
      
      res.json(productsWithSellerSettings);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/my-listings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const products = await storage.getSellerProducts(userId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/seller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const products = await storage.getSellerProducts(userId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Generate viewer ID for unique view tracking
      const userId = getUserId(req);
      let viewerId: string;
      
      if (userId) {
        // Use user ID for logged-in users
        viewerId = `user_${userId}`;
      } else {
        // For guests, create a hash from IP address and session ID
        const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
        const sessionId = req.sessionID || req.headers['user-agent'] || 'unknown';
        const combined = `${ip}_${sessionId}`;
        viewerId = `guest_${crypto.createHash('sha256').update(combined).digest('hex').substring(0, 32)}`;
      }
      
      // Record unique view (only increments if this viewer hasn't seen this product before)
      try {
        await storage.recordUniqueProductView(req.params.id, viewerId);
      } catch (viewError) {
        // Log but don't fail the request if view tracking fails
        console.error("Error recording product view:", viewError);
      }
      
      // Include seller's location settings for distance calculation
      let sellerSettings = null;
      try {
        const settings = await storage.getOrCreateUserSettings(product.sellerId);
        if (settings.locationVisible) {
          sellerSettings = {
            latitude: settings.latitude,
            longitude: settings.longitude,
            locationVisible: settings.locationVisible,
          };
        }
      } catch (err) {
        console.error("Error fetching seller settings:", err);
      }
      
      res.json({ ...product, sellerSettings });
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      if (user.role !== "seller" && user.role !== "admin") {
        return res.status(403).json({ 
          message: "Only sellers can create listings. Please update your role to 'Seller' in your profile settings." 
        });
      }

      // Check KYC verification - sellers must be verified before listing products
      if (!user.isVerified && !user.ninVerified) {
        return res.status(403).json({ 
          message: "Please complete identity verification before listing products. Go to Settings > KYC Verification to get started." 
        });
      }

      // Enforce email verification - unverified users can only create limited listings
      if (!user.emailVerified && user.role !== "admin" && !isSuperAdmin(userId)) {
        // Count user's existing products
        const existingProducts = await storage.getSellerProducts(userId);
        if (existingProducts.length >= MAX_LISTINGS_UNVERIFIED) {
          return res.status(403).json({ 
            message: `Please verify your email to create more listings. Unverified accounts are limited to ${MAX_LISTINGS_UNVERIFIED} listings.`,
            code: "EMAIL_NOT_VERIFIED",
            action: "verify_email"
          });
        }
      }

      // Parse the product data from FormData
      let productData;
      try {
        productData = JSON.parse(req.body.data || "{}");
      } catch (parseError) {
        return res.status(400).json({ message: "Invalid product data format" });
      }

      // Validate with Zod schema
      const validationResult = insertProductSchema.safeParse(productData);
      if (!validationResult.success) {
        const errors = validationResult.error.flatten();
        const errorMessages = Object.entries(errors.fieldErrors)
          .map(([field, msgs]) => `${field}: ${(msgs as string[]).join(", ")}`)
          .join("; ");
        console.log("Product validation failed:", errors);
        return res.status(400).json({ 
          message: errorMessages || "Validation failed",
          errors: errors.fieldErrors
        });
      }

      const validated = validationResult.data;

      // Upload images to object storage
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "At least one product image is required" });
      }

      const prefix = `products/${userId}/`;
      const images = await uploadMultipleToObjectStorage(files, prefix);
      
      if (images.length === 0) {
        return res.status(500).json({ message: "Failed to upload product images" });
      }

      const product = await storage.createProduct({
        ...validated,
        sellerId: userId,
        images,
      });

      res.json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(500).json({ message: error.message || "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check ownership
      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.sellerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const productData = JSON.parse(req.body.data || "{}");
      
      // Upload new images to object storage if any
      const files = req.files as Express.Multer.File[];
      let newImages: string[] = [];
      
      if (files && files.length > 0) {
        const prefix = `products/${userId}/`;
        newImages = await uploadMultipleToObjectStorage(files, prefix);
      }

      // Handle images: use client-provided images (with removed ones excluded) + new uploads
      const clientImages = productData.images || existing.images || [];
      const finalImages = [...clientImages, ...newImages];

      const updateData = {
        ...productData,
        images: finalImages.length > 0 ? finalImages : existing.images,
      };

      const updated = await storage.updateProduct(req.params.id, updateData);
      res.json(updated);
    } catch (error: any) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: error.message || "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const product = await storage.getProduct(req.params.id);
      if (!product || product.sellerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      await storage.deleteProduct(req.params.id);
      res.json({ message: "Product deleted" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Mark product as sold
  app.post("/api/products/:id/sold", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const product = await storage.getProduct(req.params.id);
      if (!product || product.sellerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateProduct(req.params.id, {
        isSold: true,
        isAvailable: false,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error marking product as sold:", error);
      res.status(500).json({ message: "Failed to mark product as sold" });
    }
  });

  // Toggle product availability (pause/unpause)
  app.post("/api/products/:id/toggle-visibility", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const product = await storage.getProduct(req.params.id);
      if (!product || product.sellerId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateProduct(req.params.id, {
        isAvailable: !product.isAvailable,
      });
      res.json(updated);
    } catch (error) {
      console.error("Error toggling product visibility:", error);
      res.status(500).json({ message: "Failed to toggle product visibility" });
    }
  });

  // Get seller products with analytics (inquiries count)
  app.get("/api/seller/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const products = await storage.getSellerProductsWithAnalytics(userId);
      res.json(products);
    } catch (error) {
      console.error("Error fetching seller products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Online status endpoint - returns which users are currently online
  app.get("/api/users/online-status", async (req, res) => {
    try {
      const onlineUserIds = getOnlineUserIds();
      res.json({ onlineUserIds });
    } catch (error) {
      console.error("Error fetching online status:", error);
      res.status(500).json({ message: "Failed to fetch online status" });
    }
  });

  // User profile routes
  app.get("/api/users/:id", async (req: any, res) => {
    try {
      const targetUserId = req.params.id;
      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if the viewer is authenticated and if they're blocked by the target user
      const viewerId = getUserId(req);
      if (viewerId && viewerId !== targetUserId) {
        // Check if the target user has blocked the viewer
        const isBlockedByTarget = await storage.isUserBlocked(targetUserId, viewerId);
        
        if (isBlockedByTarget) {
          // Return limited info when blocked
          return res.json({
            id: user.id,
            firstName: "Blocked User",
            lastName: "",
            profileImageUrl: null,
            isBlocked: true,
            blockedByUser: true,
          });
        }
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.put("/api/users/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId || userId !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.updateUserProfile(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Image upload endpoint - now uses object storage for persistence
  app.post("/api/upload", isAuthenticated, upload.single("image"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      const userId = getUserId(req);
      const prefix = userId ? `profiles/${userId}/` : "uploads/";
      
      // Upload to object storage - returns Cloudinary URL or local path
      const imageUrl = await uploadToObjectStorage(req.file, prefix);
      
      if (!imageUrl) {
        return res.status(500).json({ message: "Failed to upload image to storage" });
      }

      res.json({ url: imageUrl });
    } catch (error) {
      console.error("Error uploading image:", error);
      res.status(500).json({ message: "Failed to upload image" });
    }
  });

  // Update profile image
  app.put("/api/users/:id/profile-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId || userId !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { profileImageUrl } = req.body;
      if (!profileImageUrl) {
        return res.status(400).json({ message: "Profile image URL is required" });
      }

      const updated = await storage.updateUserProfile(req.params.id, { profileImageUrl });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating profile image:", error);
      res.status(500).json({ message: "Failed to update profile image" });
    }
  });

  // Update cover image
  app.put("/api/users/:id/cover-image", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId || userId !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { coverImageUrl } = req.body;
      if (!coverImageUrl) {
        return res.status(400).json({ message: "Cover image URL is required" });
      }

      const updated = await storage.updateUserProfile(req.params.id, { coverImageUrl });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating cover image:", error);
      res.status(500).json({ message: "Failed to update cover image" });
    }
  });

  // Update user role
  app.put("/api/users/:id/role", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId || userId !== req.params.id) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const validationResult = roleUpdateSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid role",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { role } = validationResult.data;

      const updated = await storage.updateUserProfile(req.params.id, { role });
      const { password: _, ...safeUser } = updated;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update role" });
    }
  });

  // User self-verification route
  app.post("/api/users/verify-account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { phoneNumber, location, ninNumber } = req.body;

      // Validate that at least one verification method is provided
      if (!phoneNumber && !location && !ninNumber) {
        return res.status(400).json({ 
          message: "Please provide at least one verification field (phone number, location, or NIN)" 
        });
      }

      // Build update data
      const updateData: Record<string, any> = {
        isVerified: true,
      };

      // Build verification badges array
      const existingUser = await storage.getUser(userId);
      const existingBadges = existingUser?.verificationBadges || [];
      const newBadges = [...existingBadges];

      if (phoneNumber && phoneNumber.trim()) {
        updateData.phoneNumber = phoneNumber.trim();
        if (!newBadges.includes("phone")) {
          newBadges.push("phone");
        }
      }

      if (location && location.trim()) {
        updateData.location = location.trim();
        if (!newBadges.includes("location")) {
          newBadges.push("location");
        }
      }

      if (ninNumber && ninNumber.trim()) {
        // Store NIN hash for security (don't store actual NIN)
        const crypto = await import("crypto");
        const ninHash = crypto.createHash("sha256").update(ninNumber.trim()).digest("hex");
        updateData.ninHash = ninHash;
        updateData.ninVerified = true;
        updateData.ninVerificationDate = new Date();
        if (!newBadges.includes("nin")) {
          newBadges.push("nin");
        }
      }

      updateData.verificationBadges = newBadges;

      const updated = await storage.updateUserProfile(userId, updateData);
      const { password: _, ...safeUser } = updated;
      
      console.log(`User ${userId} verified with badges: ${newBadges.join(", ")}`);
      res.json(safeUser);
    } catch (error: any) {
      console.error("Error verifying user account:", error);
      res.status(500).json({ message: error.message || "Failed to verify account" });
    }
  });

  // Helper to check if a user is the system account
  function isSystemAccount(userId: string): boolean {
    const systemUserId = process.env.SYSTEM_USER_ID;
    return systemUserId ? userId === systemUserId : false;
  }

  // Follow routes
  app.post("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetUserId = req.params.id;
      
      // Prevent regular users from following the system account
      // (System account should only be auto-followed during registration)
      if (isSystemAccount(targetUserId) && !isSystemAccount(userId)) {
        return res.status(403).json({ 
          message: "You cannot follow the official Campus Hub account. You are already following it!" 
        });
      }
      
      const follow = await storage.followUser(userId, targetUserId);
      
      // Create notification for the followed user
      const follower = await storage.getUser(userId);
      const followedUser = await storage.getUser(targetUserId);
      
      if (follower && followedUser && targetUserId !== userId) {
        const followerName = follower.firstName && follower.lastName 
          ? `${follower.firstName} ${follower.lastName}` 
          : follower.email;
        
        await createAndBroadcastNotification({
          userId: targetUserId,
          type: "follow",
          title: "New Follower",
          message: `${followerName} started following you`,
          link: `/profile/${userId}`,
          relatedUserId: userId,
        });
        
        // Send email notification to the followed user
        try {
          await sendNewFollowerEmail(
            followedUser.email,
            followerName,
            follower.username || follower.email.split('@')[0]
          );
          console.log(`New follower email sent to ${followedUser.email}`);
        } catch (emailError: any) {
          console.error("Error sending new follower email:", emailError.message);
        }
      }
      
      res.json(follow);
    } catch (error: any) {
      console.error("Error following user:", error);
      res.status(400).json({ message: error.message || "Failed to follow user" });
    }
  });

  app.delete("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.unfollowUser(userId, req.params.id);
      res.json({ message: "Unfollowed successfully" });
    } catch (error) {
      console.error("Error unfollowing user:", error);
      res.status(500).json({ message: "Failed to unfollow user" });
    }
  });

  app.get("/api/users/:id/followers", async (req, res) => {
    try {
      const followers = await storage.getFollowers(req.params.id);
      res.json(followers);
    } catch (error) {
      console.error("Error fetching followers:", error);
      res.status(500).json({ message: "Failed to fetch followers" });
    }
  });

  app.get("/api/users/:id/following", async (req, res) => {
    try {
      const following = await storage.getFollowing(req.params.id);
      res.json(following);
    } catch (error) {
      console.error("Error fetching following:", error);
      res.status(500).json({ message: "Failed to fetch following" });
    }
  });

  app.get("/api/users/:id/follow-stats", async (req, res) => {
    try {
      const userId = getUserId(req);
      const [followerCount, followingCount, isFollowing] = await Promise.all([
        storage.getFollowerCount(req.params.id),
        storage.getFollowingCount(req.params.id),
        userId ? storage.isFollowing(userId, req.params.id) : Promise.resolve(false),
      ]);

      res.json({
        followerCount,
        followingCount,
        isFollowing,
      });
    } catch (error) {
      console.error("Error fetching follow stats:", error);
      res.status(500).json({ message: "Failed to fetch follow stats" });
    }
  });

  // Block user route
  app.post("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetUserId = req.params.id;
      
      if (userId === targetUserId) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }

      // Create block relationship
      await storage.blockUser(userId, targetUserId);
      
      // Also unfollow in both directions
      try {
        await storage.unfollowUser(userId, targetUserId);
        await storage.unfollowUser(targetUserId, userId);
      } catch (e) {
        // Ignore errors if not following
      }

      res.json({ message: "User blocked successfully" });
    } catch (error: any) {
      console.error("Error blocking user:", error);
      res.status(400).json({ message: error.message || "Failed to block user" });
    }
  });

  // Unblock user route
  app.delete("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.unblockUser(userId, req.params.id);
      res.json({ message: "User unblocked successfully" });
    } catch (error: any) {
      console.error("Error unblocking user:", error);
      res.status(400).json({ message: error.message || "Failed to unblock user" });
    }
  });

  // Report user route
  app.post("/api/users/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetUserId = req.params.id;
      const { reason, description } = req.body;

      if (userId === targetUserId) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }

      if (!reason) {
        return res.status(400).json({ message: "Report reason is required" });
      }

      await storage.reportUser(userId, targetUserId, reason, description || "");
      res.json({ message: "Report submitted successfully" });
    } catch (error: any) {
      console.error("Error reporting user:", error);
      res.status(400).json({ message: error.message || "Failed to submit report" });
    }
  });

  // Get blocked users route
  app.get("/api/blocked-users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const blockedUsersWithRelation = await storage.getBlockedUsers(userId);
      
      // Return just the blocked user info that the frontend expects
      const blockedUsers = blockedUsersWithRelation.map(block => ({
        id: block.blockedUser.id,
        firstName: block.blockedUser.firstName,
        lastName: block.blockedUser.lastName,
        profileImageUrl: block.blockedUser.profileImageUrl,
        email: block.blockedUser.email,
      }));
      
      res.json(blockedUsers);
    } catch (error: any) {
      console.error("Error getting blocked users:", error);
      res.status(500).json({ message: "Failed to get blocked users" });
    }
  });

  // Message routes
  app.get("/api/messages/threads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const threads = await storage.getMessageThreads(userId);
      
      // Filter out threads where either user has blocked the other
      const filteredThreads = [];
      for (const thread of threads) {
        // Storage returns 'user' property, not 'otherUser'
        const otherUserId = thread.user?.id;
        if (!otherUserId) continue;
        
        // Skip block checks for system account threads
        if (isSystemAccount(otherUserId)) {
          filteredThreads.push(thread);
          continue;
        }
        
        const [userBlockedOther, otherBlockedUser] = await Promise.all([
          storage.isUserBlocked(userId, otherUserId),
          storage.isUserBlocked(otherUserId, userId),
        ]);
        
        // Only include threads where neither user has blocked the other
        if (!userBlockedOther && !otherBlockedUser) {
          filteredThreads.push(thread);
        }
      }
      
      res.json(filteredThreads);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
    }
  });

  app.get("/api/messages/unread-count", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const count = await storage.getTotalUnreadMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  app.get("/api/messages/:otherUserId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const messages = await storage.getMessageThread(userId, req.params.otherUserId);
      
      // Mark messages as read
      await storage.markMessagesAsRead(userId, req.params.otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Helper: Check if message contains support keywords
  function containsSupportKeywords(content: string): boolean {
    const supportKeywords = ['help', 'support', 'agent', 'human', 'assistance', 'problem', 'issue', 'complaint', 'refund', 'dispute'];
    const lowerContent = content.toLowerCase();
    return supportKeywords.some(keyword => lowerContent.includes(keyword));
  }

  // Track recent support tickets per user to prevent spam (userId -> lastTicketTime)
  const recentSupportTickets = new Map<string, number>();
  const SUPPORT_TICKET_COOLDOWN_MS = 5 * 60 * 1000; // 5 minute cooldown between auto-tickets

  // Helper: Generate AI response for system account using Groq (async, non-blocking)
  async function processSystemAccountMessage(userMessage: string, userId: string, productId?: string | null): Promise<void> {
    const systemUserId = process.env.SYSTEM_USER_ID;
    if (!systemUserId) return;

    try {
      // Get user info for context
      const user = await storage.getUser(userId);
      const userName = user?.firstName || 'there';

      // Use the existing chatbot function
      const response = await getChatbotResponseWithHandoff(
        [{ role: 'user', content: userMessage }],
        { 
          userId, 
          role: user?.role || 'buyer',
          currentPage: 'messages' 
        }
      );

      // Build AI response message
      let aiResponse: string;
      if (response.shouldHandoff) {
        aiResponse = `Hey ${userName}! I noticed you might need some extra help with this. ${response.message}\n\nIf you need to speak with a human agent, please create a support ticket from the Help section. Our team will get back to you within 24 hours!`;
      } else {
        aiResponse = response.message;
      }

      // Create the AI response message from system account
      const aiMessage = await storage.createMessage({
        senderId: systemUserId,
        receiverId: userId,
        content: aiResponse,
        productId: productId || undefined,
      });

      // Broadcast via websocket so user sees the response immediately
      const userConnections = wsConnections.get(userId);
      if (userConnections) {
        const wsMessage = JSON.stringify({
          type: "new_message",
          message: aiMessage,
        });
        userConnections.forEach(ws => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(wsMessage);
          }
        });
      }

      // Create notification for the AI response
      const systemAccount = await storage.getUser(systemUserId);
      if (systemAccount) {
        await createAndBroadcastNotification({
          userId,
          type: "message",
          title: "New Message from Campus Hub",
          message: aiResponse.substring(0, 80) + (aiResponse.length > 80 ? "..." : ""),
          link: `/messages?user=${systemUserId}`,
          relatedUserId: systemUserId,
        });
      }

    } catch (error) {
      console.error("AI response generation error:", error);
      // On failure, send a fallback message
      try {
        const fallbackMessage = await storage.createMessage({
          senderId: systemUserId,
          receiverId: userId,
          content: "Hey! Thanks for reaching out to Campus Hub. I'm having a small technical glitch right now. Please try again in a moment, or create a support ticket from the Help section if you need immediate assistance.",
          productId: productId || undefined,
        });
        
        // Broadcast fallback via websocket
        const userConnections = wsConnections.get(userId);
        if (userConnections) {
          const wsMessage = JSON.stringify({
            type: "new_message",
            message: fallbackMessage,
          });
          userConnections.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(wsMessage);
            }
          });
        }
      } catch (fallbackError) {
        console.error("Failed to send fallback AI message:", fallbackError);
      }
    }
  }

  // Helper: Create support ticket with cooldown check
  async function maybeCreateSupportTicket(userId: string, content: string): Promise<void> {
    // Check cooldown
    const lastTicketTime = recentSupportTickets.get(userId);
    const now = Date.now();
    
    if (lastTicketTime && (now - lastTicketTime) < SUPPORT_TICKET_COOLDOWN_MS) {
      console.log(`Skipping auto-ticket for user ${userId} - cooldown active`);
      return;
    }

    try {
      await storage.createSupportTicket({
        userId,
        subject: `Auto-generated from DM: ${content.substring(0, 50)}...`,
        message: content,
        category: 'general',
        priority: 'medium',
      });
      recentSupportTickets.set(userId, now);
      console.log(`Auto-created support ticket for user ${userId}`);
    } catch (ticketError) {
      console.error("Failed to auto-create support ticket:", ticketError);
    }
  }

  app.post("/api/messages", isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertMessageSchema.parse({
        senderId: userId,
        ...req.body,
      });

      // Check if either user has blocked the other (skip for system account messages)
      if (!isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          storage.isUserBlocked(userId, validated.receiverId),
          storage.isUserBlocked(validated.receiverId, userId),
        ]);
        
        if (senderBlockedReceiver || receiverBlockedSender) {
          return res.status(403).json({ message: "You cannot message this user" });
        }
      }

      // Save the user's message
      const message = await storage.createMessage(validated);
      
      // Check if messaging the system account - trigger async AI response (non-blocking)
      if (isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
        // Fire-and-forget: Process AI response and support tickets asynchronously
        setImmediate(() => {
          // Check for support keywords to auto-create support ticket (with cooldown)
          if (containsSupportKeywords(validated.content)) {
            maybeCreateSupportTicket(userId, validated.content).catch(err => {
              console.error("Support ticket creation failed:", err);
            });
          }

          // Generate and send AI response from system account
          processSystemAccountMessage(validated.content, userId, validated.productId).catch(err => {
            console.error("System account AI response failed:", err);
          });
        });
      } else {
        // Regular message - Create notification for the message receiver
        if (validated.receiverId && validated.receiverId !== userId) {
          const sender = await storage.getUser(userId);
          const receiver = await storage.getUser(validated.receiverId);
          if (sender && receiver) {
            const senderName = sender.firstName && sender.lastName 
              ? `${sender.firstName} ${sender.lastName}` 
              : sender.email;
            
            // Truncate message content for notification
            const messagePreview = validated.content.length > 50 
              ? validated.content.substring(0, 50) + "..." 
              : validated.content;
            
            await createAndBroadcastNotification({
              userId: validated.receiverId,
              type: "message",
              title: "New Message",
              message: `${senderName}: ${messagePreview}`,
              link: `/messages?user=${userId}`,
              relatedUserId: userId,
              relatedProductId: validated.productId || undefined,
            });

            // Send enhanced email notification with product/order context
            (async () => {
              try {
                // Check if message is related to a product
                let product = null;
                let relatedOrder = null;
                
                if (validated.productId) {
                  product = await storage.getProduct(validated.productId);
                  
                  // Check if there's an active order between these users for this product
                  const senderOrders = await storage.getBuyerOrders(userId);
                  const receiverOrders = await storage.getSellerOrders(validated.receiverId);
                  
                  // Find any order where sender is buyer and receiver is seller (or vice versa)
                  relatedOrder = senderOrders.find((o: Order) => 
                    o.productId === validated.productId && 
                    o.sellerId === validated.receiverId &&
                    !['completed', 'cancelled', 'refunded'].includes(o.status)
                  ) || receiverOrders.find((o: Order) =>
                    o.productId === validated.productId && 
                    o.buyerId === userId &&
                    !['completed', 'cancelled', 'refunded'].includes(o.status)
                  );
                }
                
                // Check if this is a reply (existing conversation)
                const existingMessages = await storage.getMessageThread(userId, validated.receiverId);
                const isReply = existingMessages.length > 1; // More than just this message
                
                // Send order-specific email if there's an active order
                if (relatedOrder && product) {
                  const isBuyerMessage = relatedOrder.buyerId === userId;
                  await sendOrderMessageNotification(receiver.email, {
                    senderName,
                    senderId: userId,
                    messagePreview: validated.content,
                    orderId: relatedOrder.id,
                    productName: product.title,
                    productId: validated.productId || undefined,
                    orderStatus: relatedOrder.status,
                    isBuyerMessage,
                  });
                } else if (isReply) {
                  // Send reply notification with product context if available
                  await sendMessageReplyNotification(receiver.email, {
                    senderName,
                    senderId: userId,
                    messagePreview: validated.content,
                    productName: product?.title,
                    productId: validated.productId || undefined,
                  });
                } else {
                  // Send regular message notification with enhanced context
                  await sendMessageNotification(receiver.email, senderName, {
                    messagePreview: validated.content,
                    productName: product?.title,
                    productId: validated.productId || undefined,
                    senderId: userId,
                    isReply: false,
                  });
                }
              } catch (emailErr) {
                console.error("Failed to send message email notification:", emailErr);
              }
            })();
          }
        }
      }
      
      res.json(message);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  // Message with image attachment route
  app.post("/api/messages/with-attachment", isAuthenticated, requireEmailVerified, upload.single("attachment"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let imageUrl: string | null = null;

      // Upload image if provided
      if (req.file) {
        imageUrl = await uploadToObjectStorage(req.file, "message-attachments/");
        if (!imageUrl) {
          return res.status(500).json({ message: "Failed to upload attachment" });
        }
      }

      // Parse the message data from form body
      const { receiverId, content, productId } = req.body;

      if (!receiverId) {
        return res.status(400).json({ message: "Receiver ID is required" });
      }

      // Check if either user has blocked the other (skip for system account messages)
      if (!isSystemAccount(receiverId) && !isSystemAccount(userId)) {
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          storage.isUserBlocked(userId, receiverId),
          storage.isUserBlocked(receiverId, userId),
        ]);
        
        if (senderBlockedReceiver || receiverBlockedSender) {
          return res.status(403).json({ message: "You cannot message this user" });
        }
      }

      // Content is optional if there's an image
      const messageContent = content || (imageUrl ? "[Image]" : "");
      if (!messageContent && !imageUrl) {
        return res.status(400).json({ message: "Message content or attachment is required" });
      }

      const validated = insertMessageSchema.parse({
        senderId: userId,
        receiverId,
        content: messageContent,
        imageUrl,
        productId: productId || null,
      });

      const message = await storage.createMessage(validated);
      
      // Check if messaging the system account - trigger async AI response (non-blocking)
      if (isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
        // Fire-and-forget: Process AI response and support tickets asynchronously
        setImmediate(() => {
          if (containsSupportKeywords(validated.content)) {
            maybeCreateSupportTicket(userId, validated.content).catch(err => {
              console.error("Support ticket creation failed:", err);
            });
          }

          processSystemAccountMessage(validated.content, userId, validated.productId).catch(err => {
            console.error("System account AI response failed:", err);
          });
        });
      }
      
      // Create notification for the message receiver (except for system account)
      if (validated.receiverId && validated.receiverId !== userId && !isSystemAccount(validated.receiverId)) {
        const sender = await storage.getUser(userId);
        const receiver = await storage.getUser(validated.receiverId);
        if (sender && receiver) {
          const senderName = sender.firstName && sender.lastName 
            ? `${sender.firstName} ${sender.lastName}` 
            : sender.email;
          
          // Notification message preview
          const messagePreview = imageUrl 
            ? "Sent you an image" 
            : (validated.content.length > 50 
              ? validated.content.substring(0, 50) + "..." 
              : validated.content);
          
          await createAndBroadcastNotification({
            userId: validated.receiverId,
            type: "message",
            title: "New Message",
            message: `${senderName}: ${messagePreview}`,
            link: `/messages?user=${userId}`,
            relatedUserId: userId,
            relatedProductId: validated.productId || undefined,
          });

          // Send enhanced email notification with product/order context
          (async () => {
            try {
              let product = null;
              let relatedOrder = null;
              
              if (validated.productId) {
                product = await storage.getProduct(validated.productId);
                
                const senderOrders = await storage.getBuyerOrders(userId);
                const receiverOrders = await storage.getSellerOrders(validated.receiverId);
                
                relatedOrder = senderOrders.find((o: Order) => 
                  o.productId === validated.productId && 
                  o.sellerId === validated.receiverId &&
                  !['completed', 'cancelled', 'refunded'].includes(o.status)
                ) || receiverOrders.find((o: Order) =>
                  o.productId === validated.productId && 
                  o.buyerId === userId &&
                  !['completed', 'cancelled', 'refunded'].includes(o.status)
                );
              }
              
              const existingMessages = await storage.getMessageThread(userId, validated.receiverId);
              const isReply = existingMessages.length > 1;
              
              const emailMessagePreview = imageUrl ? "[Image attachment]" : validated.content;
              
              if (relatedOrder && product) {
                const isBuyerMessage = relatedOrder.buyerId === userId;
                await sendOrderMessageNotification(receiver.email, {
                  senderName,
                  senderId: userId,
                  messagePreview: emailMessagePreview,
                  orderId: relatedOrder.id,
                  productName: product.title,
                  productId: validated.productId || undefined,
                  orderStatus: relatedOrder.status,
                  isBuyerMessage,
                });
              } else if (isReply) {
                await sendMessageReplyNotification(receiver.email, {
                  senderName,
                  senderId: userId,
                  messagePreview: emailMessagePreview,
                  productName: product?.title,
                  productId: validated.productId || undefined,
                });
              } else {
                await sendMessageNotification(receiver.email, senderName, {
                  messagePreview: emailMessagePreview,
                  productName: product?.title,
                  productId: validated.productId || undefined,
                  senderId: userId,
                  isReply: false,
                });
              }
            } catch (emailErr) {
              console.error("Failed to send message email notification:", emailErr);
            }
          })();
        }
      }
      
      res.json(message);
    } catch (error: any) {
      console.error("Error creating message with attachment:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  // Delete message route (only own messages)
  app.delete("/api/messages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteMessage(req.params.id, userId);
      res.json({ message: "Message deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting message:", error);
      res.status(400).json({ message: error.message || "Failed to delete message" });
    }
  });

  // Message reactions routes
  app.post("/api/messages/:id/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { reaction } = req.body;
      const validReactions = ['heart', 'thumbs_up', 'laugh', 'surprised', 'sad', 'angry'];
      
      if (!reaction || !validReactions.includes(reaction)) {
        return res.status(400).json({ message: "Invalid reaction. Valid reactions are: " + validReactions.join(", ") });
      }

      const messageReaction = await storage.addMessageReaction(req.params.id, userId, reaction);
      res.json(messageReaction);
    } catch (error: any) {
      console.error("Error adding reaction:", error);
      res.status(400).json({ message: error.message || "Failed to add reaction" });
    }
  });

  app.delete("/api/messages/:id/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.removeMessageReaction(req.params.id, userId);
      res.json({ message: "Reaction removed successfully" });
    } catch (error: any) {
      console.error("Error removing reaction:", error);
      res.status(400).json({ message: error.message || "Failed to remove reaction" });
    }
  });

  app.get("/api/messages/:id/reactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const reactions = await storage.getMessageReactions(req.params.id);
      res.json(reactions);
    } catch (error: any) {
      console.error("Error getting reactions:", error);
      res.status(500).json({ message: "Failed to get reactions" });
    }
  });

  // Read receipts route
  app.get("/api/messages/read-receipts/:messageId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const receipts = await storage.getReadReceipts(req.params.messageId);
      res.json(receipts);
    } catch (error: any) {
      console.error("Error getting read receipts:", error);
      res.status(500).json({ message: "Failed to get read receipts" });
    }
  });

  // Conversation archive routes
  app.get("/api/conversations/archived", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const archived = await storage.getArchivedConversations(userId);
      res.json(archived);
    } catch (error: any) {
      console.error("Error getting archived conversations:", error);
      res.status(500).json({ message: "Failed to get archived conversations" });
    }
  });

  app.post("/api/conversations/:userId/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const archived = await storage.archiveConversation(userId, req.params.userId);
      res.json(archived);
    } catch (error: any) {
      console.error("Error archiving conversation:", error);
      res.status(400).json({ message: error.message || "Failed to archive conversation" });
    }
  });

  app.delete("/api/conversations/:userId/archive", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.unarchiveConversation(userId, req.params.userId);
      res.json({ message: "Conversation unarchived successfully" });
    } catch (error: any) {
      console.error("Error unarchiving conversation:", error);
      res.status(400).json({ message: error.message || "Failed to unarchive conversation" });
    }
  });

  // Mark messages as read route
  app.post("/api/conversations/:userId/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markMessagesAsRead(userId, req.params.userId);
      res.json({ message: "Messages marked as read" });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(400).json({ message: error.message || "Failed to mark messages as read" });
    }
  });

  // Disappearing messages routes
  app.post("/api/conversations/:userId/disappearing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { duration } = req.body;
      const validDurations = [0, 86400, 604800, 7776000]; // off, 24h, 7d, 90d in seconds
      
      if (duration === undefined || !validDurations.includes(Number(duration))) {
        return res.status(400).json({ message: "Invalid duration. Valid durations are: 0 (off), 86400 (24h), 604800 (7d), 7776000 (90d)" });
      }

      const setting = await storage.setDisappearingMessages(userId, req.params.userId, Number(duration));
      res.json(setting);
    } catch (error: any) {
      console.error("Error setting disappearing messages:", error);
      res.status(400).json({ message: error.message || "Failed to set disappearing messages" });
    }
  });

  app.get("/api/conversations/:userId/disappearing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const setting = await storage.getDisappearingMessageSettings(userId, req.params.userId);
      res.json(setting || { isEnabled: false, duration: 0 });
    } catch (error: any) {
      console.error("Error getting disappearing message settings:", error);
      res.status(500).json({ message: "Failed to get disappearing message settings" });
    }
  });

  // Review routes
  app.get("/api/reviews/:userId", async (req, res) => {
    try {
      const reviews = await storage.getUserReviews(req.params.userId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertReviewSchema.parse({
        reviewerId: userId,
        ...req.body,
      });

      const review = await storage.createReview(validated);
      res.json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(400).json({ message: error.message || "Failed to create review" });
    }
  });

  // Watchlist routes
  app.post("/api/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertWatchlistSchema.parse({
        userId,
        productId: req.body.productId,
      });

      const watchlistItem = await storage.addToWatchlist(validated.userId, validated.productId);
      res.json(watchlistItem);
    } catch (error: any) {
      console.error("Error adding to watchlist:", error);
      res.status(400).json({ message: error.message || "Failed to add to watchlist" });
    }
  });

  app.get("/api/watchlist", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const watchlist = await storage.getUserWatchlist(userId);
      res.json(watchlist);
    } catch (error) {
      console.error("Error fetching watchlist:", error);
      res.status(500).json({ message: "Failed to fetch watchlist" });
    }
  });

  app.delete("/api/watchlist/:productId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.removeFromWatchlist(userId, req.params.productId);
      res.json({ message: "Removed from watchlist" });
    } catch (error: any) {
      console.error("Error removing from watchlist:", error);
      if (error.message === "Watchlist item not found") {
        return res.status(404).json({ message: "Watchlist item not found" });
      }
      res.status(500).json({ message: "Failed to remove from watchlist" });
    }
  });

  // Get wishlist with full product and seller details
  app.get("/api/wishlist/full", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const wishlistWithProducts = await storage.getWishlistWithProducts(userId);
      res.json(wishlistWithProducts);
    } catch (error) {
      console.error("Error fetching wishlist with products:", error);
      res.status(500).json({ message: "Failed to fetch wishlist" });
    }
  });

  // Report routes
  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertReportSchema.parse({
        reporterId: userId,
        ...req.body,
      });

      const report = await storage.createReport(validated);
      res.json(report);
    } catch (error: any) {
      console.error("Error creating report:", error);
      res.status(400).json({ message: error.message || "Failed to create report" });
    }
  });

  // ==================== AI CHATBOT ROUTES ====================
  
  // Zod schema for chatbot request validation
  const chatbotRequestSchema = z.object({
    message: z.string().min(1).max(2000),
    currentPage: z.string().optional(),
    conversationHistory: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string()
    })).optional(),
  });
  
  app.post("/api/chatbot", async (req: any, res) => {
    try {
      // Validate request
      const validated = chatbotRequestSchema.parse(req.body);
      
      const userMessage = validated.message;
      const currentPage = validated.currentPage;
      const history = validated.conversationHistory || [];

      // Get user context if authenticated
      let userContext;
      const userId = getUserId(req);
      if (userId) {
        const user = await storage.getUser(userId);
        if (user) {
          userContext = {
            role: user.role,
            isVerified: user.isVerified ?? undefined,
            trustScore: user.trustScore ?? undefined,
            currentPage: currentPage,
            userId: userId,
          };
        }
      } else if (currentPage) {
        userContext = { currentPage };
      }

      // Check for payment scam patterns in the user message
      const hasPaymentWarning = checkForPaymentScam(userMessage);

      // Build conversation with history for handoff detection
      const trustedMessages: ChatMessage[] = [
        ...history.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user" as const, content: userMessage }
      ];

      // Use the handoff-aware response function
      const response = await getChatbotResponseWithHandoff(trustedMessages, userContext);

      res.json({
        message: response.message,
        hasPaymentWarning,
        shouldHandoff: response.shouldHandoff,
        handoffReason: response.handoffReason,
        suggestedCategory: response.suggestedCategory,
        frustrationLevel: response.frustrationLevel,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid input - message required and must be under 2000 characters" 
        });
      }
      console.error("Chatbot error:", error);
      res.status(500).json({ 
        message: "Omo, something don wrong. The AI bot no dey available now. Try again later or contact support!",
        error: error.message 
      });
    }
  });

  // Quick help endpoint for common questions
  app.get("/api/chatbot/quick-help", async (req: any, res) => {
    try {
      const topic = req.query.topic as string;
      
      const quickResponses: Record<string, string> = {
        "how-to-sell": "To sell something: 1) Go to 'Sell' page 2) Upload clear photos 3) Add title, description, price 4) Choose category and condition 5) Post! Your item will be live immediately. Want to boost it for more visibility? That's ₦500-₦2000.",
        "safety": "🚨 SAFETY RULES:\n✅ ALWAYS use escrow for payments\n✅ Check seller's trust score and badges\n✅ Report suspicious users\n🚫 NEVER pay outside the app\n🚫 Don't share bank details in chat\n\nIf someone asks you to pay outside the app = SCAM! Report them immediately.",
        "escrow": "Escrow keeps your money SAFE! When you buy: 1) Your money is held by the app 2) Seller ships item 3) You confirm you got it 4) Money releases to seller. We charge 3-6% for this protection. Worth it to avoid scams!",
        "verification": "Get verified to build trust! Available badges:\n✅ Verified Student - Upload student ID\n✅ NIN Verified - Verify government ID\n⭐ Trusted Seller - Earn through good sales\n\nGo to Profile > Verification to start!",
      };

      const response = quickResponses[topic] || "No quick help available for this topic. Use the chat for detailed help!";
      res.json({ message: response });
    } catch (error) {
      console.error("Quick help error:", error);
      res.status(500).json({ message: "Failed to get quick help" });
    }
  });

  // Notifications API routes
  app.get("/api/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const notifications = await storage.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markNotificationAsRead(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markNotificationAsRead(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark notification as read" });
    }
  });

  app.put("/api/notifications/read-all", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.deleteNotification(req.params.id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.markAllNotificationsAsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ message: "Failed to mark all notifications as read" });
    }
  });

  // Admin routes
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.put("/api/admin/users/:id/verify", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.verifyUser(req.params.id);
      res.json(updated);
    } catch (error: any) {
      console.error("Error verifying user:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to verify user" });
    }
  });

  app.put("/api/admin/users/:id/ban", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.banUser(req.params.id, req.body.reason || "Violation of terms");
      res.json(updated);
    } catch (error: any) {
      console.error("Error banning user:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ message: "User not found" });
      }
      res.status(500).json({ message: "Failed to ban user" });
    }
  });

  app.get("/api/admin/products", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const products = await storage.getProducts({});
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.put("/api/admin/products/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.approveProduct(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error approving product:", error);
      res.status(500).json({ message: "Failed to approve product" });
    }
  });

  // ==================== CAMPUS UPDATES / ANNOUNCEMENTS ROUTES ====================
  
  // Get all published announcements (public route with optional auth for read status)
  app.get("/api/announcements", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const announcements = await storage.getAnnouncements(false);
      
      // If user is authenticated, include their read status
      if (userId) {
        const reads = await storage.getUserAnnouncementReads(userId);
        const readIds = new Set(reads.map(r => r.announcementId));
        
        const announcementsWithReadStatus = announcements.map(a => ({
          ...a,
          isRead: readIds.has(a.id),
        }));
        
        return res.json(announcementsWithReadStatus);
      }
      
      res.json(announcements.map(a => ({ ...a, isRead: false })));
    } catch (error) {
      console.error("Error fetching announcements:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  // Get a specific announcement
  app.get("/api/announcements/:id", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const announcement = await storage.getAnnouncement(req.params.id);
      
      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      
      // Only show unpublished announcements to admins
      if (!announcement.isPublished) {
        if (!userId) {
          return res.status(404).json({ message: "Announcement not found" });
        }
        if (!(await isAdminUser(userId))) {
          return res.status(404).json({ message: "Announcement not found" });
        }
      }
      
      // Increment views
      await storage.incrementAnnouncementViews(req.params.id);
      
      // Include read status if authenticated
      let isRead = false;
      if (userId) {
        isRead = await storage.isAnnouncementRead(userId, req.params.id);
      }
      
      res.json({ ...announcement, isRead });
    } catch (error) {
      console.error("Error fetching announcement:", error);
      res.status(500).json({ message: "Failed to fetch announcement" });
    }
  });

  // Create announcement (admin only)
  app.post("/api/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can create announcements" });
      }

      const validationResult = createAnnouncementSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const announcement = await storage.createAnnouncement({
        ...validationResult.data,
        authorId: userId,
      });

      res.status(201).json(announcement);
    } catch (error) {
      console.error("Error creating announcement:", error);
      res.status(500).json({ message: "Failed to create announcement" });
    }
  });

  // Update announcement (admin only)
  app.patch("/api/announcements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can update announcements" });
      }

      const validationResult = updateAnnouncementSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const announcement = await storage.updateAnnouncement(req.params.id, validationResult.data);
      res.json(announcement);
    } catch (error: any) {
      console.error("Error updating announcement:", error);
      if (error.message?.includes("not found")) {
        return res.status(404).json({ message: "Announcement not found" });
      }
      res.status(500).json({ message: "Failed to update announcement" });
    }
  });

  // Delete announcement (admin only)
  app.delete("/api/announcements/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can delete announcements" });
      }

      await storage.deleteAnnouncement(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting announcement:", error);
      res.status(500).json({ message: "Failed to delete announcement" });
    }
  });

  // Mark announcement as read (authenticated users)
  app.post("/api/announcements/:id/read", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const read = await storage.markAnnouncementAsRead(userId, req.params.id);
      res.json(read);
    } catch (error) {
      console.error("Error marking announcement as read:", error);
      res.status(500).json({ message: "Failed to mark announcement as read" });
    }
  });

  // Get all announcements for admin (including unpublished)
  app.get("/api/admin/announcements", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const announcements = await storage.getAnnouncements(true);
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements for admin:", error);
      res.status(500).json({ message: "Failed to fetch announcements" });
    }
  });

  // ==================== SOCIAL POSTS ROUTES ("The Plug") ====================

  // Get all social posts (with optional following filter)
  app.get("/api/social-posts", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const followingOnly = req.query.following === "true";
      const authorId = req.query.authorId as string | undefined;

      const posts = await storage.getSocialPosts({
        authorId,
        followingOnly,
        userId: userId || undefined,
      });

      res.json(posts);
    } catch (error) {
      console.error("Error fetching social posts:", error);
      res.status(500).json({ message: "Failed to fetch social posts" });
    }
  });

  // Create a new social post (supports images and videos)
  app.post("/api/social-posts", isAuthenticated, requireEmailVerified, uploadMedia.array("media", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { content } = req.body;
      const hasMedia = req.files && Array.isArray(req.files) && req.files.length > 0;
      const hasContent = content && content.trim().length > 0;
      
      // Require either content or media (or both)
      if (!hasContent && !hasMedia) {
        return res.status(400).json({ message: "Please add some text or media to your post" });
      }

      // Upload media to object storage and separate images from videos
      const images: string[] = [];
      const videos: string[] = [];
      
      if (req.files && Array.isArray(req.files)) {
        const prefix = `posts/${userId}/`;
        
        for (const file of req.files as Express.Multer.File[]) {
          let mediaUrl: string | null = null;
          
          // Use video upload for videos, regular upload for images
          if (file.mimetype.startsWith('video/')) {
            mediaUrl = await uploadVideoToStorage(file, prefix);
            if (mediaUrl) {
              videos.push(mediaUrl);
            }
          } else {
            mediaUrl = await uploadToObjectStorage(file, prefix);
            if (mediaUrl) {
              images.push(mediaUrl);
            }
          }
          
          if (!mediaUrl) {
            console.error("Failed to upload media file:", file.originalname);
          }
        }
      }

      const post = await storage.createSocialPost({
        authorId: userId,
        content: hasContent ? content.trim() : "",
        images,
        videos,
      });

      // Fetch the full post with author info
      const fullPost = await storage.getSocialPost(post.id);
      
      // Notify followers about the new post (run asynchronously, don't block response)
      (async () => {
        try {
          const author = await storage.getUser(userId);
          if (!author) return;
          
          const authorName = author.firstName && author.lastName 
            ? `${author.firstName} ${author.lastName}` 
            : author.username || author.email.split('@')[0];
          
          const authorUsername = author.username || author.email.split('@')[0];
          const postPreview = hasContent ? content.trim() : "[Media post]";
          
          // Get followers and notify them
          const followers = await storage.getFollowers(userId);
          
          // Limit to first 50 followers for email to avoid overwhelming the service
          const followersToEmail = followers.slice(0, 50);
          
          for (const follow of followers) {
            // Send in-app notification to all followers
            await createAndBroadcastNotification({
              userId: follow.follower.id,
              type: "new_post",
              title: "New Post",
              message: `${authorName} shared a new post`,
              link: `/the-plug?post=${post.id}`,
              relatedUserId: userId,
            });
          }
          
          // Send email notifications to a limited number of followers
          for (const follow of followersToEmail) {
            try {
              await sendNewPostFromFollowingEmail(
                follow.follower.email,
                authorName,
                authorUsername,
                postPreview,
                post.id
              );
            } catch (emailError: any) {
              console.error(`Error sending new post email to ${follow.follower.email}:`, emailError.message);
            }
          }
          
          console.log(`Notified ${followers.length} followers about new post from ${author.email}`);
        } catch (notifyError: any) {
          console.error("Error notifying followers about new post:", notifyError.message);
        }
      })();
      
      res.status(201).json(fullPost);
    } catch (error) {
      console.error("Error creating social post:", error);
      res.status(500).json({ message: "Failed to create social post" });
    }
  });

  // Toggle like on a post
  app.post("/api/social-posts/:id/like", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = req.params.id;

      // Check if already liked
      const isLiked = await storage.isPostLiked(postId, userId);

      if (isLiked) {
        // Unlike
        await storage.unlikeSocialPost(postId, userId);
        res.json({ liked: false });
      } else {
        // Like
        await storage.likeSocialPost(postId, userId);
        res.json({ liked: true });
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });

  // Get comments for a post
  app.get("/api/social-posts/:id/comments", async (req, res) => {
    try {
      const postId = req.params.id;
      const comments = await storage.getPostComments(postId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // Add a comment to a post
  app.post("/api/social-posts/:id/comments", isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = req.params.id;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const comment = await storage.createPostComment({
        postId,
        authorId: userId,
        content: content.trim(),
      });

      // Fetch comment with author info
      const comments = await storage.getPostComments(postId);
      const fullComment = comments.find(c => c.id === comment.id);
      
      res.status(201).json(fullComment || comment);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Delete a social post (owner only)
  app.delete("/api/social-posts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = req.params.id;
      const post = await storage.getSocialPost(postId);

      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      // Check ownership (or admin)
      if (post.authorId !== userId && !(await isAdminUser(userId))) {
        return res.status(403).json({ message: "You can only delete your own posts" });
      }

      await storage.deleteSocialPost(postId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting post:", error);
      res.status(500).json({ message: "Failed to delete post" });
    }
  });

  // Repost a social post (toggle)
  app.post("/api/social-posts/:id/repost", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = req.params.id;
      const { quoteContent } = req.body;

      // Check if already reposted
      const isReposted = await storage.isPostReposted(postId, userId);
      
      if (isReposted) {
        // Unrepost
        await storage.unrepostSocialPost(postId, userId);
        res.json({ success: true, action: "unreposted" });
      } else {
        // Repost
        const repost = await storage.repostSocialPost(postId, userId, quoteContent);
        res.json({ success: true, action: "reposted", repost });
      }
    } catch (error) {
      console.error("Error toggling repost:", error);
      res.status(500).json({ message: "Failed to toggle repost" });
    }
  });

  // Get reposts for a post
  app.get("/api/social-posts/:id/reposts", async (req, res) => {
    try {
      const postId = req.params.id;
      const reposts = await storage.getPostReposts(postId);
      res.json(reposts);
    } catch (error) {
      console.error("Error fetching reposts:", error);
      res.status(500).json({ message: "Failed to fetch reposts" });
    }
  });

  // Report a social post
  app.post("/api/social-posts/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const postId = req.params.id;
      const { reason, description } = req.body;

      if (!reason) {
        return res.status(400).json({ message: "Report reason is required" });
      }

      const validReasons = ["spam", "harassment", "hate_speech", "violence", "inappropriate", "misinformation", "other"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ message: "Invalid report reason" });
      }

      const post = await storage.getSocialPost(postId);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.authorId === userId) {
        return res.status(400).json({ message: "You cannot report your own post" });
      }

      const hasReported = await storage.hasUserReportedPost(postId, userId);
      if (hasReported) {
        return res.status(400).json({ message: "You have already reported this post" });
      }

      await storage.createSocialPostReport(postId, userId, reason, description);
      res.json({ message: "Report submitted successfully" });
    } catch (error) {
      console.error("Error reporting post:", error);
      res.status(500).json({ message: "Failed to submit report" });
    }
  });

  // ========== BOOKMARK ENDPOINTS ==========
  
  // Bookmark a post
  app.post("/api/social-posts/:id/bookmark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const postId = req.params.id;
      const isBookmarked = await storage.isPostBookmarked(userId, postId);
      
      if (isBookmarked) {
        await storage.unbookmarkPost(userId, postId);
        res.json({ success: true, action: "unbookmarked" });
      } else {
        await storage.bookmarkPost(userId, postId);
        res.json({ success: true, action: "bookmarked" });
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      res.status(500).json({ message: "Failed to toggle bookmark" });
    }
  });
  
  // Get user's bookmarks
  app.get("/api/users/me/bookmarks", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const bookmarks = await storage.getUserBookmarks(userId);
      res.json(bookmarks);
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({ message: "Failed to fetch bookmarks" });
    }
  });

  // ========== SMART FEED ALGORITHM ENDPOINTS ==========
  
  // Get enhanced feed with algorithm
  app.get("/api/feed", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const feedTypeParam = req.query.type as string;
      const userLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const userLng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      
      // Handle bookmarks feed - requires authentication
      if (feedTypeParam === 'bookmarks') {
        if (!userId) {
          return res.status(401).json({ message: "Login to view saved posts" });
        }
        const bookmarkedPostData = await storage.getUserBookmarks(userId);
        
        // Get user's following list
        const followingList = await storage.getFollowing(userId);
        const followingIds = new Set(followingList.map((f: any) => f.followingId || f.following?.id));
        
        // Check like and repost status for each bookmarked post
        const postsWithBookmarks = await Promise.all(bookmarkedPostData.map(async (item) => {
          const [isLiked, isReposted] = await Promise.all([
            storage.isPostLiked(item.post.id, userId),
            storage.isPostReposted(item.post.id, userId)
          ]);
          
          return {
            ...item.post,
            author: item.author,
            isBookmarked: true,
            isLiked,
            isFollowingAuthor: followingIds.has(item.post.authorId),
            isReposted,
            engagementScore: "0",
          };
        }));
        return res.json(postsWithBookmarks);
      }
      
      const feedType = feedTypeParam === 'following' ? 'following' : 'for_you';
      
      const posts = await storage.getSocialPostsWithAlgorithm({
        userId: userId || undefined,
        feedType: feedType as 'for_you' | 'following',
        userLat: userLat && !isNaN(userLat) ? userLat : undefined,
        userLng: userLng && !isNaN(userLng) ? userLng : undefined
      });
      
      // If logged in, also check bookmark status
      if (userId) {
        const postsWithBookmarks = await Promise.all(posts.map(async (post) => ({
          ...post,
          isBookmarked: await storage.isPostBookmarked(userId, post.id)
        })));
        res.json(postsWithBookmarks);
      } else {
        res.json(posts.map(p => ({ ...p, isBookmarked: false })));
      }
    } catch (error) {
      console.error("Error fetching feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });
  
  // Track post view (unique: 1 view per user per 24 hours)
  app.post("/api/social-posts/:id/view", async (req: any, res) => {
    try {
      const postId = req.params.id;
      const userId = getUserId(req);
      
      // For authenticated users, use unique view tracking
      if (userId) {
        const isNewView = await storage.recordUniquePostView(postId, userId);
        res.json({ success: true, isNewView });
      } else {
        // For anonymous users, use session-based tracking
        const sessionId = req.session?.id || req.ip;
        if (sessionId) {
          const viewerKey = `anon_${sessionId}`;
          const isNewView = await storage.recordUniquePostView(postId, viewerKey);
          res.json({ success: true, isNewView });
        } else {
          // Fallback: just increment without tracking (rare edge case)
          await storage.incrementPostViews(postId);
          await storage.updatePostEngagementScore(postId);
          res.json({ success: true, isNewView: true });
        }
      }
    } catch (error) {
      console.error("Error tracking view:", error);
      res.status(500).json({ message: "Failed to track view" });
    }
  });
  
  // Track post share
  app.post("/api/social-posts/:id/share", async (req: any, res) => {
    try {
      const postId = req.params.id;
      await storage.incrementPostShares(postId);
      await storage.updatePostEngagementScore(postId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error tracking share:", error);
      res.status(500).json({ message: "Failed to track share" });
    }
  });

  // ========== POST PIN ENDPOINTS ==========
  
  // Pin a post
  app.post("/api/social-posts/:id/pin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const postId = req.params.id;
      const post = await storage.getSocialPostById(postId);
      
      if (!post || post.authorId !== userId) {
        return res.status(403).json({ message: "You can only pin your own posts" });
      }
      
      await storage.pinSocialPost(postId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error pinning post:", error);
      res.status(500).json({ message: "Failed to pin post" });
    }
  });
  
  // Unpin a post
  app.delete("/api/social-posts/:id/pin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const postId = req.params.id;
      const post = await storage.getSocialPostById(postId);
      
      if (!post || post.authorId !== userId) {
        return res.status(403).json({ message: "You can only unpin your own posts" });
      }
      
      await storage.unpinSocialPost(postId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unpinning post:", error);
      res.status(500).json({ message: "Failed to unpin post" });
    }
  });
  
  // Get user's pinned posts
  app.get("/api/users/:id/pinned-posts", async (req, res) => {
    try {
      const userId = req.params.id;
      const pinnedPosts = await storage.getUserPinnedPosts(userId);
      res.json(pinnedPosts);
    } catch (error) {
      console.error("Error fetching pinned posts:", error);
      res.status(500).json({ message: "Failed to fetch pinned posts" });
    }
  });

  // ========== LOCATION ENDPOINTS ==========
  
  // Update user location (GPS coordinates)
  app.patch("/api/users/me/location", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { latitude, longitude } = req.body;
      
      if (latitude === undefined || longitude === undefined) {
        return res.status(400).json({ message: "Latitude and longitude are required" });
      }
      
      // Validate coordinates
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ message: "Invalid coordinates" });
      }
      
      const user = await storage.updateUserLocation(userId, lat.toString(), lng.toString());
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating location:", error);
      res.status(500).json({ message: "Failed to update location" });
    }
  });

  // ========== USERNAME AND PROFILE ENDPOINTS ==========
  
  // Get user by username
  app.get("/api/users/username/:username", async (req, res) => {
    try {
      const username = req.params.username;
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return safe user data (no password)
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user by username:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  // Update username
  app.patch("/api/users/me/username", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { username } = req.body;
      if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ message: "Username must be 3-20 characters" });
      }
      
      // Check if username is taken
      const existing = await storage.getUserByUsername(username);
      if (existing && existing.id !== userId) {
        return res.status(409).json({ message: "Username already taken" });
      }
      
      const user = await storage.updateUsername(userId, username);
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating username:", error);
      res.status(500).json({ message: "Failed to update username" });
    }
  });

  // ========== EKSUPLUG SYSTEM ACCOUNT ENDPOINTS ==========
  
  // Get or create Marketplace system account
  app.get("/api/system/marketplace", async (req, res) => {
    try {
      let marketplace = await storage.getSystemAccount("marketplace");
      
      if (!marketplace) {
        // Create the @EksuMarketplaceOfficial system account
        marketplace = await storage.createSystemAccount({
          email: "system@eksucampusmarketplace.com",
          username: "EksuMarketplaceOfficial",
          firstName: "EKSU",
          lastName: "Marketplace",
          type: "marketplace",
          bio: "Official EKSU Campus Marketplace. Your trusted platform for campus trading, announcements, and community updates.",
          profileImageUrl: "/eksu-marketplace-avatar.png"
        });
      }
      
      const { password, ...safeUser } = marketplace;
      res.json(safeUser);
    } catch (error) {
      console.error("Error getting Marketplace account:", error);
      res.status(500).json({ message: "Failed to get Marketplace account" });
    }
  });
  
  // Post as Marketplace (Admin only)
  app.post("/api/system/marketplace/post", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is admin
      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can post as Marketplace" });
      }
      
      // Get or create Marketplace account
      let marketplace = await storage.getSystemAccount("marketplace");
      if (!marketplace) {
        marketplace = await storage.createSystemAccount({
          email: "system@eksucampusmarketplace.com",
          username: "EksuMarketplaceOfficial",
          firstName: "EKSU",
          lastName: "Marketplace",
          type: "marketplace",
          bio: "Official EKSU Campus Marketplace. Your trusted platform for campus trading, announcements, and community updates.",
        });
      }
      
      const { content, images, videos, replyRestriction } = req.body;
      
      // Extract hashtags from content
      const hashtags = (content.match(/#\w+/g) || []).map((h: string) => h.slice(1).toLowerCase());
      
      // Extract mentions from content
      const mentionMatches = content.match(/@\w+/g) || [];
      const mentionedUsernames = mentionMatches.map((m: string) => m.slice(1).toLowerCase());
      const mentionedUserIds: string[] = [];
      
      for (const username of mentionedUsernames) {
        const user = await storage.getUserByUsername(username);
        if (user) mentionedUserIds.push(user.id);
      }
      
      const post = await storage.createSocialPostWithOptions({
        authorId: marketplace.id,
        content,
        images: images || [],
        videos: videos || [],
        replyRestriction: replyRestriction || 'everyone',
        mentionedUserIds,
        hashtags,
        isFromSystemAccount: true
      });
      
      res.json(post);
    } catch (error) {
      console.error("Error posting as Marketplace:", error);
      res.status(500).json({ message: "Failed to post as Marketplace" });
    }
  });
  
  // Auto-follow Marketplace on user registration (called internally)
  app.post("/api/system/marketplace/auto-follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Get Marketplace account
      let marketplace = await storage.getSystemAccount("marketplace");
      if (!marketplace) {
        marketplace = await storage.createSystemAccount({
          email: "system@eksucampusmarketplace.com",
          username: "EksuMarketplaceOfficial", 
          firstName: "EKSU",
          lastName: "Marketplace",
          type: "marketplace",
          bio: "Official EKSU Campus Marketplace. Your trusted platform for campus trading, announcements, and community updates.",
        });
      }
      
      // Check if already following
      const isFollowing = await storage.isFollowing(userId, marketplace.id);
      if (!isFollowing) {
        await storage.followUser(userId, marketplace.id);
      }
      
      res.json({ success: true, following: true });
    } catch (error) {
      console.error("Error auto-following Marketplace:", error);
      res.status(500).json({ message: "Failed to auto-follow Marketplace" });
    }
  });

  // Admin Metrics Routes - Database & Memory Monitoring
  app.get("/api/admin/metrics/tables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Query PostgreSQL catalog for table statistics
      const result = await storage.executeRawSQL<{
        table_name: string;
        row_estimate: number;
        total_size_bytes: number;
        indexes_size_bytes: number;
        table_size_bytes: number;
      }>(
        `
        SELECT 
          schemaname || '.' || tablename as table_name,
          n_live_tup as row_estimate,
          pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
          pg_indexes_size(schemaname||'.'||tablename) as indexes_size_bytes,
          pg_relation_size(schemaname||'.'||tablename) as table_size_bytes
        FROM pg_stat_user_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY total_size_bytes DESC
        LIMIT 50
        `
      );

      // Get database size
      const dbSize = await storage.executeRawSQL<{ db_size_bytes: number }>(
        "SELECT pg_database_size(current_database()) as db_size_bytes"
      );

      res.json({
        tables: result,
        totalDatabaseSize: dbSize[0]?.db_size_bytes || 0,
      });
    } catch (error) {
      console.error("Error fetching table metrics:", error);
      res.status(500).json({ message: "Failed to fetch table metrics" });
    }
  });

  app.get("/api/admin/metrics/activity", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Query active connections from pg_stat_activity
      const connections = await storage.executeRawSQL<{
        state: string;
        count: number;
      }>(
        `
        SELECT 
          state,
          COUNT(*) as count
        FROM pg_stat_activity
        WHERE datname = current_database()
        GROUP BY state
        `
      );

      // Get total connection count and max age
      const stats = await storage.executeRawSQL<{
        total_connections: number;
        max_connection_age_seconds: number;
      }>(
        `
        SELECT 
          COUNT(*) as total_connections,
          EXTRACT(EPOCH FROM MAX(NOW() - state_change)) as max_connection_age_seconds
        FROM pg_stat_activity
        WHERE datname = current_database()
        `
      );

      res.json({
        connectionsByState: connections,
        totalConnections: stats[0]?.total_connections || 0,
        maxConnectionAge: stats[0]?.max_connection_age_seconds || 0,
      });
    } catch (error) {
      console.error("Error fetching activity metrics:", error);
      res.status(500).json({ message: "Failed to fetch activity metrics" });
    }
  });

  app.get("/api/admin/metrics/performance", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check if pg_stat_statements extension is available
      const hasExtension = await storage.executeRawSQL<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as exists`
      );

      let queryStats: Array<{
        query: string;
        calls: number;
        total_time_ms: number;
        mean_time_ms: number;
        rows: number;
      }> = [];
      if (hasExtension[0]?.exists) {
        // Get query performance stats from pg_stat_statements
        queryStats = await storage.executeRawSQL<{
          query: string;
          calls: number;
          total_time_ms: number;
          mean_time_ms: number;
          rows: number;
        }>(
          `
          SELECT 
            LEFT(query, 100) as query,
            calls,
            total_exec_time as total_time_ms,
            mean_exec_time as mean_time_ms,
            rows
          FROM pg_stat_statements
          WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
          ORDER BY mean_exec_time DESC
          LIMIT 20
          `
        );
      }

      // Get database-level stats (always available)
      const dbStats = await storage.executeRawSQL<{
        deadlocks: number;
        temp_files: number;
        temp_bytes: number;
      }>(
        `
        SELECT 
          deadlocks,
          temp_files,
          temp_bytes
        FROM pg_stat_database
        WHERE datname = current_database()
        `
      );

      res.json({
        queryStats,
        databaseStats: dbStats[0] || { deadlocks: 0, temp_files: 0, temp_bytes: 0 },
        extensionAvailable: hasExtension[0]?.exists || false,
      });
    } catch (error) {
      console.error("Error fetching performance metrics:", error);
      res.status(500).json({ message: "Failed to fetch performance metrics" });
    }
  });

  // Admin - Get all platform settings
  app.get("/api/admin/platform-settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const settings = await storage.getAllPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching platform settings:", error);
      res.status(500).json({ message: "Failed to fetch platform settings" });
    }
  });

  // Admin - Update platform setting
  app.patch("/api/admin/platform-settings/:key", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const { key } = req.params;
      const { value } = req.body;

      if (!key) {
        return res.status(400).json({ message: "Setting key is required" });
      }

      if (typeof value !== "string") {
        return res.status(400).json({ message: "Value must be a string" });
      }

      const setting = await storage.updatePlatformSetting(key, value, userId);
      res.json(setting);
    } catch (error) {
      console.error("Error updating platform setting:", error);
      res.status(500).json({ message: "Failed to update platform setting" });
    }
  });

  // ==================== VTU API ROUTES ====================

  // ==================== VTU BENEFICIARIES ====================

  // Get user's saved beneficiaries
  app.get("/api/vtu/beneficiaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const beneficiaries = await storage.getUserBeneficiaries(userId);
      res.json(beneficiaries);
    } catch (error) {
      console.error("Error fetching beneficiaries:", error);
      res.status(500).json({ message: "Failed to fetch beneficiaries" });
    }
  });

  // Create a new beneficiary
  app.post("/api/vtu/beneficiaries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createBeneficiarySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const beneficiary = await storage.createBeneficiary({
        userId,
        ...validationResult.data,
      });
      res.json(beneficiary);
    } catch (error) {
      console.error("Error creating beneficiary:", error);
      res.status(500).json({ message: "Failed to create beneficiary" });
    }
  });

  // Update a beneficiary
  app.put("/api/vtu/beneficiaries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const beneficiary = await storage.getBeneficiary(id);
      
      if (!beneficiary) {
        return res.status(404).json({ message: "Beneficiary not found" });
      }
      
      if (beneficiary.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this beneficiary" });
      }

      const updated = await storage.updateBeneficiary(id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating beneficiary:", error);
      res.status(500).json({ message: "Failed to update beneficiary" });
    }
  });

  // Delete a beneficiary
  app.delete("/api/vtu/beneficiaries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const beneficiary = await storage.getBeneficiary(id);
      
      if (!beneficiary) {
        return res.status(404).json({ message: "Beneficiary not found" });
      }
      
      if (beneficiary.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this beneficiary" });
      }

      await storage.deleteBeneficiary(id);
      res.json({ success: true, message: "Beneficiary deleted" });
    } catch (error) {
      console.error("Error deleting beneficiary:", error);
      res.status(500).json({ message: "Failed to delete beneficiary" });
    }
  });

  // Get user's VTU transaction history with filters
  app.get("/api/vtu/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, network, startDate, endDate } = req.query;
      
      const filters: { status?: string; network?: string; startDate?: Date; endDate?: Date } = {};
      if (status && typeof status === "string") filters.status = status;
      if (network && typeof network === "string") filters.network = network;
      if (startDate && typeof startDate === "string") filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === "string") filters.endDate = new Date(endDate);

      const transactions = await storage.getUserVtuTransactions(userId, filters);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching VTU transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  // Export VTU transactions as JSON (for frontend to process into PDF/Excel)
  app.get("/api/vtu/transactions/export", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { status, network, startDate, endDate, format = "json" } = req.query;
      
      const filters: { status?: string; network?: string; startDate?: Date; endDate?: Date } = {};
      if (status && typeof status === "string" && status !== "all") filters.status = status;
      if (network && typeof network === "string" && network !== "all") filters.network = network;
      if (startDate && typeof startDate === "string") filters.startDate = new Date(startDate);
      if (endDate && typeof endDate === "string") filters.endDate = new Date(endDate);

      const transactions = await storage.getUserVtuTransactions(userId, filters);
      const user = await storage.getUser(userId);

      res.json({
        success: true,
        exportData: {
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User" : "User",
          exportDate: new Date().toISOString(),
          filters: {
            status: filters.status || "all",
            network: filters.network || "all",
            startDate: filters.startDate?.toISOString() || null,
            endDate: filters.endDate?.toISOString() || null,
          },
          transactions: transactions.map((tx: any) => ({
            id: tx.id,
            date: tx.createdAt,
            type: tx.serviceType || "data",
            network: tx.network,
            phoneNumber: tx.phoneNumber,
            plan: tx.planName || tx.planId || "N/A",
            amount: tx.amount,
            status: tx.status,
            reference: tx.apiReference || tx.id,
          })),
          summary: {
            totalTransactions: transactions.length,
            totalAmount: transactions.reduce((sum: number, tx: any) => sum + parseFloat(tx.amount || 0), 0),
            successfulCount: transactions.filter((tx: any) => tx.status === "success" || tx.status === "completed").length,
            pendingCount: transactions.filter((tx: any) => tx.status === "pending").length,
            failedCount: transactions.filter((tx: any) => tx.status === "failed").length,
          },
        },
      });
    } catch (error) {
      console.error("Error exporting VTU transactions:", error);
      res.status(500).json({ message: "Failed to export transactions" });
    }
  });

  // Bulk VTU purchase - purchase data/airtime for multiple numbers
  app.post("/api/vtu/bulk-purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { purchases, serviceType = "data" } = req.body;

      if (!Array.isArray(purchases) || purchases.length === 0) {
        return res.status(400).json({ message: "Purchases array is required and cannot be empty" });
      }

      if (purchases.length > 50) {
        return res.status(400).json({ message: "Maximum 50 purchases per bulk request" });
      }

      // Validate all phone numbers first
      for (const purchase of purchases) {
        if (!isValidNigerianPhone(purchase.phoneNumber)) {
          return res.status(400).json({ 
            message: `Invalid phone number: ${purchase.phoneNumber}`,
            invalidNumber: purchase.phoneNumber
          });
        }
      }

      // Calculate total amount needed
      let totalAmount = 0;
      const purchasesWithPlans: any[] = [];

      for (const purchase of purchases) {
        if (serviceType === "data") {
          const plan = getDataPlanById(purchase.planId);
          if (!plan) {
            return res.status(400).json({ 
              message: `Data plan not found: ${purchase.planId}`,
              invalidPlan: purchase.planId
            });
          }
          totalAmount += plan.sellingPrice;
          purchasesWithPlans.push({ ...purchase, plan });
        } else if (serviceType === "airtime") {
          const amount = parseFloat(purchase.amount);
          if (isNaN(amount) || amount < 50 || amount > 50000) {
            return res.status(400).json({ 
              message: `Invalid airtime amount for ${purchase.phoneNumber}. Must be between 50 and 50,000.`,
            });
          }
          totalAmount += amount;
          purchasesWithPlans.push({ ...purchase, amount });
        }
      }

      // Check wallet balance
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < totalAmount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance for bulk purchase",
          required: totalAmount,
          available: walletBalance
        });
      }

      // Check if API is configured
      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      // Process each purchase
      const results: any[] = [];
      let totalSuccess = 0;
      let totalFailed = 0;
      let amountDeducted = 0;

      for (const purchase of purchasesWithPlans) {
        try {
          const purchaseAmount = serviceType === "data" ? purchase.plan.sellingPrice : purchase.amount;
          
          // Deduct from wallet
          await storage.updateWalletBalance(userId, purchaseAmount.toString(), "subtract");
          amountDeducted += purchaseAmount;

          // Create transaction record
          const walletTx = await storage.createTransaction({
            walletId: wallet.id,
            type: "purchase",
            amount: `-${purchaseAmount}`,
            status: "pending",
            description: serviceType === "data" 
              ? `Bulk Data: ${purchase.plan.dataAmount} for ${purchase.phoneNumber}`
              : `Bulk Airtime: ₦${purchase.amount} for ${purchase.phoneNumber}`,
            relatedUserId: userId,
          });

          let purchaseResult;
          if (serviceType === "data") {
            purchaseResult = await purchaseData(purchase.plan.network, purchase.phoneNumber, purchase.plan.planCode);
          } else {
            purchaseResult = await purchaseAirtime(purchase.network || "mtn", purchase.phoneNumber, purchase.amount);
          }

          if (purchaseResult.success) {
            await storage.updateTransaction(walletTx.id, { status: "completed" });
            totalSuccess++;
            results.push({
              phoneNumber: purchase.phoneNumber,
              status: "success",
              amount: purchaseAmount,
              reference: purchaseResult.reference,
              message: serviceType === "data" 
                ? `${purchase.plan.dataAmount} sent successfully`
                : `₦${purchase.amount} airtime sent successfully`,
            });
          } else {
            // Refund on failure
            await storage.updateWalletBalance(userId, purchaseAmount.toString(), "add");
            amountDeducted -= purchaseAmount;
            await storage.updateTransaction(walletTx.id, { status: "failed" });
            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: purchaseAmount.toString(),
              status: "completed",
              description: `Refund: Bulk ${serviceType} for ${purchase.phoneNumber} - ${purchaseResult.message}`,
              relatedUserId: userId,
            });
            totalFailed++;
            results.push({
              phoneNumber: purchase.phoneNumber,
              status: "failed",
              amount: purchaseAmount,
              message: purchaseResult.message || "Purchase failed",
            });
          }
        } catch (purchaseError: any) {
          totalFailed++;
          results.push({
            phoneNumber: purchase.phoneNumber,
            status: "error",
            message: purchaseError.message || "Network error",
          });
        }
      }

      // Award reward points for successful bulk purchases (10 points per 1000 naira)
      if (amountDeducted > 0) {
        const pointsEarned = Math.floor(amountDeducted / 1000) * 10;
        if (pointsEarned > 0) {
          await storage.addRewardPoints(
            userId,
            pointsEarned,
            `Earned from bulk VTU purchase of ₦${amountDeducted.toLocaleString()}`,
            undefined,
            "vtu_bulk_purchase"
          );
        }
      }

      res.json({
        success: true,
        message: `Bulk purchase completed: ${totalSuccess} successful, ${totalFailed} failed`,
        results,
        summary: {
          total: purchases.length,
          successful: totalSuccess,
          failed: totalFailed,
          totalAmountDeducted: amountDeducted,
        },
      });
    } catch (error) {
      console.error("Error processing bulk VTU purchase:", error);
      res.status(500).json({ message: "Failed to process bulk purchase" });
    }
  });

  // ===========================================
  // REWARD POINTS API ROUTES
  // ===========================================

  // Get user's reward points balance and tier
  app.get("/api/rewards", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rewards = await storage.getOrCreateRewardPoints(userId);
      const recentTransactions = await storage.getRewardTransactions(userId, 10);

      // Tier benefits
      const tierBenefits: Record<string, { multiplier: number; description: string }> = {
        bronze: { multiplier: 1, description: "10 points per ₦1,000 spent" },
        silver: { multiplier: 1.25, description: "12.5 points per ₦1,000 spent" },
        gold: { multiplier: 1.5, description: "15 points per ₦1,000 spent" },
        platinum: { multiplier: 2, description: "20 points per ₦1,000 spent" },
      };

      // Progress to next tier
      const tierThresholds: Record<string, number> = {
        bronze: 0,
        silver: 5000,
        gold: 20000,
        platinum: 50000,
      };

      const nextTier = rewards.tier === "platinum" ? null : 
        rewards.tier === "gold" ? "platinum" : 
        rewards.tier === "silver" ? "gold" : "silver";

      const progressToNextTier = nextTier ? {
        currentPoints: rewards.lifetimeEarned,
        requiredPoints: tierThresholds[nextTier],
        progress: Math.min(100, (rewards.lifetimeEarned / tierThresholds[nextTier]) * 100),
        pointsNeeded: Math.max(0, tierThresholds[nextTier] - rewards.lifetimeEarned),
      } : null;

      res.json({
        ...rewards,
        tierBenefits: tierBenefits[rewards.tier],
        progressToNextTier,
        recentTransactions,
        redemptionOptions: [
          { id: "wallet_100", name: "₦100 Wallet Credit", points: 100, value: 100 },
          { id: "wallet_200", name: "₦200 Wallet Credit", points: 180, value: 200 },
          { id: "wallet_500", name: "₦500 Wallet Credit", points: 400, value: 500 },
          { id: "wallet_1000", name: "₦1,000 Wallet Credit", points: 750, value: 1000 },
          { id: "wallet_2000", name: "₦2,000 Wallet Credit", points: 1400, value: 2000 },
          { id: "wallet_5000", name: "₦5,000 Wallet Credit", points: 3000, value: 5000 },
        ],
      });
    } catch (error) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ message: "Failed to fetch rewards" });
    }
  });

  // Get full reward transaction history
  app.get("/api/rewards/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = await storage.getRewardTransactions(userId, limit);

      res.json(transactions);
    } catch (error) {
      console.error("Error fetching reward transactions:", error);
      res.status(500).json({ message: "Failed to fetch reward transactions" });
    }
  });

  // Redeem reward points for wallet credit
  app.post("/api/rewards/redeem", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { optionId } = req.body;

      const redemptionOptions: Record<string, { points: number; value: number; name: string }> = {
        wallet_100: { points: 100, value: 100, name: "₦100 Wallet Credit" },
        wallet_200: { points: 180, value: 200, name: "₦200 Wallet Credit" },
        wallet_500: { points: 400, value: 500, name: "₦500 Wallet Credit" },
        wallet_1000: { points: 750, value: 1000, name: "₦1,000 Wallet Credit" },
        wallet_2000: { points: 1400, value: 2000, name: "₦2,000 Wallet Credit" },
        wallet_5000: { points: 3000, value: 5000, name: "₦5,000 Wallet Credit" },
      };

      const option = redemptionOptions[optionId];
      if (!option) {
        return res.status(400).json({ message: "Invalid redemption option" });
      }

      const rewards = await storage.getOrCreateRewardPoints(userId);
      if (rewards.totalPoints < option.points) {
        return res.status(400).json({ 
          message: "Insufficient reward points",
          required: option.points,
          available: rewards.totalPoints,
        });
      }

      // Redeem points
      await storage.redeemRewardPoints(userId, option.points, `Redeemed for ${option.name}`);

      // Add wallet credit
      await storage.updateWalletBalance(userId, option.value.toString(), "add");
      const wallet = await storage.getOrCreateWallet(userId);
      await storage.createTransaction({
        walletId: wallet.id,
        type: "credit",
        amount: option.value.toString(),
        status: "completed",
        description: `Reward points redemption: ${option.name}`,
        relatedUserId: userId,
      });

      const updatedRewards = await storage.getOrCreateRewardPoints(userId);

      res.json({
        success: true,
        message: `Successfully redeemed ${option.points} points for ${option.name}`,
        walletCredited: option.value,
        newPointsBalance: updatedRewards.totalPoints,
      });
    } catch (error: any) {
      console.error("Error redeeming rewards:", error);
      res.status(500).json({ message: error.message || "Failed to redeem rewards" });
    }
  });

  // Get all VTU data plans (optionally filter by network and/or planType)
  // Uses Inlomax API pricing with competitive margins and savings info
  app.get("/api/vtu/plans", async (req, res) => {
    try {
      const { network, planType } = req.query;
      const discountInfo = getDiscountInfo();
      
      let plans: DataPlan[] = getAllDataPlans();
      
      // Filter by network if provided (supports: mtn, glo, airtel, 9mobile)
      if (network && typeof network === "string") {
        const validNetworks = ["mtn", "glo", "airtel", "9mobile"];
        if (validNetworks.includes(network.toLowerCase())) {
          plans = plans.filter(p => p.network === network.toLowerCase());
        }
      }
      
      // Filter by planType if provided (supports: sme, direct, cg, social, awoof)
      if (planType && typeof planType === "string") {
        plans = plans.filter(p => p.planType === planType.toLowerCase());
      }
      
      // Include market price and savings info in response
      const plansWithSavings = plans.map(plan => ({
        ...plan,
        marketPrice: plan.marketPrice,
        savingsAmount: plan.savingsAmount,
        savingsPercentage: plan.savingsPercentage,
        formattedSavings: `${plan.savingsPercentage}% OFF`,
      }));
      
      res.json({
        plans: plansWithSavings,
        discount: discountInfo,
        networks: NETWORK_INFO,
        totalPlans: plansWithSavings.length,
      });
    } catch (error) {
      console.error("Error fetching VTU plans:", error);
      res.status(500).json({ message: "Failed to fetch VTU plans" });
    }
  });

  // Admin endpoint: Update VTU plan pricing (manual management)
  // Note: SMEDATA API doesn't have a plans endpoint - plans must be manually managed
  app.post("/api/admin/vtu/update-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can update VTU plans" });
      }

      const { planId, costPrice, sellingPrice, isActive } = req.body;
      
      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      const plan = await storage.getVtuPlan(planId);
      if (!plan) {
        return res.status(404).json({ message: "VTU plan not found" });
      }

      // Update plan with new pricing
      await storage.upsertVtuPlan({
        network: plan.network as any,
        planName: plan.planName,
        dataAmount: plan.dataAmount,
        validity: plan.validity,
        costPrice: costPrice ?? plan.costPrice,
        sellingPrice: sellingPrice ?? plan.sellingPrice,
        planCode: plan.planCode,
        isActive: isActive ?? plan.isActive,
        sortOrder: plan.sortOrder ?? 0,
      });

      console.log(`[VTU Admin] Updated plan ${plan.planName}: cost=${costPrice}, sell=${sellingPrice}, active=${isActive}`);

      res.json({
        success: true,
        message: `Plan "${plan.planName}" updated successfully`,
      });
    } catch (error: any) {
      console.error("[VTU Admin] Error updating VTU plan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to update VTU plan",
      });
    }
  });

  // Admin endpoint: Add new VTU plan
  app.post("/api/admin/vtu/add-plan", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can add VTU plans" });
      }

      const { network, planName, dataAmount, validity, costPrice, sellingPrice, planCode, sortOrder } = req.body;
      
      if (!network || !planName || !dataAmount || !costPrice || !sellingPrice) {
        return res.status(400).json({ 
          message: "Missing required fields: network, planName, dataAmount, costPrice, sellingPrice" 
        });
      }

      // Validate network (only MTN, GLO, AIRTEL supported - no 9mobile)
      const validNetworks = ["mtn_sme", "glo_cg", "airtel_cg"];
      if (!validNetworks.includes(network)) {
        return res.status(400).json({ message: "Invalid network. Must be one of: " + validNetworks.join(", ") });
      }

      // Check for duplicate
      const existing = await storage.getVtuPlanByNetworkAndDataAmount(network, dataAmount);
      if (existing) {
        return res.status(409).json({ message: `Plan for ${network} ${dataAmount} already exists` });
      }

      await storage.upsertVtuPlan({
        network: network as any,
        planName,
        dataAmount: dataAmount.toUpperCase(),
        validity: validity || "30 days",
        costPrice,
        sellingPrice,
        planCode: planCode || `${network}_${dataAmount}`.toLowerCase().replace(/\s+/g, "_"),
        isActive: true,
        sortOrder: sortOrder ?? 0,
      });

      console.log(`[VTU Admin] Added new plan: ${planName}`);

      res.json({
        success: true,
        message: `Plan "${planName}" added successfully`,
      });
    } catch (error: any) {
      console.error("[VTU Admin] Error adding VTU plan:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to add VTU plan",
      });
    }
  });

  // Admin endpoint: Requery order/transaction status
  app.post("/api/admin/vtu/requery", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can requery orders" });
      }

      const { transactionId } = req.body;
      if (!transactionId) {
        return res.status(400).json({ message: "Transaction ID is required" });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ 
          success: false,
          message: "VTU service is not configured",
        });
      }

      const result = await checkTransactionStatus(transactionId);
      res.json(result);
    } catch (error: any) {
      console.error("[VTU Admin] Error requerying transaction:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to requery transaction",
      });
    }
  });

  // Admin endpoint: Get all VTU plans (including inactive)
  app.get("/api/admin/vtu/all-plans", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!(await isAdminUser(userId))) {
        return res.status(403).json({ message: "Only admins can view all VTU plans" });
      }

      const plans = await storage.getAllVtuPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching all VTU plans:", error);
      res.status(500).json({ message: "Failed to fetch VTU plans" });
    }
  });

  // Purchase VTU data using Inlomax API
  app.post("/api/vtu/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = purchaseVtuSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { planId, phoneNumber } = validationResult.data;

      // Validate Nigerian phone number
      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Get the data plan from Inlomax plans
      const plan = getDataPlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: "Data plan not found" });
      }

      // Use Inlomax pricing structure
      const planPrice = plan.sellingPrice; // Our selling price to customer
      const costPrice = plan.apiPrice; // Inlomax API cost
      const profit = plan.profit; // Our profit margin
      const savingsAmount = plan.savingsAmount; // Customer savings vs market
      const savingsPercentage = plan.savingsPercentage;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      // Check sufficient balance
      if (walletBalance < planPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");
        walletDeducted = true;

        // Create wallet transaction record
        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${planPrice}`,
          status: "pending",
          description: `Data Purchase: ${plan.name} (${plan.dataAmount}) for ${phoneNumber}`,
          relatedUserId: userId,
        });

        // Process the actual purchase if API is configured
        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseData(plan.network, phoneNumber, plan.planCode);
        
        if (purchaseResult.success) {
          // Update wallet transaction as completed
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          // Award reward points (10 points per ₦1,000 spent)
          let pointsEarned = 0;
          try {
            const rewards = await storage.getOrCreateRewardPoints(userId);
            const tierMultiplier: Record<string, number> = {
              bronze: 1,
              silver: 1.25,
              gold: 1.5,
              platinum: 2,
            };
            const multiplier = tierMultiplier[rewards.tier] || 1;
            pointsEarned = Math.floor((planPrice / 1000) * 10 * multiplier);
            
            if (pointsEarned > 0) {
              await storage.addRewardPoints(
                userId,
                pointsEarned,
                `Earned from ${plan.dataAmount} data purchase (₦${planPrice.toLocaleString()})`,
                walletTransaction.id,
                "vtu_data_purchase"
              );
            }
          } catch (rewardError) {
            console.error("Error adding reward points:", rewardError);
          }

          return res.json({
            success: true,
            message: `${plan.dataAmount} data purchased successfully for ${phoneNumber}`,
            pointsEarned,
            transaction: {
              id: walletTransaction.id,
              network: plan.network,
              planType: plan.planType,
              planName: plan.name,
              dataAmount: plan.dataAmount,
              amount: planPrice,
              costPrice: costPrice,
              profit: profit,
              savingsAmount: savingsAmount,
              savingsPercentage: savingsPercentage,
              marketPrice: plan.marketPrice,
              phoneNumber,
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        // Refund the user if wallet was deducted
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, planPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: planPrice.toString(),
              status: "completed",
              description: `Refund: ${plan.dataAmount} data for ${phoneNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("VTU refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Data purchase failed. Amount refunded to wallet."
          : "Data purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("VTU purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process VTU purchase",
        });
      }
    } catch (error) {
      console.error("Error processing VTU purchase:", error);
      res.status(500).json({ message: "Failed to process VTU purchase" });
    }
  });

  // Purchase airtime using Inlomax API
  app.post("/api/vtu/airtime", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = purchaseAirtimeSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { phoneNumber, amount, network } = validationResult.data;

      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Validate network - supports mtn, glo, airtel, 9mobile
      const validNetworks: NetworkType[] = ["mtn", "glo", "airtel", "9mobile"];
      let networkToUse: NetworkType;
      
      if (network && validNetworks.includes(network.toLowerCase() as NetworkType)) {
        networkToUse = network.toLowerCase() as NetworkType;
      } else {
        // Auto-detect network from phone number
        const detectedNetwork = detectNetwork(phoneNumber);
        if (!detectedNetwork) {
          return res.status(400).json({ 
            message: "Could not detect network for this phone number. Supported networks: MTN, GLO, Airtel, 9mobile." 
          });
        }
        networkToUse = detectedNetwork;
      }

      // Validate amount (minimum airtime amount)
      if (amount < 50) {
        return res.status(400).json({ message: "Minimum airtime amount is ₦50" });
      }

      if (amount > 50000) {
        return res.status(400).json({ message: "Maximum airtime amount is ₦50,000" });
      }

      // Get network info for discount calculation
      const networkInfo = NETWORK_INFO[networkToUse];
      const discount = networkInfo?.airtimeDiscount || 0;
      const discountAmount = Math.round(amount * discount);

      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < amount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: amount,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, amount.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${amount}`,
          status: "pending",
          description: `Airtime Purchase: ₦${amount} for ${phoneNumber} (${networkInfo?.displayName || networkToUse.toUpperCase()})`,
          relatedUserId: userId,
        });

        // Process the actual purchase if API is configured
        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseAirtime(networkToUse, phoneNumber, amount);
        
        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          // Award reward points (10 points per ₦1,000 spent)
          let pointsEarned = 0;
          try {
            const rewards = await storage.getOrCreateRewardPoints(userId);
            const tierMultiplier: Record<string, number> = {
              bronze: 1,
              silver: 1.25,
              gold: 1.5,
              platinum: 2,
            };
            const multiplier = tierMultiplier[rewards.tier] || 1;
            pointsEarned = Math.floor((amount / 1000) * 10 * multiplier);
            
            if (pointsEarned > 0) {
              await storage.addRewardPoints(
                userId,
                pointsEarned,
                `Earned from ₦${amount.toLocaleString()} airtime purchase`,
                walletTransaction.id,
                "vtu_airtime_purchase"
              );
            }
          } catch (rewardError) {
            console.error("Error adding reward points:", rewardError);
          }

          return res.json({
            success: true,
            message: `₦${amount} airtime purchased successfully for ${phoneNumber}`,
            pointsEarned,
            transaction: {
              id: walletTransaction.id,
              network: networkToUse,
              networkName: networkInfo?.displayName || networkToUse.toUpperCase(),
              amount,
              discountAmount,
              discountPercentage: Math.round(discount * 100),
              phoneNumber,
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        // Refund the user if wallet was deducted
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, amount.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: amount.toString(),
              status: "completed",
              description: `Refund: ₦${amount} airtime for ${phoneNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Airtime refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Airtime purchase failed. Amount refunded to wallet."
          : "Airtime purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Airtime purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process airtime purchase",
        });
      }
    } catch (error) {
      console.error("Error processing airtime purchase:", error);
      res.status(500).json({ message: "Failed to process airtime purchase" });
    }
  });

  // ==================== CABLE TV ENDPOINTS ====================

  // Get all cable TV plans
  app.get("/api/vtu/cable/plans", async (req, res) => {
    try {
      const plans = getAllCablePlans();
      res.json({
        plans,
        providers: CABLE_PROVIDER_INFO,
        totalPlans: plans.length,
      });
    } catch (error) {
      console.error("Error fetching cable TV plans:", error);
      res.status(500).json({ message: "Failed to fetch cable TV plans" });
    }
  });

  // Get cable TV plans by provider (dstv, gotv, startimes)
  app.get("/api/vtu/cable/plans/:provider", async (req, res) => {
    try {
      const { provider } = req.params;
      const validProviders = ["dstv", "gotv", "startimes"];
      
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      const plans = getCablePlansByProvider(provider.toLowerCase() as any);
      const providerInfo = CABLE_PROVIDER_INFO[provider.toLowerCase() as keyof typeof CABLE_PROVIDER_INFO];
      
      res.json({
        provider: providerInfo,
        plans,
        totalPlans: plans.length,
      });
    } catch (error) {
      console.error("Error fetching cable TV plans by provider:", error);
      res.status(500).json({ message: "Failed to fetch cable TV plans" });
    }
  });

  // Validate smart card / IUC number
  app.post("/api/vtu/cable/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { provider, smartCardNumber } = req.body;

      if (!provider || !smartCardNumber) {
        return res.status(400).json({ message: "Provider and smart card number are required" });
      }

      const validProviders = ["dstv", "gotv", "startimes"];
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      const validationResult = await validateSmartCard(provider.toLowerCase(), smartCardNumber);

      if (validationResult.success) {
        res.json({
          success: true,
          message: "Smart card validated successfully",
          customerName: validationResult.data?.customer_name || validationResult.data?.name || "Customer",
          smartCardNumber,
          provider: provider.toLowerCase(),
        });
      } else {
        res.status(400).json({
          success: false,
          message: validationResult.message || "Smart card validation failed",
        });
      }
    } catch (error) {
      console.error("Error validating smart card:", error);
      res.status(500).json({ message: "Failed to validate smart card" });
    }
  });

  // Subscribe to cable TV
  app.post("/api/vtu/cable/subscribe", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { provider, smartCardNumber, planId, customerName } = req.body;

      if (!provider || !smartCardNumber || !planId) {
        return res.status(400).json({ 
          message: "Provider, smart card number, and plan ID are required" 
        });
      }

      const validProviders = ["dstv", "gotv", "startimes"];
      if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid provider. Supported providers: dstv, gotv, startimes" 
        });
      }

      // Get the cable plan
      const plan = getCablePlanById(planId);
      if (!plan) {
        return res.status(404).json({ message: "Cable TV plan not found" });
      }

      if (plan.provider !== provider.toLowerCase()) {
        return res.status(400).json({ message: "Plan does not match provider" });
      }

      const planPrice = plan.sellingPrice;
      const costPrice = plan.apiPrice;
      const profit = plan.profit;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < planPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${planPrice}`,
          status: "pending",
          description: `Cable TV: ${plan.name} for ${smartCardNumber}`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await subscribeCableTV(plan.provider, smartCardNumber, plan.planCode);

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `${plan.name} subscription successful for ${smartCardNumber}`,
            transaction: {
              id: walletTransaction.id,
              provider: plan.provider,
              planName: plan.name,
              duration: plan.duration,
              amount: planPrice,
              costPrice,
              profit,
              smartCardNumber,
              customerName: customerName || "Customer",
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, planPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: planPrice.toString(),
              status: "completed",
              description: `Refund: ${plan.name} for ${smartCardNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Cable TV refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Cable TV subscription failed. Amount refunded to wallet."
          : "Cable TV subscription failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Cable TV subscription error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process cable TV subscription",
        });
      }
    } catch (error) {
      console.error("Error processing cable TV subscription:", error);
      res.status(500).json({ message: "Failed to process cable TV subscription" });
    }
  });

  // ==================== ELECTRICITY ENDPOINTS ====================

  // Get all electricity distribution companies (DISCOs)
  app.get("/api/vtu/electricity/discos", async (req, res) => {
    try {
      const discos = getDiscos();
      res.json({
        discos,
        totalDiscos: discos.length,
      });
    } catch (error) {
      console.error("Error fetching DISCOs:", error);
      res.status(500).json({ message: "Failed to fetch electricity companies" });
    }
  });

  // Validate meter number
  app.post("/api/vtu/electricity/validate", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { disco, meterNumber, meterType } = req.body;

      if (!disco || !meterNumber || !meterType) {
        return res.status(400).json({ 
          message: "DISCO, meter number, and meter type are required" 
        });
      }

      if (!["prepaid", "postpaid"].includes(meterType.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid meter type. Must be 'prepaid' or 'postpaid'" 
        });
      }

      if (!isInlomaxConfigured()) {
        return res.status(503).json({ message: "VTU service is temporarily unavailable" });
      }

      const validationResult = await validateMeterNumber(
        disco.toLowerCase(),
        meterNumber,
        meterType.toLowerCase() as "prepaid" | "postpaid"
      );

      if (validationResult.success) {
        res.json({
          success: true,
          message: "Meter number validated successfully",
          customerName: validationResult.data?.customer_name || validationResult.data?.name || "Customer",
          customerAddress: validationResult.data?.address || "",
          meterNumber,
          disco,
          meterType: meterType.toLowerCase(),
        });
      } else {
        res.status(400).json({
          success: false,
          message: validationResult.message || "Meter number validation failed",
        });
      }
    } catch (error) {
      console.error("Error validating meter number:", error);
      res.status(500).json({ message: "Failed to validate meter number" });
    }
  });

  // Pay electricity bill
  app.post("/api/vtu/electricity/pay", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { disco, meterNumber, meterType, amount, customerName } = req.body;

      if (!disco || !meterNumber || !meterType || !amount) {
        return res.status(400).json({ 
          message: "DISCO, meter number, meter type, and amount are required" 
        });
      }

      if (!["prepaid", "postpaid"].includes(meterType.toLowerCase())) {
        return res.status(400).json({ 
          message: "Invalid meter type. Must be 'prepaid' or 'postpaid'" 
        });
      }

      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount < 500) {
        return res.status(400).json({ message: "Minimum electricity payment is ₦500" });
      }

      if (paymentAmount > 100000) {
        return res.status(400).json({ message: "Maximum electricity payment is ₦100,000" });
      }

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < paymentAmount) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: paymentAmount,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, paymentAmount.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${paymentAmount}`,
          status: "pending",
          description: `Electricity: ₦${paymentAmount} for ${meterNumber} (${disco.toUpperCase()})`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await payElectricityBill(
          disco.toLowerCase(),
          meterNumber,
          meterType.toLowerCase() as "prepaid" | "postpaid",
          paymentAmount,
          customerName || "Customer"
        );

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `₦${paymentAmount} electricity payment successful for ${meterNumber}`,
            transaction: {
              id: walletTransaction.id,
              disco,
              meterNumber,
              meterType: meterType.toLowerCase(),
              amount: paymentAmount,
              customerName: customerName || "Customer",
              token: purchaseResult.token, // For prepaid meters
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, paymentAmount.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: paymentAmount.toString(),
              status: "completed",
              description: `Refund: ₦${paymentAmount} electricity for ${meterNumber}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Electricity refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Electricity payment failed. Amount refunded to wallet."
          : "Electricity payment failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Electricity payment error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process electricity payment",
        });
      }
    } catch (error) {
      console.error("Error processing electricity payment:", error);
      res.status(500).json({ message: "Failed to process electricity payment" });
    }
  });

  // ==================== EXAM PINS ENDPOINTS ====================

  // Get all exam pin types with prices
  app.get("/api/vtu/exam-pins", async (req, res) => {
    try {
      const examPins = getExamPins();
      res.json({
        examPins,
        totalTypes: examPins.length,
      });
    } catch (error) {
      console.error("Error fetching exam pins:", error);
      res.status(500).json({ message: "Failed to fetch exam pins" });
    }
  });

  // Purchase exam pins
  app.post("/api/vtu/exam-pins/purchase", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = purchaseExamPinSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { examType, quantity } = validationResult.data;

      // Get exam pin info
      const examPins = getExamPins();
      const examPin = examPins.find(p => p.type === examType);
      if (!examPin) {
        return res.status(404).json({ message: "Exam pin type not found" });
      }

      const totalPrice = examPin.sellingPrice * quantity;
      const totalCostPrice = examPin.apiPrice * quantity;
      const totalProfit = examPin.profit * quantity;

      // Get user's wallet
      const wallet = await storage.getOrCreateWallet(userId);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < totalPrice) {
        return res.status(400).json({ 
          message: "Insufficient wallet balance",
          required: totalPrice,
          available: walletBalance
        });
      }

      // Deduct from wallet first and track for potential refund
      let walletDeducted = false;
      let walletTransaction: any = null;

      try {
        await storage.updateWalletBalance(userId, totalPrice.toString(), "subtract");
        walletDeducted = true;

        walletTransaction = await storage.createTransaction({
          walletId: wallet.id,
          type: "purchase",
          amount: `-${totalPrice}`,
          status: "pending",
          description: `Exam Pin: ${examPin.name} x${quantity}`,
          relatedUserId: userId,
        });

        if (!isInlomaxConfigured()) {
          throw new Error("VTU_SERVICE_UNAVAILABLE");
        }

        const purchaseResult = await purchaseExamPin(examType as any, quantity);

        if (purchaseResult.success) {
          await storage.updateTransaction(walletTransaction.id, { status: "completed" });

          return res.json({
            success: true,
            message: `${quantity} ${examPin.name} pin(s) purchased successfully`,
            transaction: {
              id: walletTransaction.id,
              examType,
              examName: examPin.name,
              quantity,
              unitPrice: examPin.sellingPrice,
              totalAmount: totalPrice,
              costPrice: totalCostPrice,
              profit: totalProfit,
              pins: purchaseResult.data?.pins || [], // Array of {serial, pin}
              status: "success",
              reference: purchaseResult.reference,
              transactionId: purchaseResult.transactionId,
            },
          });
        } else {
          throw new Error(purchaseResult.message || "API_PURCHASE_FAILED");
        }
      } catch (purchaseError: any) {
        if (walletDeducted) {
          try {
            await storage.updateWalletBalance(userId, totalPrice.toString(), "add");
            
            if (walletTransaction) {
              await storage.updateTransaction(walletTransaction.id, { status: "failed" });
            }

            await storage.createTransaction({
              walletId: wallet.id,
              type: "refund",
              amount: totalPrice.toString(),
              status: "completed",
              description: `Refund: ${examPin.name} x${quantity}`,
              relatedUserId: userId,
            });
          } catch (refundError) {
            console.error("Exam pin refund error:", refundError);
          }
        }

        const errorMessage = purchaseError.message === "VTU_SERVICE_UNAVAILABLE"
          ? "VTU service is temporarily unavailable. Please try again later."
          : purchaseError.message === "API_PURCHASE_FAILED"
          ? "Exam pin purchase failed. Amount refunded to wallet."
          : "Exam pin purchase failed due to network error. Amount refunded to wallet.";

        const statusCode = purchaseError.message === "VTU_SERVICE_UNAVAILABLE" ? 503 : 500;

        console.error("Exam pin purchase error:", purchaseError);
        return res.status(statusCode).json({
          success: false,
          message: walletDeducted ? errorMessage : "Failed to process exam pin purchase",
        });
      }
    } catch (error) {
      console.error("Error processing exam pin purchase:", error);
      res.status(500).json({ message: "Failed to process exam pin purchase" });
    }
  });

  // ==================== SCHEDULED VTU PURCHASES API ROUTES ====================

  // Get user's scheduled purchases
  app.get("/api/vtu/scheduled-purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const purchases = await storage.getScheduledPurchases(userId);
      res.json(purchases);
    } catch (error) {
      console.error("Error fetching scheduled purchases:", error);
      res.status(500).json({ message: "Failed to fetch scheduled purchases" });
    }
  });

  // Create a scheduled purchase
  app.post("/api/vtu/scheduled-purchases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createScheduledPurchaseApiSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      const { serviceType, planId, network, phoneNumber, amount, frequency, dayOfWeek, dayOfMonth, timeOfDay } = validationResult.data;

      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Validate that data purchases have planId
      if (serviceType === "data" && !planId) {
        return res.status(400).json({ message: "Plan ID is required for data purchases" });
      }

      // Validate that airtime purchases have amount
      if (serviceType === "airtime" && !amount) {
        return res.status(400).json({ message: "Amount is required for airtime purchases" });
      }

      // Validate frequency-specific fields
      if (frequency === "weekly" && (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6)) {
        return res.status(400).json({ message: "Day of week (0-6) is required for weekly frequency" });
      }
      if (frequency === "monthly" && (dayOfMonth === undefined || dayOfMonth < 1 || dayOfMonth > 28)) {
        return res.status(400).json({ message: "Day of month (1-28) is required for monthly frequency" });
      }

      // Calculate next run time
      const now = new Date();
      let nextRunAt = new Date();
      const [hours, minutes] = (timeOfDay || "09:00").split(":").map(Number);
      nextRunAt.setHours(hours, minutes, 0, 0);

      if (frequency === "daily") {
        if (nextRunAt <= now) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
      } else if (frequency === "weekly") {
        const currentDay = now.getDay();
        let daysUntilTarget = (dayOfWeek! - currentDay + 7) % 7;
        if (daysUntilTarget === 0 && nextRunAt <= now) {
          daysUntilTarget = 7;
        }
        nextRunAt.setDate(now.getDate() + daysUntilTarget);
      } else if (frequency === "monthly") {
        nextRunAt.setDate(dayOfMonth!);
        if (nextRunAt <= now) {
          nextRunAt.setMonth(nextRunAt.getMonth() + 1);
        }
      }

      const purchase = await storage.createScheduledPurchase({
        userId,
        serviceType,
        planId: planId || null,
        network,
        phoneNumber,
        amount: amount?.toString() || null,
        frequency,
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        timeOfDay: timeOfDay || "09:00",
        nextRunAt,
        status: "active",
      });

      res.status(201).json(purchase);
    } catch (error) {
      console.error("Error creating scheduled purchase:", error);
      res.status(500).json({ message: "Failed to create scheduled purchase" });
    }
  });

  // Update a scheduled purchase
  app.put("/api/vtu/scheduled-purchases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await storage.getScheduledPurchase(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Scheduled purchase not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to update this scheduled purchase" });
      }

      const updateData: Record<string, any> = {};
      const { status, phoneNumber, timeOfDay, frequency, dayOfWeek, dayOfMonth } = req.body;

      if (status && ["active", "paused", "cancelled"].includes(status)) {
        updateData.status = status;
      }

      if (phoneNumber) {
        if (!isValidNigerianPhone(phoneNumber)) {
          return res.status(400).json({ message: "Invalid Nigerian phone number" });
        }
        updateData.phoneNumber = phoneNumber;
      }

      if (timeOfDay) {
        updateData.timeOfDay = timeOfDay;
      }

      if (frequency) {
        updateData.frequency = frequency;
        if (frequency === "weekly" && dayOfWeek !== undefined) {
          updateData.dayOfWeek = dayOfWeek;
        }
        if (frequency === "monthly" && dayOfMonth !== undefined) {
          updateData.dayOfMonth = dayOfMonth;
        }
      }

      const updated = await storage.updateScheduledPurchase(id, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating scheduled purchase:", error);
      res.status(500).json({ message: "Failed to update scheduled purchase" });
    }
  });

  // Delete a scheduled purchase
  app.delete("/api/vtu/scheduled-purchases/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const existing = await storage.getScheduledPurchase(id);
      
      if (!existing) {
        return res.status(404).json({ message: "Scheduled purchase not found" });
      }

      if (existing.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this scheduled purchase" });
      }

      await storage.deleteScheduledPurchase(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting scheduled purchase:", error);
      res.status(500).json({ message: "Failed to delete scheduled purchase" });
    }
  });

  // ==================== GIFT DATA API ROUTES ====================

  // Helper function to generate random gift code
  function generateGiftCode(): string {
    return crypto.randomBytes(4).toString("hex").toUpperCase();
  }

  // Get user's sent gifts
  app.get("/api/vtu/gift-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const gifts = await storage.getGiftsByUser(userId);
      res.json(gifts);
    } catch (error) {
      console.error("Error fetching gifts:", error);
      res.status(500).json({ message: "Failed to fetch gifts" });
    }
  });

  // Create a gift data
  app.post("/api/vtu/gift-data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createGiftDataApiSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors,
        });
      }

      const { recipientPhone, planId, network, message } = validationResult.data;

      if (!isValidNigerianPhone(recipientPhone)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      // Verify the plan exists
      const plan = await storage.getVtuPlan(planId);
      if (!plan) {
        return res.status(400).json({ message: "Invalid data plan" });
      }

      // Check if user has sufficient balance
      const wallet = await storage.getOrCreateWallet(userId);
      const planPrice = parseFloat(plan.sellingPrice);
      const walletBalance = parseFloat(wallet.balance);

      if (walletBalance < planPrice) {
        return res.status(400).json({
          message: "Insufficient wallet balance",
          required: planPrice,
          available: walletBalance,
        });
      }

      // Deduct from wallet
      await storage.updateWalletBalance(userId, planPrice.toString(), "subtract");

      // Create transaction record
      await storage.createTransaction({
        walletId: wallet.id,
        type: "purchase",
        amount: `-${planPrice}`,
        status: "completed",
        description: `Gift Data: ${plan.dataAmount} for ${recipientPhone}`,
      });

      // Generate unique gift code
      let giftCode = generateGiftCode();
      let existingGift = await storage.getGiftByCode(giftCode);
      while (existingGift) {
        giftCode = generateGiftCode();
        existingGift = await storage.getGiftByCode(giftCode);
      }

      // Set expiry (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const gift = await storage.createGiftData({
        senderId: userId,
        recipientPhone,
        planId,
        network,
        message: message || null,
        giftCode,
        status: "pending",
        expiresAt,
      });

      res.status(201).json({
        ...gift,
        plan,
        message: `Gift created successfully. Share the code ${giftCode} with the recipient.`,
      });
    } catch (error) {
      console.error("Error creating gift:", error);
      res.status(500).json({ message: "Failed to create gift" });
    }
  });

  // Claim a gift using gift code
  app.post("/api/vtu/gift-data/:code/claim", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;
      const gift = await storage.getGiftByCode(code.toUpperCase());

      if (!gift) {
        return res.status(404).json({ message: "Gift code not found" });
      }

      if (gift.status === "claimed") {
        return res.status(400).json({ message: "This gift has already been claimed" });
      }

      if (gift.status === "expired") {
        return res.status(400).json({ message: "This gift has expired" });
      }

      if (gift.status === "cancelled") {
        return res.status(400).json({ message: "This gift has been cancelled" });
      }

      if (gift.expiresAt && new Date(gift.expiresAt) < new Date()) {
        // Update status to expired
        await storage.claimGiftData(gift.id, userId);
        return res.status(400).json({ message: "This gift has expired" });
      }

      // Verify the plan still exists
      const plan = await storage.getVtuPlan(gift.planId);
      if (!plan) {
        return res.status(400).json({ message: "Data plan no longer available" });
      }

      // Process the data purchase if Inlomax is configured
      if (isInlomaxConfigured()) {
        try {
          // Map VTU network types to Inlomax network types
          const networkMapping: Record<string, string> = {
            'mtn_sme': 'mtn',
            'glo_cg': 'glo',
            'airtel_cg': 'airtel',
            '9mobile': '9mobile'
          };
          const mappedNetwork = networkMapping[gift.network] || gift.network;
          
          const purchaseResult = await purchaseData(mappedNetwork as any, gift.recipientPhone, plan.dataAmount);
          
          if (purchaseResult.success) {
            // Create VTU transaction record
            const transaction = await storage.createVtuTransaction({
              userId: gift.senderId,
              planId: gift.planId,
              network: gift.network,
              phoneNumber: gift.recipientPhone,
              amount: plan.sellingPrice,
              costPrice: plan.costPrice,
              profit: (parseFloat(plan.sellingPrice) - parseFloat(plan.costPrice)).toFixed(2),
              status: "success",
              smedataReference: purchaseResult.reference,
            });

            // Update gift as claimed with transaction reference
            const claimedGift = await storage.claimGiftData(gift.id, userId);

            res.json({
              success: true,
              message: `Gift claimed successfully! ${plan.dataAmount} data sent to ${gift.recipientPhone}`,
              gift: claimedGift,
            });
          } else {
            res.status(400).json({
              success: false,
              message: purchaseResult.message || "Failed to process the gift data. Please try again.",
            });
          }
        } catch (apiError: any) {
          console.error("Gift data claim API error:", apiError);
          res.status(500).json({
            success: false,
            message: "Failed to process gift due to network error. Please try again.",
          });
        }
      } else {
        // Inlomax not configured - just mark as claimed
        const claimedGift = await storage.claimGiftData(gift.id, userId);
        res.json({
          success: true,
          message: "Gift claimed successfully! Your data will be delivered shortly.",
          gift: claimedGift,
        });
      }
    } catch (error) {
      console.error("Error claiming gift:", error);
      res.status(500).json({ message: "Failed to claim gift" });
    }
  });

  // ==================== SETTINGS API ROUTES ====================

  // Get user's settings
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.getOrCreateUserSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching user settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  // Update user's settings
  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = updateUserSettingsSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      // Convert latitude and longitude from number to string (database stores as decimal string)
      const settingsData = {
        ...validationResult.data,
        latitude: validationResult.data.latitude !== undefined ? String(validationResult.data.latitude) : undefined,
        longitude: validationResult.data.longitude !== undefined ? String(validationResult.data.longitude) : undefined,
      };

      const settings = await storage.updateUserSettings(userId, settingsData);
      res.json(settings);
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Request account deletion
  app.post("/api/settings/delete-account", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = requestAccountDeletionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { usernameConfirmation } = validationResult.data;

      // Get the user to verify the confirmation
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Verify the username/email confirmation
      const expectedConfirmation = user.email.split("@")[0].toLowerCase();
      if (usernameConfirmation.toLowerCase() !== expectedConfirmation && 
          usernameConfirmation.toLowerCase() !== user.email.toLowerCase()) {
        return res.status(400).json({ 
          message: "Username confirmation does not match" 
        });
      }

      const settings = await storage.requestAccountDeletion(userId);
      res.json({
        success: true,
        message: "Account deletion requested. Your account will be deleted after the grace period.",
        settings,
      });
    } catch (error) {
      console.error("Error requesting account deletion:", error);
      res.status(500).json({ message: "Failed to request account deletion" });
    }
  });

  // Cancel account deletion
  app.post("/api/settings/cancel-deletion", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const settings = await storage.cancelAccountDeletion(userId);
      res.json({
        success: true,
        message: "Account deletion cancelled successfully.",
        settings,
      });
    } catch (error) {
      console.error("Error cancelling account deletion:", error);
      res.status(500).json({ message: "Failed to cancel account deletion" });
    }
  });

  // ==================== ADS API ROUTES ====================

  // Get active sponsored ads
  app.get("/api/ads", async (req, res) => {
    try {
      const { type } = req.query;
      const ads = await storage.getActiveSponsoredAds(typeof type === "string" ? type : undefined);
      res.json(ads);
    } catch (error) {
      console.error("Error fetching ads:", error);
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  // Record ad impression
  app.post("/api/ads/:id/impression", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ message: "Ad ID is required" });
      }

      await storage.recordAdImpression(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording ad impression:", error);
      res.status(500).json({ message: "Failed to record impression" });
    }
  });

  // Record ad click
  app.post("/api/ads/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id) {
        return res.status(400).json({ message: "Ad ID is required" });
      }

      await storage.recordAdClick(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording ad click:", error);
      res.status(500).json({ message: "Failed to record click" });
    }
  });

  // ==================== CART API ROUTES ====================

  // Get user's cart items with products
  app.get("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const cartItems = await storage.getCartItems(userId);
      res.json(cartItems);
    } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "Failed to fetch cart items" });
    }
  });

  // Add item to cart
  app.post("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { productId, quantity = 1 } = req.body;

      if (!productId) {
        return res.status(400).json({ message: "Product ID is required" });
      }

      if (typeof quantity !== 'number' || quantity < 1) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }

      // Verify product exists and is available
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (!product.isAvailable) {
        return res.status(400).json({ message: "Product is not available" });
      }

      const cartItem = await storage.addToCart(userId, productId, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error adding to cart:", error);
      res.status(500).json({ message: "Failed to add item to cart" });
    }
  });

  // Update cart item quantity
  app.patch("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { quantity } = req.body;

      if (typeof quantity !== 'number' || quantity < 1) {
        return res.status(400).json({ message: "Quantity must be a positive number" });
      }

      const cartItem = await storage.updateCartItemQuantity(id, quantity);
      res.json(cartItem);
    } catch (error) {
      console.error("Error updating cart item:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ message: "Cart item not found" });
      }
      res.status(500).json({ message: "Failed to update cart item" });
    }
  });

  // Remove item from cart
  app.delete("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      await storage.removeFromCart(id);
      res.json({ message: "Item removed from cart" });
    } catch (error) {
      console.error("Error removing from cart:", error);
      res.status(500).json({ message: "Failed to remove item from cart" });
    }
  });

  // Clear entire cart
  app.delete("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      await storage.clearCart(userId);
      res.json({ message: "Cart cleared" });
    } catch (error) {
      console.error("Error clearing cart:", error);
      res.status(500).json({ message: "Failed to clear cart" });
    }
  });

  // ==================== ORDER API ROUTES ====================

  // Helper function to generate unique order number
  function generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `EKSU-${timestamp}-${random}`;
  }

  // Define valid status transitions
  const validStatusTransitions: Record<string, string[]> = {
    'pending': ['paid', 'cancelled'],
    'paid': ['seller_confirmed', 'cancelled', 'disputed'],
    'seller_confirmed': ['preparing', 'cancelled', 'disputed'],
    'preparing': ['ready_for_pickup', 'cancelled', 'disputed'],
    'ready_for_pickup': ['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'disputed'],
    'shipped': ['out_for_delivery', 'delivered', 'cancelled', 'disputed'],
    'out_for_delivery': ['delivered', 'cancelled', 'disputed'],
    'delivered': ['buyer_confirmed', 'disputed'],
    'buyer_confirmed': ['completed'],
    'completed': [],
    'cancelled': [],
    'disputed': ['refunded', 'completed'],
    'refunded': [],
  };

  // Define who can make which status transitions
  const statusTransitionPermissions: Record<string, 'buyer' | 'seller' | 'both' | 'system'> = {
    'paid': 'system',
    'seller_confirmed': 'seller',
    'preparing': 'seller',
    'ready_for_pickup': 'seller',
    'shipped': 'seller',
    'out_for_delivery': 'seller',
    'delivered': 'seller',
    'buyer_confirmed': 'buyer',
    'completed': 'system',
    'cancelled': 'both',
    'disputed': 'both',
    'refunded': 'system',
  };

  // Create a new order
  app.post("/api/orders", isAuthenticated, requireEmailVerified, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validationResult = createOrderSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }

      const { productId, deliveryMethod, deliveryAddress, deliveryLocation, deliveryNotes, negotiationId } = validationResult.data;

      // Get the product with seller info
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      if (!product.isAvailable) {
        return res.status(400).json({ message: "Product is not available" });
      }

      // Buyer cannot be the same as seller
      if (product.sellerId === userId) {
        return res.status(400).json({ message: "You cannot purchase your own product" });
      }

      // Calculate pricing - convert decimal to number
      let itemPriceNum = parseFloat(product.price as string);
      
      // Check if there's an accepted negotiation for this product
      if (negotiationId) {
        const negotiation = await storage.getNegotiation(negotiationId);
        if (negotiation && negotiation.status === 'accepted' && negotiation.buyerId === userId) {
          // Use the counter offer price if available, otherwise the original offer price
          const negotiatedPrice = negotiation.counterOfferPrice || negotiation.offerPrice;
          itemPriceNum = parseFloat(negotiatedPrice as string);
        }
      }

      const pricing = calculatePricingFromSellerPrice(itemPriceNum);
      
      // Generate unique order number
      const orderNumber = generateOrderNumber();

      // Create the order
      const order = await storage.createOrder({
        orderNumber,
        buyerId: userId,
        sellerId: product.sellerId,
        productId,
        itemPrice: itemPriceNum.toFixed(2),
        platformFee: pricing.platformCommission.toFixed(2),
        paymentFee: pricing.paymentFee.toFixed(2),
        deliveryFee: "0.00",
        totalAmount: pricing.buyerPays.toFixed(2),
        sellerEarnings: pricing.sellerReceives.toFixed(2),
        negotiationId: negotiationId || null,
        status: "pending",
        deliveryMethod: deliveryMethod || "campus_meetup",
        deliveryAddress: deliveryAddress || null,
        deliveryLocation: deliveryLocation || null,
        deliveryNotes: deliveryNotes || null,
      });

      // Add initial status history
      await storage.addOrderStatusHistory({
        orderId: order.id,
        fromStatus: null,
        toStatus: "pending",
        changedBy: userId,
        notes: "Order created",
      });

      // Create notification for the seller about new order
      const buyer = await storage.getUser(userId);
      if (buyer) {
        const buyerName = buyer.firstName && buyer.lastName 
          ? `${buyer.firstName} ${buyer.lastName}` 
          : buyer.email;
        
        await createAndBroadcastNotification({
          userId: product.sellerId,
          type: "order_placed",
          title: "New Order Received",
          message: `${buyerName} placed an order for "${product.title}" - Order #${orderNumber}`,
          link: `/seller-dashboard`,
          relatedUserId: userId,
          relatedProductId: productId,
        });
      }

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Get buyer's orders
  app.get("/api/orders/buyer", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orders = await storage.getBuyerOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching buyer orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get seller's orders
  app.get("/api/orders/seller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const orders = await storage.getSellerOrders(userId);
      res.json(orders);
    } catch (error) {
      console.error("Error fetching seller orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get order details
  app.get("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Only buyer or seller can view the order
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to view this order" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Update order status
  app.put("/api/orders/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const validationResult = updateOrderStatusSchema.safeParse({ orderId: id, ...req.body });
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationResult.error.flatten().fieldErrors 
        });
      }

      const { status, notes } = validationResult.data;

      const order = await storage.getOrder(id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user is buyer or seller
      const isBuyer = order.buyerId === userId;
      const isSeller = order.sellerId === userId;

      if (!isBuyer && !isSeller) {
        return res.status(403).json({ message: "You don't have permission to update this order" });
      }

      // Validate status transition
      const currentStatus = order.status;
      const allowedTransitions = validStatusTransitions[currentStatus] || [];
      
      if (!allowedTransitions.includes(status)) {
        return res.status(400).json({ 
          message: `Cannot transition from '${currentStatus}' to '${status}'`,
          allowedTransitions 
        });
      }

      // Check permission for this status change
      const requiredRole = statusTransitionPermissions[status];
      if (requiredRole === 'buyer' && !isBuyer) {
        return res.status(403).json({ message: "Only the buyer can set this status" });
      }
      if (requiredRole === 'seller' && !isSeller) {
        return res.status(403).json({ message: "Only the seller can set this status" });
      }
      if (requiredRole === 'system') {
        return res.status(403).json({ message: "This status can only be set by the system" });
      }

      // Update the order status
      const updatedOrder = await storage.updateOrderStatus(id, status, userId, notes);

      // Send email notification to both buyer and seller
      try {
        const buyer = order.buyerId ? await storage.getUser(order.buyerId) : null;
        const seller = order.sellerId ? await storage.getUser(order.sellerId) : null;
        const product = order.productId ? await storage.getProduct(order.productId) : null;
        
        if (buyer && product && seller) {
          const statusMessages: Record<string, 'confirmation' | 'shipped' | 'delivered' | 'completed'> = {
            'awaiting_payment': 'confirmation',
            'confirmed': 'confirmation',
            'shipped': 'shipped',
            'delivered': 'delivered',
            'completed': 'completed',
          };
          
          const emailType = statusMessages[status] || 'confirmation';
          const sellerName = seller.firstName && seller.lastName ? `${seller.firstName} ${seller.lastName}` : seller.username || seller.email;
          const buyerDisplayName = buyer.firstName || undefined;
          
          // Send to buyer
          sendOrderEmail(buyer.email, {
            orderId: id,
            productName: product.title,
            totalAmount: order.totalAmount.toString(),
            sellerName,
            buyerName: buyerDisplayName,
            type: emailType,
          }).catch(err => console.error("Failed to send buyer order email:", err));
          
          // Send to seller
          const buyerName = buyer.firstName && buyer.lastName ? `${buyer.firstName} ${buyer.lastName}` : buyer.username || buyer.email;
          sendOrderEmail(seller.email, {
            orderId: id,
            productName: product.title,
            totalAmount: order.totalAmount.toString(),
            sellerName: buyerName,
            type: emailType,
          }).catch(err => console.error("Failed to send seller order email:", err));
        }
      } catch (emailErr) {
        console.error("Error sending order emails:", emailErr);
        // Don't fail the request, just log the error
      }

      res.json(updatedOrder);
    } catch (error) {
      console.error("Error updating order status:", error);
      res.status(500).json({ message: "Failed to update order status" });
    }
  });

  // Get order status history
  app.get("/api/orders/:id/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const order = await storage.getOrder(id);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Only buyer or seller can view the order history
      if (order.buyerId !== userId && order.sellerId !== userId) {
        return res.status(403).json({ message: "You don't have permission to view this order history" });
      }

      const history = await storage.getOrderStatusHistory(id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching order history:", error);
      res.status(500).json({ message: "Failed to fetch order history" });
    }
  });

  // ==================== GAMES API ROUTES ====================

  // Get available game lobbies
  app.get("/api/games", isAuthenticated, async (req: any, res) => {
    try {
      const { gameType } = req.query;
      const games = await storage.getAvailableGames(gameType as string | undefined);
      res.json(games);
    } catch (error) {
      console.error("Error fetching games:", error);
      res.status(500).json({ message: "Failed to fetch games" });
    }
  });

  // Get user's game history
  app.get("/api/games/history", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const games = await storage.getUserGames(userId);
      res.json(games);
    } catch (error) {
      console.error("Error fetching game history:", error);
      res.status(500).json({ message: "Failed to fetch game history" });
    }
  });

  // ==================== WORD BATTLE AI ENDPOINTS (PUBLIC) ====================

  // Validate a word using Groq AI
  app.post("/api/games/validate-word", async (req: any, res) => {
    try {
      const { word } = req.body;
      
      if (!word || typeof word !== "string" || word.length < 2) {
        return res.status(400).json({ 
          valid: false, 
          message: "Word must be at least 2 characters",
          feedback: "Too short! Words need at least 2 letters."
        });
      }

      const cleanWord = word.trim().toLowerCase();
      
      // Check for non-alphabetic characters
      if (!/^[a-z]+$/.test(cleanWord)) {
        return res.status(400).json({ 
          valid: false, 
          message: "Word must contain only letters",
          feedback: "Letters only please! No numbers or symbols."
        });
      }

      const apiKey = process.env.GROQ_API_KEY;
      
      if (!apiKey) {
        // Fallback to basic validation without AI
        return res.json({ 
          valid: true, 
          usedFallback: true,
          feedback: "Word accepted (offline mode)",
          funFact: null
        });
      }

      const groq = new Groq({ apiKey });
      
      const prompt = `You are a word validation assistant for a word game. Determine if "${cleanWord}" is a valid English word.

IMPORTANT RULES:
1. The word must be a real English word found in a standard dictionary
2. Proper nouns (names of people, places, brands) are NOT valid
3. Abbreviations and acronyms are NOT valid
4. Slang that isn't in standard dictionaries is NOT valid
5. The word must be commonly recognized

Respond in this exact JSON format:
{
  "isValid": true or false,
  "feedback": "A fun, encouraging message about the word (1 sentence max)",
  "funFact": "An interesting fact about the word if valid, or null if invalid"
}

Examples:
- "cat" -> {"isValid": true, "feedback": "Nice! A classic word choice.", "funFact": "Cats have been domesticated for about 10,000 years!"}
- "xyz" -> {"isValid": false, "feedback": "That's not a real word - try again!", "funFact": null}
- "london" -> {"isValid": false, "feedback": "That's a proper noun (place name) - regular words only!", "funFact": null}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful word game assistant. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      
      try {
        // Extract JSON from response (handle potential markdown wrapping)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        
        const result = JSON.parse(jsonMatch[0]);
        
        res.json({
          valid: result.isValid === true,
          feedback: result.feedback || (result.isValid ? "Valid word!" : "Not a valid word."),
          funFact: result.funFact || null,
          word: cleanWord
        });
      } catch (parseError) {
        console.error("Failed to parse word validation response:", parseError);
        // Fallback - assume valid if we can't parse
        res.json({ 
          valid: true, 
          usedFallback: true,
          feedback: "Word accepted!",
          funFact: null,
          word: cleanWord
        });
      }
    } catch (error: any) {
      console.error("Error validating word with Groq:", error);
      
      if (error.status === 401) {
        return res.json({ 
          valid: true, 
          usedFallback: true,
          feedback: "Word accepted (API unavailable)",
          funFact: null
        });
      }
      
      if (error.status === 429) {
        return res.json({ 
          valid: true, 
          usedFallback: true,
          feedback: "Word accepted (rate limited)",
          funFact: null
        });
      }

      // Default fallback - accept the word
      res.json({ 
        valid: true, 
        usedFallback: true,
        feedback: "Word accepted!",
        funFact: null
      });
    }
  });

  // Generate a good set of letters for Word Battle using Groq AI
  app.get("/api/games/generate-letters", async (req: any, res) => {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      
      // Fallback letter generation (same as client-side)
      const generateFallbackLetters = () => {
        const VOWELS = "AEIOU";
        const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
        const letters: string[] = [];
        
        const vowelCount = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < vowelCount; i++) {
          letters.push(VOWELS[Math.floor(Math.random() * VOWELS.length)]);
        }
        
        while (letters.length < 7) {
          letters.push(CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]);
        }
        
        // Shuffle
        for (let i = letters.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [letters[i], letters[j]] = [letters[j], letters[i]];
        }
        
        return letters;
      };
      
      if (!apiKey) {
        return res.json({ 
          letters: generateFallbackLetters(),
          hint: null,
          usedFallback: true
        });
      }

      const groq = new Groq({ apiKey });
      
      const prompt = `Generate a set of 7 letters for a word game that allows players to form multiple English words.

REQUIREMENTS:
1. Include exactly 7 letters (can have duplicates)
2. Include 2-3 vowels (A, E, I, O, U) and 4-5 consonants
3. The letters should allow forming at least 5 different valid English words
4. Avoid rare letters like Q, X, Z unless paired with helpful letters
5. Make it challenging but fair - not too easy, not impossible

Respond in this exact JSON format:
{
  "letters": ["A", "R", "T", "S", "E", "N", "O"],
  "possibleWords": ["star", "rate", "arts", "rest", "torn"],
  "hint": "A fun hint about one possible word (optional, 1 sentence)"
}`;

      const completion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: "You are a word game designer. Generate letter sets that are fun and challenging. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 200,
      });

      const responseText = completion.choices[0]?.message?.content || "";
      
      try {
        // Extract JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error("No JSON found in response");
        }
        
        const result = JSON.parse(jsonMatch[0]);
        
        // Validate the letters array
        if (!Array.isArray(result.letters) || result.letters.length !== 7) {
          throw new Error("Invalid letters array");
        }
        
        const letters = result.letters.map((l: string) => String(l).toUpperCase().charAt(0));
        
        // Verify all are valid letters
        const validLetters = letters.every((l: string) => /^[A-Z]$/.test(l));
        if (!validLetters) {
          throw new Error("Invalid letter characters");
        }
        
        res.json({
          letters,
          hint: result.hint || null,
          possibleWordCount: result.possibleWords?.length || 5,
          usedFallback: false
        });
      } catch (parseError) {
        console.error("Failed to parse letter generation response:", parseError);
        res.json({ 
          letters: generateFallbackLetters(),
          hint: null,
          usedFallback: true
        });
      }
    } catch (error: any) {
      console.error("Error generating letters with Groq:", error);
      
      // Fallback to random generation
      const VOWELS = "AEIOU";
      const CONSONANTS = "BCDFGHJKLMNPQRSTVWXYZ";
      const letters: string[] = [];
      
      const vowelCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < vowelCount; i++) {
        letters.push(VOWELS[Math.floor(Math.random() * VOWELS.length)]);
      }
      
      while (letters.length < 7) {
        letters.push(CONSONANTS[Math.floor(Math.random() * CONSONANTS.length)]);
      }
      
      // Shuffle
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
      
      res.json({ 
        letters,
        hint: null,
        usedFallback: true
      });
    }
  });

  // Get single game with players
  app.get("/api/games/:id", isAuthenticated, async (req: any, res) => {
    try {
      const game = await storage.getGame(req.params.id);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }
      res.json(game);
    } catch (error) {
      console.error("Error fetching game:", error);
      res.status(500).json({ message: "Failed to fetch game" });
    }
  });

  // Create a new game lobby
  app.post("/api/games/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = createGameSchema.parse(req.body);
      const stakeAmount = parseFloat(validated.stakeAmount);

      // Verify sufficient balance
      const wallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(wallet.balance) < stakeAmount) {
        return res.status(400).json({ 
          message: `Insufficient balance. You need ${stakeAmount} but have ${wallet.balance}` 
        });
      }

      // Deduct stake from wallet
      await storage.updateWalletBalance(userId, validated.stakeAmount, 'subtract');

      // Create transaction for stake
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'escrow_hold',
        amount: validated.stakeAmount,
        description: `Game stake for ${validated.gameType.replace('_', ' ')}`,
        status: 'completed',
      });

      // Create game
      const game = await storage.createGame({
        gameType: validated.gameType,
        player1Id: userId,
        stakeAmount: validated.stakeAmount,
      });

      res.json(game);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating game:", error);
      res.status(500).json({ message: "Failed to create game" });
    }
  });

  // Join an existing game
  app.post("/api/games/join/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const gameId = req.params.id;

      // Get the game first to check stake amount
      const existingGame = await storage.getGame(gameId);
      if (!existingGame) {
        return res.status(404).json({ message: "Game not found" });
      }

      if (existingGame.status !== "waiting") {
        return res.status(400).json({ message: "Game is no longer available" });
      }

      if (existingGame.player1Id === userId) {
        return res.status(400).json({ message: "Cannot join your own game" });
      }

      const stakeAmount = parseFloat(existingGame.stakeAmount);

      // Verify sufficient balance
      const wallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(wallet.balance) < stakeAmount) {
        return res.status(400).json({ 
          message: `Insufficient balance. You need ${stakeAmount} but have ${wallet.balance}` 
        });
      }

      // Deduct stake from wallet
      await storage.updateWalletBalance(userId, existingGame.stakeAmount, 'subtract');

      // Create transaction for stake
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'escrow_hold',
        amount: existingGame.stakeAmount,
        description: `Game stake for ${existingGame.gameType.replace('_', ' ')}`,
        status: 'completed',
      });

      // Join the game
      const game = await storage.joinGame(gameId, userId);

      res.json(game);
    } catch (error) {
      console.error("Error joining game:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to join game" });
    }
  });

  // Complete a game and pay winner
  app.post("/api/games/:id/complete", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const gameId = req.params.id;
      const validated = completeGameSchema.parse(req.body);

      // Get the game
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Verify user is a player in this game
      if (game.player1Id !== userId && game.player2Id !== userId) {
        return res.status(403).json({ message: "You are not a player in this game" });
      }

      if (game.status !== "in_progress") {
        return res.status(400).json({ message: "Game is not in progress" });
      }

      // Verify winner is a valid player
      if (validated.winnerId !== game.player1Id && validated.winnerId !== game.player2Id) {
        return res.status(400).json({ message: "Invalid winner" });
      }

      // Calculate prize (total stakes - platform fee)
      const totalStake = parseFloat(game.stakeAmount) * 2;
      const platformFee = totalStake * 0.05; // 5% platform fee
      const winnerPrize = totalStake - platformFee;

      // Complete the game
      const completedGame = await storage.completeGame(gameId, validated.winnerId);

      // Pay winner
      const winnerWallet = await storage.getOrCreateWallet(validated.winnerId);
      await storage.updateWalletBalance(validated.winnerId, winnerPrize.toFixed(2), 'add');

      // Create transaction for winnings
      await storage.createTransaction({
        walletId: winnerWallet.id,
        type: 'escrow_release',
        amount: winnerPrize.toFixed(2),
        description: `${game.gameType.replace('_', ' ')} game winnings`,
        status: 'completed',
      });

      res.json({
        game: completedGame,
        winnings: winnerPrize,
        platformFee,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error completing game:", error);
      res.status(500).json({ message: "Failed to complete game" });
    }
  });

  // Cancel a game (only creator can cancel before anyone joins)
  app.post("/api/games/:id/cancel", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const gameId = req.params.id;

      // Get the game
      const game = await storage.getGame(gameId);
      if (!game) {
        return res.status(404).json({ message: "Game not found" });
      }

      // Only creator can cancel
      if (game.player1Id !== userId) {
        return res.status(403).json({ message: "Only the game creator can cancel" });
      }

      // Can only cancel waiting games
      if (game.status !== "waiting") {
        return res.status(400).json({ message: "Cannot cancel a game that has already started" });
      }

      // Refund the stake
      const wallet = await storage.getOrCreateWallet(userId);
      await storage.updateWalletBalance(userId, game.stakeAmount, 'add');

      // Create refund transaction
      await storage.createTransaction({
        walletId: wallet.id,
        type: 'refund',
        amount: game.stakeAmount,
        description: `Refund for cancelled ${game.gameType.replace('_', ' ')} game`,
        status: 'completed',
      });

      // Cancel the game
      const cancelledGame = await storage.cancelGame(gameId);

      res.json(cancelledGame);
    } catch (error) {
      console.error("Error cancelling game:", error);
      res.status(500).json({ message: "Failed to cancel game" });
    }
  });

  // Get leaderboard for a specific game type
  app.get("/api/games/leaderboard/:gameType", async (req: any, res) => {
    try {
      const { gameType } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getLeaderboard(gameType, limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get global leaderboard (all games combined)
  app.get("/api/games/leaderboard", async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await storage.getGlobalLeaderboard(limit);
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching global leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get random trivia question
  app.get("/api/games/trivia/question", isAuthenticated, async (req: any, res) => {
    try {
      const question = await storage.getRandomTriviaQuestion();
      if (!question) {
        return res.status(404).json({ message: "No trivia questions available" });
      }
      res.json(question);
    } catch (error) {
      console.error("Error fetching trivia question:", error);
      res.status(500).json({ message: "Failed to fetch trivia question" });
    }
  });

  // Generate trivia questions using Groq AI
  app.post("/api/games/trivia/questions", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      
      if (!apiKey) {
        console.warn("GROQ_API_KEY not configured, returning error");
        return res.status(503).json({ 
          message: "AI question generation not available. Please configure GROQ_API_KEY.",
          useFallback: true
        });
      }

      const groq = new Groq({ apiKey });

      const categories = ["General Knowledge", "Nigerian Culture", "Campus Life", "Sports", "Entertainment"];
      const difficulties = ["easy", "medium", "hard"];

      const prompt = `Generate exactly 10 trivia questions for Nigerian university students. 
      
Requirements:
- Questions should be relevant to Nigerian culture, campus life, current affairs, sports, and entertainment
- Mix of difficulty levels: 4 easy, 4 medium, 2 hard questions
- Categories to use: ${categories.join(", ")}
- Each question must have exactly 4 answer options
- Questions should be educational, fun, and appropriate for university students
- Include questions about Nigerian music artists, Nollywood, Nigerian football, campus slang, Nigerian history, food, festivals, and pop culture

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "id": 1,
    "category": "General Knowledge",
    "question": "What is the capital of Nigeria?",
    "options": ["Lagos", "Abuja", "Kano", "Ibadan"],
    "correctAnswer": 1,
    "difficulty": "easy"
  }
]

The correctAnswer is the 0-based index of the correct option in the options array.
Generate exactly 10 unique questions with varied topics across all categories.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a trivia question generator specializing in Nigerian culture and university life. You always respond with valid JSON arrays only, no markdown formatting or explanations."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 3000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        console.error("Empty response from Groq API");
        return res.status(500).json({ 
          message: "Failed to generate questions - empty response",
          useFallback: true
        });
      }

      // Parse and validate the response
      let questions;
      try {
        // Clean the response - remove any markdown formatting
        let cleanedResponse = responseContent.trim();
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.slice(7);
        }
        if (cleanedResponse.startsWith("```")) {
          cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith("```")) {
          cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();

        questions = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse Groq response:", parseError);
        console.error("Raw response:", responseContent);
        return res.status(500).json({ 
          message: "Failed to parse AI response",
          useFallback: true
        });
      }

      // Validate the questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        console.error("Invalid questions array from Groq");
        return res.status(500).json({ 
          message: "Invalid questions format from AI",
          useFallback: true
        });
      }

      // Validate and sanitize each question
      const validatedQuestions = questions.map((q: any, index: number) => ({
        id: index + 1,
        category: categories.includes(q.category) ? q.category : "General Knowledge",
        question: String(q.question || ""),
        options: Array.isArray(q.options) && q.options.length === 4 
          ? q.options.map((opt: any) => String(opt))
          : ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer <= 3 
          ? q.correctAnswer 
          : 0,
        difficulty: difficulties.includes(q.difficulty) ? q.difficulty : "medium"
      }));

      // Ensure we have exactly 10 questions
      const finalQuestions = validatedQuestions.slice(0, 10);
      
      if (finalQuestions.length < 10) {
        console.warn(`Only got ${finalQuestions.length} valid questions from AI`);
      }

      console.log(`Generated ${finalQuestions.length} trivia questions using Groq AI`);
      res.json({ questions: finalQuestions, isAIGenerated: true });
    } catch (error: any) {
      console.error("Error generating trivia questions with Groq:", error);
      
      // Check for specific API errors
      if (error.status === 401) {
        return res.status(503).json({ 
          message: "Invalid Groq API key",
          useFallback: true
        });
      }
      
      if (error.status === 429) {
        return res.status(503).json({ 
          message: "Rate limit exceeded. Please try again later.",
          useFallback: true
        });
      }

      res.status(500).json({ 
        message: "Failed to generate questions",
        useFallback: true
      });
    }
  });

  // Generate trivia questions with category filtering using Groq AI
  app.post("/api/games/generate-trivia-questions", isAuthenticated, async (req: any, res) => {
    try {
      const apiKey = process.env.GROQ_API_KEY;
      const { category, difficulty, count = 10 } = req.body;
      
      if (!apiKey || apiKey === "not-set") {
        console.warn("GROQ_API_KEY not configured, returning fallback signal");
        return res.status(503).json({ 
          message: "AI question generation not available. Please configure GROQ_API_KEY.",
          useFallback: true,
          isAIGenerated: false
        });
      }

      const groq = new Groq({ apiKey });

      const allCategories = ["General Knowledge", "Nigerian Culture", "Campus Life", "Sports", "Entertainment"];
      const validCategory = category && allCategories.includes(category) ? category : null;
      const difficulties = ["easy", "medium", "hard"];
      const validDifficulty = difficulty && difficulties.includes(difficulty) ? difficulty : null;
      const questionCount = Math.min(Math.max(parseInt(count) || 10, 5), 20);

      let categoryInstruction = "";
      if (validCategory) {
        categoryInstruction = `Focus ONLY on the category: ${validCategory}. All questions must be from this category.`;
      } else {
        categoryInstruction = `Mix questions from these categories: ${allCategories.join(", ")}.`;
      }

      let difficultyInstruction = "";
      if (validDifficulty) {
        difficultyInstruction = `All questions should be ${validDifficulty} difficulty.`;
      } else {
        difficultyInstruction = `Mix of difficulty levels: roughly 40% easy, 40% medium, 20% hard questions.`;
      }

      const prompt = `Generate exactly ${questionCount} unique trivia questions for Nigerian university students.
      
Requirements:
${categoryInstruction}
${difficultyInstruction}
- Questions should be relevant to Nigerian culture, campus life, current affairs, sports, and entertainment
- Each question must have exactly 4 answer options
- Questions should be educational, fun, and appropriate for university students
- Include variety: Nigerian music artists, Nollywood, Nigerian football, campus slang, Nigerian history, food, festivals, pop culture, tech, social media trends
- Make questions engaging and current - include recent events and trending topics from 2023-2024
- Avoid repeating similar questions - each should test different knowledge

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "id": 1,
    "category": "${validCategory || 'General Knowledge'}",
    "question": "What is the capital of Nigeria?",
    "options": ["Lagos", "Abuja", "Kano", "Ibadan"],
    "correctAnswer": 1,
    "difficulty": "easy"
  }
]

The correctAnswer is the 0-based index of the correct option in the options array.
Generate exactly ${questionCount} unique questions with varied topics.`;

      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a trivia question generator specializing in Nigerian culture, university life, and current events. You create engaging, accurate, and educational questions. You always respond with valid JSON arrays only, no markdown formatting or explanations. Your questions are fresh, relevant, and test real knowledge."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        model: "llama-3.3-70b-versatile",
        temperature: 0.85,
        max_tokens: 4000,
      });

      const responseContent = completion.choices[0]?.message?.content;
      
      if (!responseContent) {
        console.error("Empty response from Groq API");
        return res.status(500).json({ 
          message: "Failed to generate questions - empty response",
          useFallback: true,
          isAIGenerated: false
        });
      }

      // Parse and validate the response
      let questions;
      try {
        // Clean the response - remove any markdown formatting
        let cleanedResponse = responseContent.trim();
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.slice(7);
        }
        if (cleanedResponse.startsWith("```")) {
          cleanedResponse = cleanedResponse.slice(3);
        }
        if (cleanedResponse.endsWith("```")) {
          cleanedResponse = cleanedResponse.slice(0, -3);
        }
        cleanedResponse = cleanedResponse.trim();

        questions = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse Groq response:", parseError);
        console.error("Raw response:", responseContent);
        return res.status(500).json({ 
          message: "Failed to parse AI response",
          useFallback: true,
          isAIGenerated: false
        });
      }

      // Validate the questions structure
      if (!Array.isArray(questions) || questions.length === 0) {
        console.error("Invalid questions array from Groq");
        return res.status(500).json({ 
          message: "Invalid questions format from AI",
          useFallback: true,
          isAIGenerated: false
        });
      }

      // Validate and sanitize each question
      const validatedQuestions = questions.map((q: any, index: number) => ({
        id: index + 1,
        category: allCategories.includes(q.category) ? q.category : (validCategory || "General Knowledge"),
        question: String(q.question || ""),
        options: Array.isArray(q.options) && q.options.length === 4 
          ? q.options.map((opt: any) => String(opt))
          : ["Option A", "Option B", "Option C", "Option D"],
        correctAnswer: typeof q.correctAnswer === "number" && q.correctAnswer >= 0 && q.correctAnswer <= 3 
          ? q.correctAnswer 
          : 0,
        difficulty: difficulties.includes(q.difficulty) ? q.difficulty : "medium"
      }));

      // Filter out any questions with empty question text
      const finalQuestions = validatedQuestions.filter((q: any) => q.question && q.question.length > 0).slice(0, questionCount);
      
      if (finalQuestions.length < questionCount) {
        console.warn(`Only got ${finalQuestions.length} valid questions from AI (requested ${questionCount})`);
      }

      console.log(`Generated ${finalQuestions.length} trivia questions using Groq AI${validCategory ? ` for category: ${validCategory}` : ""}`);
      res.json({ 
        questions: finalQuestions, 
        isAIGenerated: true,
        category: validCategory,
        difficulty: validDifficulty,
        count: finalQuestions.length
      });
    } catch (error: any) {
      console.error("Error generating trivia questions with Groq:", error);
      
      // Check for specific API errors
      if (error.status === 401) {
        return res.status(503).json({ 
          message: "Invalid Groq API key",
          useFallback: true,
          isAIGenerated: false
        });
      }
      
      if (error.status === 429) {
        return res.status(503).json({ 
          message: "Rate limit exceeded. Please try again later.",
          useFallback: true,
          isAIGenerated: false
        });
      }

      res.status(500).json({ 
        message: "Failed to generate questions",
        useFallback: true,
        isAIGenerated: false
      });
    }
  });

  // Get random typing text
  app.get("/api/games/typing/text", isAuthenticated, async (req: any, res) => {
    try {
      const text = await storage.getRandomTypingText();
      if (!text) {
        return res.status(404).json({ message: "No typing texts available" });
      }
      res.json(text);
    } catch (error) {
      console.error("Error fetching typing text:", error);
      res.status(500).json({ message: "Failed to fetch typing text" });
    }
  });

  // Get random price guess product
  app.get("/api/games/price-guess/product", isAuthenticated, async (req: any, res) => {
    try {
      const product = await storage.getRandomPriceGuessProduct();
      if (!product) {
        return res.status(404).json({ message: "No products available" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching price guess product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  // Update game score (single player game completion)
  app.post("/api/games/score", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { gameType, won, score, earnings } = req.body;
      const updated = await storage.updateGameScore(userId, gameType, won, score, earnings);
      res.json(updated);
    } catch (error) {
      console.error("Error updating game score:", error);
      res.status(500).json({ message: "Failed to update score" });
    }
  });

  // Seed game content
  app.post("/api/games/seed", async (req: any, res) => {
    try {
      await storage.seedGameContent();
      res.json({ message: "Game content seeded successfully" });
    } catch (error) {
      console.error("Error seeding game content:", error);
      res.status(500).json({ message: "Failed to seed game content" });
    }
  });

  // ==================== USER RELATIONSHIPS (Block/Mute/Report) ====================

  // Block a user
  app.post("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      if (targetId === userId) {
        return res.status(400).json({ message: "You cannot block yourself" });
      }

      const targetUser = await storage.getUser(targetId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const block = await storage.blockUser(userId, targetId);
      res.json({ success: true, block });
    } catch (error) {
      console.error("Error blocking user:", error);
      res.status(500).json({ message: "Failed to block user" });
    }
  });

  // Unblock a user
  app.delete("/api/users/:id/block", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      await storage.unblockUser(userId, targetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unblocking user:", error);
      res.status(500).json({ message: "Failed to unblock user" });
    }
  });

  // Mute a user
  app.post("/api/users/:id/mute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      if (targetId === userId) {
        return res.status(400).json({ message: "You cannot mute yourself" });
      }

      const targetUser = await storage.getUser(targetId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const mute = await storage.muteUser(userId, targetId);
      res.json({ success: true, mute });
    } catch (error) {
      console.error("Error muting user:", error);
      res.status(500).json({ message: "Failed to mute user" });
    }
  });

  // Unmute a user
  app.delete("/api/users/:id/mute", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      await storage.unmuteUser(userId, targetId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unmuting user:", error);
      res.status(500).json({ message: "Failed to unmute user" });
    }
  });

  // Report a user
  app.post("/api/users/:id/report", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      if (targetId === userId) {
        return res.status(400).json({ message: "You cannot report yourself" });
      }

      const targetUser = await storage.getUser(targetId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      const { reason, description } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      const validReasons = ["spam", "harassment", "scam", "inappropriate", "other"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ message: "Invalid reason" });
      }

      const report = await storage.createUserReport({
        reporterId: userId,
        reportedId: targetId,
        reason,
        description: description || null,
      });

      res.json({ success: true, report });
    } catch (error) {
      console.error("Error reporting user:", error);
      res.status(500).json({ message: "Failed to report user" });
    }
  });

  // Get list of blocked users
  app.get("/api/users/blocked", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const blockedUsers = await storage.getBlockedUsers(userId);
      res.json(blockedUsers);
    } catch (error) {
      console.error("Error fetching blocked users:", error);
      res.status(500).json({ message: "Failed to fetch blocked users" });
    }
  });

  // Get list of muted users
  app.get("/api/users/muted", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const mutedUsers = await storage.getMutedUsers(userId);
      res.json(mutedUsers);
    } catch (error) {
      console.error("Error fetching muted users:", error);
      res.status(500).json({ message: "Failed to fetch muted users" });
    }
  });

  // Get relationship status with a user
  app.get("/api/users/:id/relationship", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const targetId = req.params.id;
      const relationship = await storage.getUserRelationship(userId, targetId);
      res.json(relationship);
    } catch (error) {
      console.error("Error fetching user relationship:", error);
      res.status(500).json({ message: "Failed to fetch user relationship" });
    }
  });

  // ==================== KYC VERIFICATION ROUTES ====================

  // Get current user's KYC status
  app.get("/api/kyc/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const kyc = await storage.getKycVerification(userId);
      if (!kyc) {
        return res.json({
          hasKyc: false,
          status: null,
          message: "No KYC verification found. Please initiate verification.",
        });
      }

      res.json({
        hasKyc: true,
        id: kyc.id,
        status: kyc.status,
        paymentStatus: kyc.paymentStatus,
        similarityScore: kyc.similarityScore,
        rejectionReason: kyc.rejectionReason,
        createdAt: kyc.createdAt,
        reviewedAt: kyc.reviewedAt,
      });
    } catch (error) {
      console.error("Error fetching KYC status:", error);
      res.status(500).json({ message: "Failed to fetch KYC status" });
    }
  });

  // Initiate KYC payment
  app.post("/api/kyc/initiate-payment", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check for existing KYC verification
      const existingKyc = await storage.getKycVerification(userId);
      if (existingKyc) {
        if (existingKyc.status === "approved") {
          return res.status(400).json({ message: "You are already KYC verified" });
        }
        if (existingKyc.status === "pending_verification" || existingKyc.status === "manual_review") {
          return res.status(400).json({ 
            message: "You have a pending KYC verification",
            kycId: existingKyc.id,
            status: existingKyc.status
          });
        }
        // Allow re-initiating if rejected or refunded
        if (existingKyc.status !== "rejected" && existingKyc.status !== "refunded") {
          return res.status(400).json({ 
            message: "You have an existing KYC process in progress",
            kycId: existingKyc.id,
            status: existingKyc.status
          });
        }
      }

      // Get user info for payment
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create or update KYC verification record
      const kyc = await storage.createKycVerification(userId);

      // Check if Squad is configured
      if (!isSquadConfigured()) {
        // Log the action and return pending payment status
        await storage.createKycLog({
          kycId: kyc.id,
          userId,
          action: "payment_initiated",
          result: "pending",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { note: "Squad payment gateway not configured" }
        });

        return res.json({
          success: true,
          kycId: kyc.id,
          message: "KYC initiated. Payment gateway is being configured.",
          paymentRequired: true,
          amount: 200,
        });
      }

      // Generate payment reference
      const paymentReference = generatePaymentReference();

      // Create Squad payment request for ₦200 KYC fee
      const paymentData = {
        amount: 20000, // ₦200 in kobo
        email: user.email,
        currency: 'NGN' as const,
        initiate_type: "inline",
        transaction_ref: paymentReference,
        callback_url: `${process.env.APP_URL || 'https://eksu-marketplace.replit.app'}/kyc/payment-callback`,
        metadata: {
          kycId: kyc.id,
          userId: userId,
          type: "kyc_verification"
        }
      };

      // Update KYC record with payment reference
      await storage.updateKycVerification(kyc.id, {
        paymentReference,
        paymentStatus: "pending",
      });

      // Log the payment initiation
      await storage.createKycLog({
        kycId: kyc.id,
        userId,
        action: "payment_initiated",
        result: "pending",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { paymentReference }
      });

      // Initialize Squad payment
      try {
        const squadResponse = await squad.initializePayment(paymentData);
        
        res.json({
          success: true,
          kycId: kyc.id,
          paymentUrl: squadResponse.checkoutUrl,
          paymentReference,
          amount: 200,
          message: "Please complete the payment to proceed with KYC verification",
        });
      } catch (squadError: any) {
        console.error("Squad payment error:", squadError);
        res.json({
          success: true,
          kycId: kyc.id,
          message: "Payment gateway temporarily unavailable. Please try again later.",
          paymentRequired: true,
          amount: 200,
        });
      }
    } catch (error) {
      console.error("Error initiating KYC payment:", error);
      res.status(500).json({ message: "Failed to initiate KYC verification" });
    }
  });

  // Submit NIN details for verification
  app.post("/api/kyc/submit-nin", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate request body
      const validationResult = initiateKycSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { nin, firstName, lastName, dateOfBirth, consent } = validationResult.data;

      // Get KYC verification
      const kyc = await storage.getKycVerification(userId);
      if (!kyc) {
        return res.status(400).json({ 
          message: "Please initiate KYC verification first by paying the verification fee" 
        });
      }

      // Check if payment is completed (skip check if payment gateway not configured)
      if (isSquadConfigured() && kyc.paymentStatus !== "completed") {
        return res.status(400).json({ 
          message: "Please complete the payment first",
          paymentStatus: kyc.paymentStatus
        });
      }

      // Check if KYC is already in progress or completed
      if (kyc.status === "approved") {
        return res.status(400).json({ message: "You are already KYC verified" });
      }
      if (kyc.status === "pending_verification" && kyc.ninPhotoUrl) {
        return res.status(400).json({ 
          message: "NIN already submitted. Please upload your selfie to complete verification",
          status: kyc.status
        });
      }

      // Log the NIN submission
      await storage.createKycLog({
        kycId: kyc.id,
        userId,
        action: "nin_submitted",
        result: "pending",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { nin: nin.slice(0, 3) + "****" + nin.slice(-3) } // Masked NIN for logging
      });

      // Call SMEDATA.NG API to verify NIN and get photo
      // TODO: Implement actual NIN verification API integration
      // For now, use a stub that simulates the verification process
      const verifyNINStub = async (nin: string, firstName: string, lastName: string, dateOfBirth: string) => {
        // This is a placeholder - in production, this would call the actual SMEDATA.NG API
        console.log(`NIN verification requested for ${firstName} ${lastName} with NIN: ${nin.slice(0, 3)}****${nin.slice(-3)}`);
        return {
          success: false,
          message: "NIN verification service is not yet configured. Please contact support.",
          data: null
        };
      };
      const ninVerification = await verifyNINStub(nin, firstName, lastName, dateOfBirth);

      if (!ninVerification.success || !ninVerification.data) {
        // Log the failure
        await storage.createKycLog({
          kycId: kyc.id,
          userId,
          action: "nin_verification",
          result: "failed",
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { error: ninVerification.error || ninVerification.message }
        });

        return res.status(400).json({
          success: false,
          message: ninVerification.message || "NIN verification failed. Please check your details and try again.",
          error: ninVerification.error
        });
      }

      // Store NIN verification data (temporarily, will be deleted after verification)
      const ninPhotoBase64 = ninVerification.data.photo;
      let ninPhotoUrl = null;

      if (ninPhotoBase64) {
        // Store the base64 photo temporarily - in production, you'd upload to object storage
        ninPhotoUrl = `data:image/jpeg;base64,${ninPhotoBase64}`;
      }

      // Update KYC record with NIN data
      await storage.updateKycVerification(kyc.id, {
        nin: nin, // Store temporarily, will be deleted after verification
        ninFirstName: ninVerification.data.firstname,
        ninLastName: ninVerification.data.surname,
        ninDateOfBirth: ninVerification.data.birthdate,
        ninPhotoUrl: ninPhotoUrl,
        consentGiven: consent,
        consentTimestamp: new Date(),
        status: "pending_verification",
        smedataResponse: ninVerification.data,
      });

      // Log successful NIN verification
      await storage.createKycLog({
        kycId: kyc.id,
        userId,
        action: "nin_verification",
        result: "success",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { 
          matchedName: `${ninVerification.data.firstname} ${ninVerification.data.surname}`,
          hasPhoto: !!ninPhotoBase64
        }
      });

      res.json({
        success: true,
        message: "NIN verified successfully. Please upload your selfie to complete verification.",
        kycId: kyc.id,
        status: "pending_verification",
        verifiedName: `${ninVerification.data.firstname} ${ninVerification.data.surname}`,
        hasPhoto: !!ninPhotoBase64,
      });
    } catch (error) {
      console.error("Error submitting NIN for verification:", error);
      res.status(500).json({ message: "Failed to verify NIN" });
    }
  });

  // Upload selfie for comparison
  app.post("/api/kyc/upload-selfie", isAuthenticated, upload.single("selfie"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get KYC verification
      const kyc = await storage.getKycVerification(userId);
      if (!kyc) {
        return res.status(400).json({ message: "Please initiate KYC verification first" });
      }

      if (kyc.status === "approved") {
        return res.status(400).json({ message: "You are already KYC verified" });
      }

      if (!kyc.ninPhotoUrl) {
        return res.status(400).json({ 
          message: "Please submit your NIN details first",
          status: kyc.status
        });
      }

      // Check if selfie file was uploaded
      if (!req.file) {
        return res.status(400).json({ message: "Please upload a selfie image" });
      }

      // Log the selfie upload
      await storage.createKycLog({
        kycId: kyc.id,
        userId,
        action: "selfie_uploaded",
        result: "pending",
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });

      // Upload selfie to object storage
      let selfieUrl: string;
      try {
        if (isCloudinaryConfigured()) {
          const uploadResult = await uploadToObjectStorage(req.file, `kyc/selfie_${userId}`);
          if (uploadResult) {
            selfieUrl = uploadResult;
          } else {
            selfieUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
          }
        } else {
          // Store locally as base64 for development
          selfieUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
        }
      } catch (uploadError) {
        console.error("Selfie upload error:", uploadError);
        return res.status(500).json({ message: "Failed to upload selfie" });
      }

      // FACE COMPARISON: SMEDATA.NG provides NIN verification but NOT face comparison.
      // For production, integrate QoreID (https://docs.qoreid.com/docs/nin-face-match) or 
      // IdentityPass (https://developer.myidentitypass.com) for NIN + Face verification.
      // Alternatively, use AWS Rekognition or Azure Face API for standalone face comparison.
      // 
      // Example QoreID integration would call their API with the selfie and NIN, returning
      // a match_score (0-100) with threshold of 70% for genuine face matching.
      //
      // Current implementation uses a placeholder random score for development/testing.
      // TODO: Replace with real face comparison API (set FACE_API_KEY env var)
      let similarityScore: number;
      
      // Check if a face comparison API is configured
      if (process.env.QOREID_API_KEY) {
        // Placeholder for QoreID integration - would make API call here
        // const response = await fetch('https://api.qoreid.com/v1/ng/identities/face-verification/nin', {...})
        // similarityScore = response.data.summary.face_verification_check.match_score
        console.log("QoreID API key found - would use real face comparison here");
        similarityScore = Math.floor(Math.random() * 36) + 60; // Placeholder until integrated
      } else {
        // Development/demo mode: generate random score between 60-95
        console.log("No face comparison API configured - using simulated score for demo");
        similarityScore = Math.floor(Math.random() * 36) + 60;
      }

      // Determine verification result based on similarity score
      let status: "approved" | "manual_review" | "rejected";
      let autoDecision = "";

      if (similarityScore >= 85) {
        status = "approved";
        autoDecision = "auto_approved";
      } else if (similarityScore >= 70) {
        status = "manual_review";
        autoDecision = "manual_review_required";
      } else {
        status = "rejected";
        autoDecision = "auto_rejected";
      }

      // Update KYC record with selfie and comparison result
      await storage.updateKycVerification(kyc.id, {
        selfieUrl,
        similarityScore: similarityScore.toString(),
        status,
        ...(status === "approved" ? { reviewedAt: new Date() } : {}),
      });

      // Log the comparison result
      await storage.createKycLog({
        kycId: kyc.id,
        userId,
        action: "photo_comparison",
        result: autoDecision,
        similarityScore: similarityScore,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
        metadata: { 
          decision: status,
          threshold: { autoApprove: 85, manualReview: 70, reject: 0 }
        }
      });

      // If auto-approved, update user's verification status
      if (status === "approved") {
        await storage.updateUserProfile(userId, {
          ninVerified: true,
          isVerified: true,
        });

        // Log the approval
        await storage.createKycLog({
          kycId: kyc.id,
          userId,
          action: "auto_approved",
          result: "success",
          similarityScore: similarityScore,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });

        // Clean up sensitive data after successful verification
        await storage.updateKycVerification(kyc.id, {
          nin: null,
          ninPhotoUrl: null,
          selfieUrl: null,
          imagesDeletedAt: new Date(),
        });

        res.json({
          success: true,
          message: "Congratulations! Your identity has been verified successfully.",
          status: "approved",
          similarityScore,
        });
      } else if (status === "manual_review") {
        res.json({
          success: true,
          message: "Your verification is under review. We'll notify you once it's complete.",
          status: "manual_review",
          similarityScore,
        });
      } else {
        // Rejected - process refund
        const wallet = await storage.getOrCreateWallet(userId);
        await storage.updateWalletBalance(userId, "200", "add");
        
        // Create refund transaction
        await storage.createTransaction({
          walletId: wallet.id,
          type: "refund",
          amount: "200",
          status: "completed",
          description: "KYC verification fee refund - photo mismatch",
          relatedUserId: userId,
        });

        // Update KYC status to refunded
        await storage.updateKycVerification(kyc.id, {
          status: "refunded",
          rejectionReason: "Photo comparison score too low. The selfie does not sufficiently match the NIN photo.",
        });

        // Log the rejection and refund
        await storage.createKycLog({
          kycId: kyc.id,
          userId,
          action: "auto_rejected_refunded",
          result: "refunded",
          similarityScore: similarityScore,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
          metadata: { refundAmount: 200 }
        });

        // Clean up sensitive data
        await storage.updateKycVerification(kyc.id, {
          nin: null,
          ninPhotoUrl: null,
          selfieUrl: null,
          imagesDeletedAt: new Date(),
        });

        res.json({
          success: false,
          message: "Verification failed. The selfie does not match the NIN photo. Your ₦200 fee has been refunded.",
          status: "rejected",
          similarityScore,
          refunded: true,
        });
      }
    } catch (error) {
      console.error("Error processing selfie upload:", error);
      res.status(500).json({ message: "Failed to process selfie" });
    }
  });

  // Admin: Review pending KYC verifications
  app.post("/api/kyc/admin/review", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is admin
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      // Validate request body
      const validationResult = reviewKycSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Validation failed",
          errors: validationResult.error.flatten().fieldErrors
        });
      }

      const { kycId, action, notes, rejectionReason } = validationResult.data;

      // Get the KYC verification
      const kyc = await storage.getKycVerificationById(kycId);
      if (!kyc) {
        return res.status(404).json({ message: "KYC verification not found" });
      }

      if (kyc.status !== "manual_review") {
        return res.status(400).json({ 
          message: "This KYC verification is not pending review",
          currentStatus: kyc.status
        });
      }

      const targetUserId = kyc.userId;

      if (action === "approve") {
        // Approve the verification
        await storage.updateKycVerification(kycId, {
          status: "approved",
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
        });

        // Update user's verification status
        await storage.updateUserProfile(targetUserId, {
          ninVerified: true,
          isVerified: true,
        });

        // Log the approval
        await storage.createKycLog({
          kycId,
          userId: targetUserId,
          action: "manual_approved",
          result: "success",
          reviewedBy: userId,
          similarityScore: kyc.similarityScore ? parseFloat(kyc.similarityScore) : undefined,
          metadata: { notes, adminId: userId }
        });

        // Clean up sensitive data after approval
        await storage.updateKycVerification(kycId, {
          nin: null,
          ninPhotoUrl: null,
          selfieUrl: null,
          imagesDeletedAt: new Date(),
        });

        res.json({
          success: true,
          message: "KYC verification approved successfully",
          kycId,
          status: "approved",
        });
      } else {
        // Reject the verification and refund
        await storage.updateKycVerification(kycId, {
          status: "rejected",
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNotes: notes || null,
          rejectionReason: rejectionReason || "Manual review rejection",
        });

        // Process refund
        const wallet = await storage.getOrCreateWallet(targetUserId);
        await storage.updateWalletBalance(targetUserId, "200", "add");
        
        // Create refund transaction
        await storage.createTransaction({
          walletId: wallet.id,
          type: "refund",
          amount: "200",
          status: "completed",
          description: `KYC verification fee refund - ${rejectionReason || "rejected by admin"}`,
          relatedUserId: targetUserId,
        });

        // Update status to refunded
        await storage.updateKycVerification(kycId, {
          status: "refunded",
        });

        // Log the rejection
        await storage.createKycLog({
          kycId,
          userId: targetUserId,
          action: "manual_rejected",
          result: "refunded",
          reviewedBy: userId,
          similarityScore: kyc.similarityScore ? parseFloat(kyc.similarityScore) : undefined,
          metadata: { notes, rejectionReason, adminId: userId, refundAmount: 200 }
        });

        // Clean up sensitive data
        await storage.updateKycVerification(kycId, {
          nin: null,
          ninPhotoUrl: null,
          selfieUrl: null,
          imagesDeletedAt: new Date(),
        });

        res.json({
          success: true,
          message: "KYC verification rejected and fee refunded",
          kycId,
          status: "refunded",
        });
      }
    } catch (error) {
      console.error("Error reviewing KYC verification:", error);
      res.status(500).json({ message: "Failed to review KYC verification" });
    }
  });

  // Admin: Get all pending KYC verifications
  app.get("/api/kyc/admin/pending", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Check if user is admin
      const adminUser = await storage.getUser(userId);
      if (!adminUser || adminUser.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pendingVerifications = await storage.getPendingKycVerifications();
      
      // Get user details for each verification
      const verificationsWithUsers = await Promise.all(
        pendingVerifications.map(async (kyc) => {
          const user = await storage.getUser(kyc.userId);
          return {
            ...kyc,
            user: user ? {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            } : null,
          };
        })
      );

      res.json(verificationsWithUsers);
    } catch (error) {
      console.error("Error fetching pending KYC verifications:", error);
      res.status(500).json({ message: "Failed to fetch pending verifications" });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server for real-time chat and notifications
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", (ws: WebSocket, req) => {
    let userId: string | null = null;

    ws.on("message", async (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle authentication message with JWT token
        if (data.type === "auth" && data.token) {
          try {
            // Verify the JWT token
            const decoded = jwt.verify(data.token, process.env.SESSION_SECRET!) as { userId: string; purpose: string };
            
            // Validate token purpose
            if (decoded.purpose !== "websocket") {
              ws.send(JSON.stringify({ 
                type: "auth_error", 
                message: "Invalid token purpose" 
              }));
              ws.close();
              return;
            }
            
            // Verify user exists and is active
            const user = await storage.getUser(decoded.userId);
            if (!user || user.isBanned || !user.isActive) {
              ws.send(JSON.stringify({ 
                type: "auth_error", 
                message: "User account inactive or banned" 
              }));
              ws.close();
              return;
            }
            
            userId = decoded.userId;
            // Check if this is user's first connection (they were offline before)
            const wasOffline = !isUserOnline(userId);
            addWsConnection(userId, ws);
            console.log(`WebSocket authenticated for user: ${userId} (connection added)`);
            ws.send(JSON.stringify({ type: "auth_success", userId }));
            
            // Broadcast that user is now online if this was their first connection
            if (wasOffline) {
              broadcastUserStatusChange(userId, true);
              console.log(`User ${userId} is now online - status broadcast sent`);
            }
          } catch (error) {
            console.error("WebSocket auth error:", error);
            ws.send(JSON.stringify({ 
              type: "auth_error", 
              message: error instanceof jwt.JsonWebTokenError ? "Invalid or expired token" : "Authentication failed"
            }));
            ws.close();
          }
          return;
        }
        
        // Handle chat messages (persist via storage and broadcast)
        if (data.type === "message" && userId) {
          // Persist the message to database
          const savedMessage = await storage.createMessage({
            senderId: userId,
            receiverId: data.receiverId,
            content: data.content,
            productId: data.productId,
          });
          
          // Send to recipient if they're connected (broadcasts to all their connections)
          broadcastToUser(data.receiverId, {
            type: "new_message",
            message: savedMessage,
          });
          
          // Create notification for message receiver
          if (data.receiverId && data.receiverId !== userId) {
            const sender = await storage.getUser(userId);
            if (sender) {
              const senderName = sender.firstName && sender.lastName 
                ? `${sender.firstName} ${sender.lastName}` 
                : sender.email;
              
              const messagePreview = data.content.length > 50 
                ? data.content.substring(0, 50) + "..." 
                : data.content;
              
              await createAndBroadcastNotification({
                userId: data.receiverId,
                type: "message",
                title: "New Message",
                message: `${senderName}: ${messagePreview}`,
                link: `/messages/${userId}`,
                relatedUserId: userId,
                relatedProductId: data.productId || undefined,
              });
            }
          }
          
          // Confirm to sender
          ws.send(JSON.stringify({
            type: "message_sent",
            message: savedMessage,
          }));
        }

        // ========================================
        // Game Room WebSocket Events
        // ========================================

        // Join game room WebSocket channel
        if (data.type === "game_room_join" && userId) {
          const { roomCode } = data;
          if (!roomCode) {
            ws.send(JSON.stringify({ type: "game_room_error", message: "Room code required" }));
            return;
          }

          const room = await storage.getGameRoomByCode(roomCode);
          if (!room) {
            ws.send(JSON.stringify({ type: "game_room_error", message: "Room not found" }));
            return;
          }

          addGameRoomConnection(roomCode, userId, ws);
          
          // Notify others in room
          broadcastToGameRoom(roomCode, {
            type: "player_joined",
            playerId: userId,
            roomCode,
            players: room.players,
          }, userId);

          ws.send(JSON.stringify({
            type: "game_room_joined",
            room,
          }));
        }

        // Leave game room WebSocket channel
        if (data.type === "game_room_leave" && userId) {
          const { roomCode } = data;
          if (roomCode) {
            removeGameRoomConnection(roomCode, userId);
            
            // Notify others
            broadcastToGameRoom(roomCode, {
              type: "player_left",
              playerId: userId,
              roomCode,
            });
          }
        }

        // Player ready status change
        if (data.type === "player_ready" && userId) {
          const { roomCode } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room) {
            const player = await storage.togglePlayerReady(room.id, userId);
            const updatedRoom = await storage.getGameRoomByCode(roomCode);
            
            // Broadcast to all players including sender
            const roomConnections = gameRoomConnections.get(roomCode);
            if (roomConnections) {
              const message = JSON.stringify({
                type: "player_ready_changed",
                playerId: userId,
                isReady: player.isReady,
                room: updatedRoom,
              });
              roomConnections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.send(message);
                }
              });
            }
          }
        }

        // Game chat message
        if (data.type === "game_chat" && userId) {
          const { roomCode, content } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room && content) {
            const message = await storage.createGameChatMessage(room.id, userId, content);
            const sender = await storage.getUser(userId);
            
            // Broadcast to all players in room
            const roomConnections = gameRoomConnections.get(roomCode);
            if (roomConnections) {
              const broadcastMsg = JSON.stringify({
                type: "game_chat_message",
                message: { ...message, sender },
              });
              roomConnections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.send(broadcastMsg);
                }
              });
            }
          }
        }

        // Game action (move, play card, etc.)
        if (data.type === "game_action" && userId) {
          const { roomCode, action, payload } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room && room.status === "playing") {
            // Update game state based on action
            const currentState = room.gameState || {};
            const newState = { ...currentState, lastAction: { action, payload, playerId: userId, timestamp: new Date() } };
            await storage.updateGameState(room.id, newState);

            // Broadcast action to all players
            const roomConnections = gameRoomConnections.get(roomCode);
            if (roomConnections) {
              const message = JSON.stringify({
                type: "game_action_broadcast",
                playerId: userId,
                action,
                payload,
                gameState: newState,
              });
              roomConnections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.send(message);
                }
              });
            }
          }
        }

        // Game state update (full state sync)
        if (data.type === "game_state_update" && userId) {
          const { roomCode, gameState } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room && room.hostId === userId) {
            await storage.updateGameState(room.id, gameState);

            // Broadcast to all players
            const roomConnections = gameRoomConnections.get(roomCode);
            if (roomConnections) {
              const message = JSON.stringify({
                type: "game_state_sync",
                gameState,
              });
              roomConnections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.send(message);
                }
              });
            }
          }
        }

        // Game start event
        if (data.type === "game_start" && userId) {
          const { roomCode } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room && room.hostId === userId) {
            try {
              const updatedRoom = await storage.startGameRoom(room.id);
              
              // Broadcast game start to all players
              const roomConnections = gameRoomConnections.get(roomCode);
              if (roomConnections) {
                const message = JSON.stringify({
                  type: "game_started",
                  room: updatedRoom,
                });
                roomConnections.forEach((conn) => {
                  if (conn.readyState === WebSocket.OPEN) {
                    conn.send(message);
                  }
                });
              }
            } catch (error: any) {
              ws.send(JSON.stringify({
                type: "game_room_error",
                message: error.message || "Failed to start game",
              }));
            }
          }
        }

        // Game end event
        if (data.type === "game_end" && userId) {
          const { roomCode, winnerId, results } = data;
          const room = await storage.getGameRoomByCode(roomCode);
          if (room && room.hostId === userId) {
            const updatedRoom = await storage.endGameRoom(room.id, winnerId, results);
            
            // Broadcast game end to all players
            const roomConnections = gameRoomConnections.get(roomCode);
            if (roomConnections) {
              const message = JSON.stringify({
                type: "game_ended",
                room: updatedRoom,
                winnerId,
                results,
              });
              roomConnections.forEach((conn) => {
                if (conn.readyState === WebSocket.OPEN) {
                  conn.send(message);
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("WebSocket error:", error);
        ws.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
      }
    });

    ws.on("close", () => {
      if (userId) {
        removeWsConnection(userId, ws);
        console.log(`WebSocket disconnected for user: ${userId} (connection removed)`);
        
        // Broadcast that user is now offline if they have no more connections
        if (!isUserOnline(userId)) {
          broadcastUserStatusChange(userId, false);
          console.log(`User ${userId} is now offline - status broadcast sent`);
        }
      }
    });
    
    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      if (userId) {
        removeWsConnection(userId, ws);
        
        // Broadcast that user is now offline if they have no more connections
        if (!isUserOnline(userId)) {
          broadcastUserStatusChange(userId, false);
          console.log(`User ${userId} is now offline (due to error) - status broadcast sent`);
        }
      }
    });
  });

  // ========================================
  // Sponsored Ads API Routes
  // ========================================
  
  // GET /api/ads/active - Get active sponsored ads (optionally filtered by type)
  // Returns randomized results, max 3 ads
  app.get("/api/ads/active", async (req, res) => {
    try {
      // Check if ads are enabled in platform settings
      const adsEnabledSetting = await storage.getPlatformSetting("ads_enabled");
      if (adsEnabledSetting?.value === "false") {
        return res.json([]);
      }
      
      const { type } = req.query;
      const allAds = await storage.getActiveSponsoredAds(type as string | undefined);
      
      // Shuffle array using Fisher-Yates algorithm
      const shuffled = [...allAds];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      // Return max 3 randomized ads
      const ads = shuffled.slice(0, 3);
      res.json(ads);
    } catch (error) {
      console.error("Error fetching active ads:", error);
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });
  
  // POST /api/ads/:id/impression - Track ad impression
  app.post("/api/ads/:id/impression", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.recordAdImpression(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording ad impression:", error);
      res.status(500).json({ message: "Failed to record impression" });
    }
  });
  
  // POST /api/ads/:id/click - Track ad click
  app.post("/api/ads/:id/click", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.recordAdClick(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error recording ad click:", error);
      res.status(500).json({ message: "Failed to record click" });
    }
  });

  // ========================================
  // Stories API Routes (Instagram-like 24h stories)
  // ========================================
  
  // POST /api/stories - Create new story (image, video, or text)
  app.post("/api/stories", isAuthenticated, uploadMedia.single("media"), async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { type, textContent, backgroundColor, fontStyle } = req.body;
      
      if (!type || !["image", "video", "text"].includes(type)) {
        return res.status(400).json({ message: "Invalid story type" });
      }
      
      let mediaUrl: string | undefined;
      
      if (type === "image" || type === "video") {
        if (!req.file) {
          return res.status(400).json({ message: "Media file is required for image/video stories" });
        }
        
        if (type === "video") {
          mediaUrl = await uploadVideoToStorage(req.file, "stories") || undefined;
        } else {
          const urls = await uploadMultipleToObjectStorage([req.file]);
          mediaUrl = urls[0];
        }
      } else if (type === "text") {
        if (!textContent || textContent.trim() === "") {
          return res.status(400).json({ message: "Text content is required for text stories" });
        }
      }
      
      const story = await storage.createStory({
        authorId: userId,
        type: type as "image" | "video" | "text",
        mediaUrl,
        textContent: type === "text" ? textContent : undefined,
        backgroundColor: backgroundColor || "#16a34a",
        fontStyle: fontStyle || "sans-serif",
      });
      
      const storyWithAuthor = await storage.getStory(story.id);
      res.status(201).json(storyWithAuthor);
    } catch (error) {
      console.error("Error creating story:", error);
      res.status(500).json({ message: "Failed to create story" });
    }
  });
  
  // GET /api/stories - Get stories from followed users and own stories
  app.get("/api/stories", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const stories = await storage.getActiveStories(userId);
      res.json(stories);
    } catch (error) {
      console.error("Error fetching stories:", error);
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });
  
  // GET /api/stories/users - Get users with active stories (for the story ring UI)
  app.get("/api/stories/users", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const usersWithStories = await storage.getUsersWithActiveStories(userId);
      res.json(usersWithStories);
    } catch (error) {
      console.error("Error fetching users with stories:", error);
      res.status(500).json({ message: "Failed to fetch users with stories" });
    }
  });
  
  // GET /api/stories/user/:userId - Get user's active stories
  // IMPORTANT: This route must be defined BEFORE /api/stories/:id to prevent Express
  // from matching "/api/stories/user/123" as "/api/stories/:id" with id="user"
  app.get("/api/stories/user/:userId", isAuthenticated, async (req, res) => {
    try {
      const { userId: targetUserId } = req.params;
      const currentUserId = getUserId(req);
      
      // Get user's active stories with hasViewed flag for the current user
      const userStories = await storage.getUserActiveStories(targetUserId);
      
      // Add hasViewed flag for each story
      const storiesWithViewStatus = await Promise.all(
        userStories.map(async (story) => {
          const hasViewed = currentUserId 
            ? await storage.hasViewedStory(story.id, currentUserId)
            : false;
          return { ...story, hasViewed };
        })
      );
      
      res.json(storiesWithViewStatus);
    } catch (error) {
      console.error("Error fetching user stories:", error);
      res.status(500).json({ message: "Failed to fetch user stories" });
    }
  });
  
  // GET /api/stories/:id - Get single story
  app.get("/api/stories/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const story = await storage.getStory(id);
      
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      res.json(story);
    } catch (error) {
      console.error("Error fetching story:", error);
      res.status(500).json({ message: "Failed to fetch story" });
    }
  });
  
  // POST /api/stories/:id/view - Mark story as viewed
  app.post("/api/stories/:id/view", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      const view = await storage.viewStory(id, userId);
      res.json(view);
    } catch (error) {
      console.error("Error viewing story:", error);
      res.status(500).json({ message: "Failed to record story view" });
    }
  });
  
  // GET /api/stories/:id/views - Get story views
  app.get("/api/stories/:id/views", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      // Only story author can see views
      if (story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized to view story views" });
      }
      
      const views = await storage.getStoryViews(id);
      res.json(views);
    } catch (error) {
      console.error("Error fetching story views:", error);
      res.status(500).json({ message: "Failed to fetch story views" });
    }
  });
  
  // POST /api/stories/:id/react - React to story
  app.post("/api/stories/:id/react", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      const { reaction } = req.body;
      
      if (!reaction) {
        return res.status(400).json({ message: "Reaction is required" });
      }
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      const storyReaction = await storage.reactToStory(id, userId, reaction);
      
      // Create notification for story author
      if (story.authorId !== userId) {
        const reactor = await storage.getUser(userId);
        if (reactor) {
          const reactorName = reactor.firstName && reactor.lastName 
            ? `${reactor.firstName} ${reactor.lastName}` 
            : reactor.email;
          
          await createAndBroadcastNotification({
            userId: story.authorId,
            type: "story_reaction",
            title: "Story Reaction",
            message: `${reactorName} reacted ${reaction} to your story`,
            link: `/the-plug`,
            relatedUserId: userId,
          });
        }
      }
      
      res.json(storyReaction);
    } catch (error) {
      console.error("Error reacting to story:", error);
      res.status(500).json({ message: "Failed to react to story" });
    }
  });
  
  // GET /api/stories/:id/reactions - Get story reactions
  app.get("/api/stories/:id/reactions", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      const reactions = await storage.getStoryReactions(id);
      res.json(reactions);
    } catch (error) {
      console.error("Error fetching story reactions:", error);
      res.status(500).json({ message: "Failed to fetch story reactions" });
    }
  });
  
  // POST /api/stories/:id/reply - Reply to story
  app.post("/api/stories/:id/reply", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      const { content } = req.body;
      
      if (!content || content.trim() === "") {
        return res.status(400).json({ message: "Reply content is required" });
      }
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      const reply = await storage.replyToStory(id, userId, content);
      
      // Create notification for story author
      if (story.authorId !== userId) {
        const sender = await storage.getUser(userId);
        if (sender) {
          const senderName = sender.firstName && sender.lastName 
            ? `${sender.firstName} ${sender.lastName}` 
            : sender.email;
          
          const replyPreview = content.length > 50 
            ? content.substring(0, 50) + "..." 
            : content;
          
          await createAndBroadcastNotification({
            userId: story.authorId,
            type: "story_reply",
            title: "Story Reply",
            message: `${senderName}: ${replyPreview}`,
            link: `/messages/${userId}`,
            relatedUserId: userId,
          });
        }
      }
      
      res.json(reply);
    } catch (error) {
      console.error("Error replying to story:", error);
      res.status(500).json({ message: "Failed to reply to story" });
    }
  });
  
  // GET /api/stories/:id/replies - Get story replies
  app.get("/api/stories/:id/replies", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      // Only story author can see all replies
      if (story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized to view story replies" });
      }
      
      const replies = await storage.getStoryReplies(id);
      res.json(replies);
    } catch (error) {
      console.error("Error fetching story replies:", error);
      res.status(500).json({ message: "Failed to fetch story replies" });
    }
  });
  
  // DELETE /api/stories/:id - Delete own story
  app.delete("/api/stories/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const { id } = req.params;
      
      const story = await storage.getStory(id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      
      if (story.authorId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this story" });
      }
      
      await storage.deleteStory(id);
      res.json({ message: "Story deleted successfully" });
    } catch (error) {
      console.error("Error deleting story:", error);
      res.status(500).json({ message: "Failed to delete story" });
    }
  });

  // ==================== CONFESSIONS ROUTES (Anonymous Board) ====================

  // Auto-approve pending confessions every minute
  setInterval(async () => {
    try {
      const approved = await storage.autoApproveOldConfessions();
      if (approved > 0) {
        console.log(`Auto-approved ${approved} pending confessions`);
      }
    } catch (error) {
      console.error("Error auto-approving confessions:", error);
    }
  }, 60 * 1000);

  // POST /api/confessions - Create new confession
  app.post("/api/confessions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { content, category, isAnonymous } = req.body;

      if (!content || content.trim().length < 10) {
        return res.status(400).json({ message: "Confession must be at least 10 characters" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Confession must not exceed 2000 characters" });
      }

      const validCategories = ["general", "love", "academics", "drama", "advice", "funny", "secrets"];
      const selectedCategory = category && validCategories.includes(category) ? category : "general";

      const confession = await storage.createConfession({
        authorId: userId,
        content: content.trim(),
        category: selectedCategory,
        isAnonymous: isAnonymous !== false,
      });

      res.status(201).json(confession);
    } catch (error) {
      console.error("Error creating confession:", error);
      res.status(500).json({ message: "Failed to create confession" });
    }
  });

  // GET /api/confessions - Get approved confessions with pagination (allows guest access)
  app.get("/api/confessions", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { category, page, limit } = req.query;

      const result = await storage.getConfessions({
        category: category as string,
        status: "approved",
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      // If user is logged in, enrich confessions with their vote status
      if (userId && result.confessions && result.confessions.length > 0) {
        const enrichedConfessions = await Promise.all(
          result.confessions.map(async (confession) => {
            const userVote = await storage.getUserVote(confession.id, userId);
            return {
              ...confession,
              userVote: userVote?.voteType || null,
              isOwner: confession.authorId === userId,
            };
          })
        );
        res.json({ ...result, confessions: enrichedConfessions });
      } else {
        // For guests, return confessions without vote info
        const guestConfessions = result.confessions.map(confession => ({
          ...confession,
          userVote: null,
          isOwner: false,
        }));
        res.json({ ...result, confessions: guestConfessions });
      }
    } catch (error) {
      console.error("Error fetching confessions:", error);
      res.status(500).json({ message: "Failed to fetch confessions" });
    }
  });

  // GET /api/confessions/trending - Get trending confessions (allows guest access)
  app.get("/api/confessions/trending", async (req, res) => {
    try {
      const { limit } = req.query;
      const trending = await storage.getTrendingConfessions(
        limit ? parseInt(limit as string) : 10
      );
      res.json(trending);
    } catch (error) {
      console.error("Error fetching trending confessions:", error);
      res.status(500).json({ message: "Failed to fetch trending confessions" });
    }
  });

  // GET /api/confessions/:id - Get single confession with comments (allows guest access for approved confessions)
  app.get("/api/confessions/:id", async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;

      const confession = await storage.getConfession(id);
      if (!confession) {
        return res.status(404).json({ message: "Confession not found" });
      }

      // Allow guest access only for approved confessions
      // Non-approved confessions can only be viewed by the owner
      if (confession.status !== "approved") {
        if (!userId || confession.authorId !== userId) {
          return res.status(404).json({ message: "Confession not found" });
        }
      }

      const comments = await storage.getConfessionComments(id);
      const userVote = userId ? await storage.getUserVote(id, userId) : null;

      res.json({
        ...confession,
        comments,
        userVote: userVote?.voteType || null,
        isOwner: userId ? confession.authorId === userId : false,
      });
    } catch (error) {
      console.error("Error fetching confession:", error);
      res.status(500).json({ message: "Failed to fetch confession" });
    }
  });

  // POST /api/confessions/:id/view - Track confession view (unique: 1 view per user per 24 hours)
  app.post("/api/confessions/:id/view", async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Verify confession exists
      const confession = await storage.getConfession(id);
      if (!confession || confession.status !== "approved") {
        return res.status(404).json({ message: "Confession not found" });
      }
      
      // For authenticated users, use unique view tracking
      if (userId) {
        const isNewView = await storage.recordUniqueConfessionView(id, userId);
        res.json({ success: true, isNewView });
      } else {
        // For anonymous users, use session-based tracking
        const sessionId = req.session?.id || req.ip;
        if (sessionId) {
          const viewerKey = `anon_${sessionId}`;
          const isNewView = await storage.recordUniqueConfessionView(id, viewerKey);
          res.json({ success: true, isNewView });
        } else {
          // Fallback: just increment without tracking (rare edge case)
          await storage.incrementConfessionViews(id);
          res.json({ success: true, isNewView: true });
        }
      }
    } catch (error) {
      console.error("Error tracking confession view:", error);
      res.status(500).json({ message: "Failed to track view" });
    }
  });

  // POST /api/confessions/:id/vote - Like or dislike a confession
  app.post("/api/confessions/:id/vote", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized - please login to vote" });
      }

      const { id } = req.params;
      let { voteType } = req.body;
      
      // Accept both 'upvote'/'downvote' and 'like'/'dislike' for compatibility
      if (voteType === "upvote") voteType = "like";
      if (voteType === "downvote") voteType = "dislike";

      if (!voteType || !["like", "dislike"].includes(voteType)) {
        return res.status(400).json({ message: "Invalid vote type. Must be 'like', 'dislike', 'upvote', or 'downvote'" });
      }

      const confession = await storage.getConfession(id);
      if (!confession || confession.status !== "approved") {
        return res.status(404).json({ message: "Confession not found" });
      }

      const existingVote = await storage.getUserVote(id, userId);

      if (existingVote && existingVote.voteType === voteType) {
        await storage.removeVote(id, userId);
        const updated = await storage.getConfession(id);
        return res.json({ 
          message: "Vote removed", 
          likesCount: updated?.likesCount || 0,
          dislikesCount: updated?.dislikesCount || 0,
          userVote: null 
        });
      }

      const vote = await storage.voteConfession(id, userId, voteType as 'like' | 'dislike');
      const updated = await storage.getConfession(id);

      res.json({ 
        message: "Vote recorded", 
        likesCount: updated?.likesCount || 0,
        dislikesCount: updated?.dislikesCount || 0,
        userVote: vote.voteType 
      });
    } catch (error: any) {
      console.error("Error voting on confession:", error);
      res.status(500).json({ message: error.message || "Failed to vote on confession" });
    }
  });

  // POST /api/confessions/:id/comments - Add comment to confession
  app.post("/api/confessions/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { content, isAnonymous, parentId } = req.body;

      if (!content || content.trim().length < 1) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      if (content.length > 1000) {
        return res.status(400).json({ message: "Comment must not exceed 1000 characters" });
      }

      const confession = await storage.getConfession(id);
      if (!confession || confession.status !== "approved") {
        return res.status(404).json({ message: "Confession not found" });
      }

      const comment = await storage.createConfessionComment({
        confessionId: id,
        authorId: userId,
        content: content.trim(),
        isAnonymous: isAnonymous === true,
        parentId: parentId || undefined,
      });

      const user = await storage.getUser(userId);
      const commentWithAuthor = {
        ...comment,
        author: isAnonymous ? null : (user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        } : null),
      };

      res.status(201).json(commentWithAuthor);
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // POST /api/confessions/:id/report - Report confession
  app.post("/api/confessions/:id/report", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { reason, description } = req.body;

      if (!reason || reason.trim().length < 1) {
        return res.status(400).json({ message: "Report reason is required" });
      }

      const validReasons = ["spam", "harassment", "inappropriate", "hate_speech", "self_harm", "other"];
      if (!validReasons.includes(reason)) {
        return res.status(400).json({ message: "Invalid report reason" });
      }

      const confession = await storage.getConfession(id);
      if (!confession) {
        return res.status(404).json({ message: "Confession not found" });
      }

      const report = await storage.createConfessionReport({
        confessionId: id,
        reporterId: userId,
        reason,
        description: description?.trim() || undefined,
      });

      res.status(201).json({ message: "Report submitted successfully", report });
    } catch (error) {
      console.error("Error reporting confession:", error);
      res.status(500).json({ message: "Failed to report confession" });
    }
  });

  // DELETE /api/confessions/:id - Delete own confession
  app.delete("/api/confessions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      const confession = await storage.getConfession(id);
      if (!confession) {
        return res.status(404).json({ message: "Confession not found" });
      }

      if (confession.authorId !== userId && !await isAdminUser(userId)) {
        return res.status(403).json({ message: "Not authorized to delete this confession" });
      }

      await storage.deleteConfession(id);
      res.json({ message: "Confession deleted successfully" });
    } catch (error) {
      console.error("Error deleting confession:", error);
      res.status(500).json({ message: "Failed to delete confession" });
    }
  });

  // GET /api/confessions/:id/comments - Get comments for a confession (allows guest access)
  app.get("/api/confessions/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;

      const confession = await storage.getConfession(id);
      if (!confession || confession.status !== "approved") {
        return res.status(404).json({ message: "Confession not found" });
      }

      const comments = await storage.getConfessionComments(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // =====================================================
  // COMMUNITY ROUTES
  // =====================================================

  // POST /api/communities - Create new community
  app.post("/api/communities", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, slug, description, iconUrl, coverUrl, type, category, rules } = req.body;

      if (!name || name.trim().length < 3) {
        return res.status(400).json({ message: "Community name must be at least 3 characters" });
      }

      if (!slug || slug.trim().length < 3) {
        return res.status(400).json({ message: "Community slug must be at least 3 characters" });
      }

      const slugRegex = /^[a-z0-9-]+$/;
      if (!slugRegex.test(slug.toLowerCase())) {
        return res.status(400).json({ message: "Slug can only contain lowercase letters, numbers, and hyphens" });
      }

      const existing = await storage.getCommunityBySlug(slug);
      if (existing) {
        return res.status(400).json({ message: "A community with this slug already exists" });
      }

      const community = await storage.createCommunity({
        name: name.trim(),
        slug: slug.toLowerCase().trim(),
        description: description?.trim() || undefined,
        iconUrl: iconUrl || undefined,
        coverUrl: coverUrl || undefined,
        type: type || "public",
        category: category || undefined,
        rules: rules || [],
        ownerId: userId,
      });

      const communityWithOwner = await storage.getCommunity(community.id);
      res.status(201).json(communityWithOwner);
    } catch (error: any) {
      console.error("Error creating community:", error);
      res.status(500).json({ message: error.message || "Failed to create community" });
    }
  });

  // GET /api/communities - List all public communities
  app.get("/api/communities", async (req, res) => {
    try {
      const communities = await storage.getPublicCommunities();
      res.json(communities);
    } catch (error) {
      console.error("Error fetching communities:", error);
      res.status(500).json({ message: "Failed to fetch communities" });
    }
  });

  // GET /api/communities/joined - Get user's joined communities
  app.get("/api/communities/joined", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const communities = await storage.getUserJoinedCommunities(userId);
      res.json(communities);
    } catch (error) {
      console.error("Error fetching joined communities:", error);
      res.status(500).json({ message: "Failed to fetch joined communities" });
    }
  });

  // GET /api/communities/:slug - Get community details by slug
  app.get("/api/communities/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const userId = getUserId(req);

      const community = await storage.getCommunityBySlug(slug);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      let membership = null;
      if (userId) {
        membership = await storage.getCommunityMember(community.id, userId);
      }

      res.json({ ...community, membership });
    } catch (error) {
      console.error("Error fetching community:", error);
      res.status(500).json({ message: "Failed to fetch community" });
    }
  });

  // POST /api/communities/:id/join - Join a community
  app.post("/api/communities/:id/join", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      const community = await storage.getCommunity(id);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const existingMember = await storage.getCommunityMember(id, userId);
      if (existingMember) {
        if (existingMember.isBanned) {
          return res.status(403).json({ message: "You are banned from this community" });
        }
        return res.status(400).json({ message: "Already a member of this community" });
      }

      if (community.type === "invite_only") {
        return res.status(403).json({ message: "This community is invite-only" });
      }

      const membership = await storage.joinCommunity(id, userId);
      res.status(201).json({ message: "Successfully joined the community", membership });
    } catch (error: any) {
      console.error("Error joining community:", error);
      res.status(500).json({ message: error.message || "Failed to join community" });
    }
  });

  // POST /api/communities/:id/leave - Leave a community
  app.post("/api/communities/:id/leave", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      const community = await storage.getCommunity(id);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const membership = await storage.getCommunityMember(id, userId);
      if (!membership) {
        return res.status(400).json({ message: "Not a member of this community" });
      }

      if (membership.role === "owner") {
        return res.status(400).json({ message: "Owner cannot leave the community. Transfer ownership first." });
      }

      await storage.leaveCommunity(id, userId);
      res.json({ message: "Successfully left the community" });
    } catch (error: any) {
      console.error("Error leaving community:", error);
      res.status(500).json({ message: error.message || "Failed to leave community" });
    }
  });

  // GET /api/communities/:id/posts - Get community posts
  app.get("/api/communities/:id/posts", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const community = await storage.getCommunity(id);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const posts = await storage.getCommunityPosts(id);

      const postsWithLikeStatus = await Promise.all(posts.map(async (post) => {
        let isLiked = false;
        if (userId) {
          isLiked = await storage.hasLikedCommunityPost(post.id, userId);
        }
        return { ...post, isLiked };
      }));

      res.json(postsWithLikeStatus);
    } catch (error) {
      console.error("Error fetching community posts:", error);
      res.status(500).json({ message: "Failed to fetch community posts" });
    }
  });

  // POST /api/communities/:id/posts - Create post in community
  app.post("/api/communities/:id/posts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { title, content, images } = req.body;

      if (!content || content.trim().length < 1) {
        return res.status(400).json({ message: "Post content is required" });
      }

      const community = await storage.getCommunity(id);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const membership = await storage.getCommunityMember(id, userId);
      if (!membership) {
        return res.status(403).json({ message: "Must be a member to post in this community" });
      }

      if (membership.isBanned) {
        return res.status(403).json({ message: "You are banned from this community" });
      }

      const post = await storage.createCommunityPost({
        communityId: id,
        authorId: userId,
        title: title?.trim() || undefined,
        content: content.trim(),
        images: images || [],
      });

      const postWithAuthor = await storage.getCommunityPost(post.id);
      res.status(201).json(postWithAuthor);
    } catch (error: any) {
      console.error("Error creating community post:", error);
      res.status(500).json({ message: error.message || "Failed to create post" });
    }
  });

  // POST /api/community-posts/:id/like - Like/unlike a community post
  app.post("/api/community-posts/:id/like", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;

      const post = await storage.getCommunityPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const hasLiked = await storage.hasLikedCommunityPost(id, userId);

      if (hasLiked) {
        await storage.unlikeCommunityPost(id, userId);
        const updated = await storage.getCommunityPost(id);
        return res.json({ message: "Post unliked", isLiked: false, likesCount: updated?.likesCount || 0 });
      } else {
        await storage.likeCommunityPost(id, userId);
        const updated = await storage.getCommunityPost(id);
        return res.json({ message: "Post liked", isLiked: true, likesCount: updated?.likesCount || 0 });
      }
    } catch (error: any) {
      console.error("Error liking post:", error);
      res.status(500).json({ message: error.message || "Failed to like post" });
    }
  });

  // GET /api/community-posts/:id/comments - Get comments for a post
  app.get("/api/community-posts/:id/comments", async (req, res) => {
    try {
      const { id } = req.params;

      const post = await storage.getCommunityPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      const comments = await storage.getCommunityPostComments(id);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching post comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  // POST /api/community-posts/:id/comments - Comment on post
  app.post("/api/community-posts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { content, parentId } = req.body;

      if (!content || content.trim().length < 1) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      if (content.length > 2000) {
        return res.status(400).json({ message: "Comment must not exceed 2000 characters" });
      }

      const post = await storage.getCommunityPost(id);
      if (!post) {
        return res.status(404).json({ message: "Post not found" });
      }

      if (post.isLocked) {
        return res.status(403).json({ message: "This post is locked and cannot receive new comments" });
      }

      const membership = await storage.getCommunityMember(post.communityId, userId);
      if (!membership) {
        return res.status(403).json({ message: "Must be a member to comment" });
      }

      if (membership.isBanned) {
        return res.status(403).json({ message: "You are banned from this community" });
      }

      const comment = await storage.createCommunityPostComment({
        postId: id,
        authorId: userId,
        content: content.trim(),
        parentId: parentId || undefined,
      });

      const user = await storage.getUser(userId);
      res.status(201).json({ 
        ...comment, 
        author: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
        } : null 
      });
    } catch (error: any) {
      console.error("Error creating comment:", error);
      res.status(500).json({ message: error.message || "Failed to create comment" });
    }
  });

  // GET /api/communities/:id/members - Get community members
  app.get("/api/communities/:id/members", async (req, res) => {
    try {
      const { id } = req.params;

      const community = await storage.getCommunity(id);
      if (!community) {
        return res.status(404).json({ message: "Community not found" });
      }

      const members = await storage.getCommunityMembers(id);
      res.json(members);
    } catch (error) {
      console.error("Error fetching community members:", error);
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // ========================================
  // Multiplayer Game Room API Routes
  // ========================================

  // POST /api/game-rooms - Create a new game room
  app.post("/api/game-rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { gameType, stakeAmount, maxPlayers, isPrivate, password, settings } = req.body;

      if (!gameType) {
        return res.status(400).json({ message: "Game type is required" });
      }

      const validGameTypes = ["ludo", "whot", "word_battle", "trivia"];
      if (!validGameTypes.includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }

      const room = await storage.createGameRoom({
        hostId: userId,
        gameType,
        stakeAmount: stakeAmount || "0.00",
        maxPlayers: maxPlayers || (gameType === "trivia" ? 10 : 4),
        isPrivate: isPrivate || false,
        password: isPrivate ? password : undefined,
        settings,
      });

      const fullRoom = await storage.getGameRoom(room.id);
      res.status(201).json(fullRoom);
    } catch (error: any) {
      console.error("Error creating game room:", error);
      res.status(500).json({ message: error.message || "Failed to create game room" });
    }
  });

  // GET /api/game-rooms - List available public game rooms
  app.get("/api/game-rooms", async (req, res) => {
    try {
      const { gameType } = req.query;
      const rooms = await storage.getAvailableGameRooms(gameType as string | undefined);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching game rooms:", error);
      res.status(500).json({ message: "Failed to fetch game rooms" });
    }
  });

  // GET /api/game-rooms/:code - Get room by code
  app.get("/api/game-rooms/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const room = await storage.getGameRoomByCode(code);
      
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      // Don't send password in response
      const { password, ...safeRoom } = room;
      res.json({ ...safeRoom, hasPassword: !!password });
    } catch (error) {
      console.error("Error fetching game room:", error);
      res.status(500).json({ message: "Failed to fetch game room" });
    }
  });

  // POST /api/game-rooms/:code/join - Join a game room
  app.post("/api/game-rooms/:code/join", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;
      const { password } = req.body;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const player = await storage.joinGameRoom(room.id, userId, password);
      const updatedRoom = await storage.getGameRoom(room.id);

      res.json({ player, room: updatedRoom });
    } catch (error: any) {
      console.error("Error joining game room:", error);
      res.status(400).json({ message: error.message || "Failed to join game room" });
    }
  });

  // POST /api/game-rooms/:code/leave - Leave a game room
  app.post("/api/game-rooms/:code/leave", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      await storage.leaveGameRoom(room.id, userId);
      res.json({ message: "Left room successfully" });
    } catch (error: any) {
      console.error("Error leaving game room:", error);
      res.status(500).json({ message: error.message || "Failed to leave game room" });
    }
  });

  // POST /api/game-rooms/:code/ready - Toggle ready status
  app.post("/api/game-rooms/:code/ready", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const player = await storage.togglePlayerReady(room.id, userId);
      const updatedRoom = await storage.getGameRoom(room.id);

      res.json({ player, room: updatedRoom });
    } catch (error: any) {
      console.error("Error toggling ready status:", error);
      res.status(500).json({ message: error.message || "Failed to toggle ready status" });
    }
  });

  // POST /api/game-rooms/:code/start - Start the game (host only)
  app.post("/api/game-rooms/:code/start", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      if (room.hostId !== userId) {
        return res.status(403).json({ message: "Only the host can start the game" });
      }

      const startedRoom = await storage.startGameRoom(room.id);
      res.json(startedRoom);
    } catch (error: any) {
      console.error("Error starting game:", error);
      res.status(400).json({ message: error.message || "Failed to start game" });
    }
  });

  // POST /api/game-rooms/:code/chat - Send a chat message
  app.post("/api/game-rooms/:code/chat", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code } = req.params;
      const { content } = req.body;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const message = await storage.createGameChatMessage(room.id, userId, content.trim());
      const sender = await storage.getUser(userId);

      res.status(201).json({ ...message, sender });
    } catch (error: any) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: error.message || "Failed to send message" });
    }
  });

  // GET /api/game-rooms/:code/chat - Get chat messages for a room
  app.get("/api/game-rooms/:code/chat", isAuthenticated, async (req, res) => {
    try {
      const { code } = req.params;
      const { limit } = req.query;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      const messages = await storage.getGameRoomChatMessages(room.id, limit ? parseInt(limit as string) : 50);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  // POST /api/game-rooms/:code/kick/:playerId - Kick a player (host only)
  app.post("/api/game-rooms/:code/kick/:playerId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { code, playerId } = req.params;

      const room = await storage.getGameRoomByCode(code);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      await storage.kickPlayerFromRoom(room.id, userId, playerId);
      const updatedRoom = await storage.getGameRoom(room.id);

      res.json({ message: "Player kicked", room: updatedRoom });
    } catch (error: any) {
      console.error("Error kicking player:", error);
      res.status(400).json({ message: error.message || "Failed to kick player" });
    }
  });

  // GET /api/game-rooms/user/my-rooms - Get user's active game rooms
  app.get("/api/game-rooms/user/my-rooms", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rooms = await storage.getUserGameRooms(userId);
      res.json(rooms);
    } catch (error) {
      console.error("Error fetching user game rooms:", error);
      res.status(500).json({ message: "Failed to fetch user game rooms" });
    }
  });

  // ===========================================
  // SECRET MESSAGE LINKS (Anonymous Messages)
  // ===========================================

  // Rate limiting for anonymous message submissions (by IP)
  const secretMessageRateLimit = new Map<string, { count: number; resetAt: Date }>();

  function checkSecretMessageRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const now = new Date();
    const limit = secretMessageRateLimit.get(ip);
    
    if (!limit || now > limit.resetAt) {
      const resetAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour
      secretMessageRateLimit.set(ip, { count: 1, resetAt });
      return { allowed: true, remaining: 4, resetAt };
    }
    
    if (limit.count >= 5) {
      return { allowed: false, remaining: 0, resetAt: limit.resetAt };
    }
    
    limit.count++;
    return { allowed: true, remaining: 5 - limit.count, resetAt: limit.resetAt };
  }

  // POST /api/secret-links - Create new secret message link
  app.post("/api/secret-links", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const data = createSecretMessageLinkSchema.parse(req.body);
      const link = await storage.createSecretMessageLink(userId, data);
      res.status(201).json(link);
    } catch (error: any) {
      console.error("Error creating secret link:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create secret link" });
    }
  });

  // GET /api/secret-links/mine - Get user's secret message links
  app.get("/api/secret-links/mine", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const links = await storage.getUserSecretMessageLinks(userId);
      res.json(links);
    } catch (error) {
      console.error("Error fetching secret links:", error);
      res.status(500).json({ message: "Failed to fetch secret links" });
    }
  });

  // GET /api/secret-links/:code - Get link info by code (public)
  app.get("/api/secret-links/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const link = await storage.getSecretMessageLinkByCode(code);
      
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }

      if (!link.isActive) {
        return res.status(410).json({ message: "This link is no longer active" });
      }

      // Only return necessary info - no user id
      res.json({
        title: link.title,
        backgroundColor: link.backgroundColor,
        isActive: link.isActive,
      });
    } catch (error) {
      console.error("Error fetching secret link:", error);
      res.status(500).json({ message: "Failed to fetch link" });
    }
  });

  // POST /api/secret-messages/:code - Submit anonymous message (public)
  app.post("/api/secret-messages/:code", async (req, res) => {
    try {
      const { code } = req.params;
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      
      // Check rate limit
      const rateCheck = checkSecretMessageRateLimit(ip);
      if (!rateCheck.allowed) {
        return res.status(429).json({ 
          message: "Rate limit exceeded. Please try again later.",
          resetAt: rateCheck.resetAt,
        });
      }

      const link = await storage.getSecretMessageLinkByCode(code);
      if (!link) {
        return res.status(404).json({ message: "Link not found" });
      }

      if (!link.isActive) {
        return res.status(410).json({ message: "This link is no longer active" });
      }

      const data = sendSecretMessageSchema.parse(req.body);
      const message = await storage.createSecretMessage(link.id, data.content);
      
      res.status(201).json({ 
        success: true, 
        message: "Your anonymous message has been sent!",
        remaining: rateCheck.remaining,
      });
    } catch (error: any) {
      console.error("Error sending secret message:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // GET /api/secret-messages - Get messages received (authenticated)
  app.get("/api/secret-messages", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const messages = await storage.getSecretMessagesForUser(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching secret messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // GET /api/secret-messages/unread-count - Get unread count
  app.get("/api/secret-messages/unread-count", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const count = await storage.getUnreadSecretMessageCount(userId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // PATCH /api/secret-messages/:id/read - Mark as read (authenticated)
  app.patch("/api/secret-messages/:id/read", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Verify message belongs to user through the link
      const messages = await storage.getSecretMessagesForUser(userId);
      const message = messages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      const updated = await storage.markSecretMessageRead(id);
      res.json(updated);
    } catch (error) {
      console.error("Error marking message as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // DELETE /api/secret-messages/:id - Delete a message (authenticated)
  app.delete("/api/secret-messages/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Verify message belongs to user through the link
      const messages = await storage.getSecretMessagesForUser(userId);
      const message = messages.find(m => m.id === id);
      
      if (!message) {
        return res.status(404).json({ message: "Message not found" });
      }

      await storage.deleteSecretMessage(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // DELETE /api/secret-links/:id - Delete a link (authenticated)
  app.delete("/api/secret-links/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      
      // Verify link belongs to user
      const link = await storage.getSecretMessageLink(id);
      if (!link || link.userId !== userId) {
        return res.status(404).json({ message: "Link not found" });
      }

      await storage.deleteSecretMessageLink(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting secret link:", error);
      res.status(500).json({ message: "Failed to delete link" });
    }
  });

  // PATCH /api/secret-links/:id/toggle - Toggle link active status
  app.patch("/api/secret-links/:id/toggle", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { isActive } = req.body;
      
      // Verify link belongs to user
      const link = await storage.getSecretMessageLink(id);
      if (!link || link.userId !== userId) {
        return res.status(404).json({ message: "Link not found" });
      }

      const updated = await storage.toggleSecretMessageLink(id, isActive);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling secret link:", error);
      res.status(500).json({ message: "Failed to toggle link" });
    }
  });

  // ========================================
  // Hostel & Roommate Finder Routes
  // ========================================

  // GET /api/hostels - List hostels with filters
  app.get("/api/hostels", async (req, res) => {
    try {
      const { location, minPrice, maxPrice, bedrooms, search } = req.query;
      
      const filters: { location?: string; minPrice?: number; maxPrice?: number; minBedrooms?: number; bedrooms?: number } = {};
      
      if (location && location !== "all") {
        filters.location = location as string;
      }
      if (minPrice) {
        filters.minPrice = parseFloat(minPrice as string);
      }
      if (maxPrice) {
        filters.maxPrice = parseFloat(maxPrice as string);
      }
      
      // Handle bedroom filtering at storage layer
      if (bedrooms && bedrooms !== "all") {
        const bedroomCount = parseInt(bedrooms as string);
        if (bedroomCount >= 4) {
          // "4+" means 4 or more bedrooms - use minBedrooms for >= comparison
          filters.minBedrooms = 4;
        } else {
          // Exact match for 1, 2, 3 bedrooms
          filters.bedrooms = bedroomCount;
        }
      }
      
      let hostels = await storage.getHostels(filters);
      
      // Search filter (kept in route layer for flexibility)
      if (search && typeof search === "string" && search.trim()) {
        const searchLower = search.toLowerCase().trim();
        hostels = hostels.filter(h => 
          h.title.toLowerCase().includes(searchLower) ||
          h.location?.toLowerCase().includes(searchLower) ||
          h.address?.toLowerCase().includes(searchLower)
        );
      }
      
      res.json(hostels);
    } catch (error) {
      console.error("Error fetching hostels:", error);
      res.status(500).json({ message: "Failed to fetch hostels" });
    }
  });

  // GET /api/hostels/my-listings - Get user's hostel listings
  app.get("/api/hostels/my-listings", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const hostels = await storage.getUserHostels(userId);
      res.json(hostels);
    } catch (error) {
      console.error("Error fetching user hostels:", error);
      res.status(500).json({ message: "Failed to fetch your hostel listings" });
    }
  });

  // GET /api/hostels/:id - Get single hostel with agent info
  app.get("/api/hostels/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const hostel = await storage.getHostel(id);
      
      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      // Increment views
      await storage.incrementHostelViews(id);
      
      res.json(hostel);
    } catch (error) {
      console.error("Error fetching hostel:", error);
      res.status(500).json({ message: "Failed to fetch hostel" });
    }
  });

  // POST /api/hostels - Create hostel (with image upload)
  app.post("/api/hostels", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate required fields
      const { title, description, location, address, price, bedrooms, bathrooms, amenities, distanceFromCampus, agentFee } = req.body;
      
      // Basic validation
      if (!title || typeof title !== "string" || title.trim().length < 5) {
        return res.status(400).json({ message: "Title must be at least 5 characters" });
      }
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
        return res.status(400).json({ message: "Price must be a valid positive number" });
      }
      if (!location || typeof location !== "string" || location.trim().length === 0) {
        return res.status(400).json({ message: "Location is required" });
      }

      // Upload images to object storage
      let imageUrls: string[] = [];
      if (req.files && req.files.length > 0) {
        const prefix = `hostels/${userId}/`;
        const uploadedUrls = await uploadMultipleToObjectStorage(req.files, prefix);
        imageUrls = uploadedUrls.filter((url): url is string => url !== null);
      }

      // Parse amenities if it's a JSON string
      let parsedAmenities: string[] = [];
      if (amenities) {
        try {
          parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
        } catch {
          parsedAmenities = Array.isArray(amenities) ? amenities : [amenities];
        }
      }

      const hostel = await storage.createHostel({
        agentId: userId,
        title: title.trim(),
        description: description?.trim() || null,
        location: location.trim(),
        address: address?.trim() || null,
        price: parseFloat(price).toFixed(2),
        images: imageUrls,
        bedrooms: bedrooms ? parseInt(bedrooms) : null,
        bathrooms: bathrooms ? parseInt(bathrooms) : null,
        amenities: parsedAmenities,
        distanceFromCampus: distanceFromCampus?.trim() || null,
        agentFee: agentFee?.trim() || null,
        isAvailable: true,
      });

      res.status(201).json(hostel);
    } catch (error) {
      console.error("Error creating hostel:", error);
      res.status(500).json({ message: "Failed to create hostel listing" });
    }
  });

  // PUT /api/hostels/:id - Update hostel (owner only)
  app.put("/api/hostels/:id", isAuthenticated, upload.array("images", 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const hostel = await storage.getHostel(id);

      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      if (hostel.agentId !== userId) {
        return res.status(403).json({ message: "You can only update your own hostel listings" });
      }

      // Handle new image uploads
      let imageUrls = hostel.images || [];
      if (req.files && req.files.length > 0) {
        const prefix = `hostels/${userId}/`;
        const uploadedUrls = await uploadMultipleToObjectStorage(req.files, prefix);
        const newUrls = uploadedUrls.filter((url): url is string => url !== null);
        imageUrls = [...imageUrls, ...newUrls];
      }

      // Handle existing images from form data
      if (req.body.existingImages) {
        try {
          const existingImages = typeof req.body.existingImages === "string" 
            ? JSON.parse(req.body.existingImages) 
            : req.body.existingImages;
          imageUrls = Array.isArray(existingImages) ? existingImages : imageUrls;
        } catch {
          // Keep existing images if parsing fails
        }
      }

      const { 
        title, 
        description, 
        location, 
        address, 
        price, 
        bedrooms, 
        bathrooms, 
        amenities, 
        distanceFromCampus,
        agentFee,
        isAvailable 
      } = req.body;

      // Parse amenities if it's a JSON string
      let parsedAmenities: string[] | undefined;
      if (amenities) {
        try {
          parsedAmenities = typeof amenities === "string" ? JSON.parse(amenities) : amenities;
        } catch {
          parsedAmenities = Array.isArray(amenities) ? amenities : [amenities];
        }
      }

      const updated = await storage.updateHostel(id, {
        title,
        description,
        location,
        address,
        price,
        images: imageUrls,
        bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
        bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
        amenities: parsedAmenities,
        distanceFromCampus,
        agentFee,
        isAvailable: isAvailable === "true" || isAvailable === true,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating hostel:", error);
      res.status(500).json({ message: "Failed to update hostel listing" });
    }
  });

  // DELETE /api/hostels/:id - Delete hostel (owner only)
  app.delete("/api/hostels/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const hostel = await storage.getHostel(id);

      if (!hostel) {
        return res.status(404).json({ message: "Hostel not found" });
      }

      if (hostel.agentId !== userId) {
        return res.status(403).json({ message: "You can only delete your own hostel listings" });
      }

      await storage.deleteHostel(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting hostel:", error);
      res.status(500).json({ message: "Failed to delete hostel listing" });
    }
  });

  // ========================================
  // Study Materials (Past Questions) Routes
  // ========================================

  // GET /api/study-materials - List materials with filters
  app.get("/api/study-materials", async (req, res) => {
    try {
      const { level, faculty, courseCode, materialType, search } = req.query;
      const materials = await storage.getStudyMaterials({
        level: level as string,
        faculty: faculty as string,
        courseCode: courseCode as string,
        materialType: materialType as string,
        search: search as string,
      });
      res.json(materials);
    } catch (error) {
      console.error("Error fetching study materials:", error);
      res.status(500).json({ message: "Failed to fetch study materials" });
    }
  });

  // GET /api/study-materials/my-uploads - Get user's uploaded materials
  app.get("/api/study-materials/my-uploads", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const materials = await storage.getUserStudyMaterials(userId);
      res.json(materials);
    } catch (error) {
      console.error("Error fetching user study materials:", error);
      res.status(500).json({ message: "Failed to fetch your study materials" });
    }
  });

  // GET /api/study-materials/:id - Get single material
  app.get("/api/study-materials/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const material = await storage.getStudyMaterial(id);
      
      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Increment views
      await storage.incrementMaterialViews(id);
      
      // Check if user has purchased (if authenticated)
      let hasPurchased = false;
      const userId = getUserId(req);
      if (userId) {
        hasPurchased = await storage.hasUserPurchasedMaterial(id, userId);
      }

      // Get ratings
      const ratings = await storage.getMaterialRatings(id);

      res.json({ ...material, hasPurchased, ratings });
    } catch (error) {
      console.error("Error fetching study material:", error);
      res.status(500).json({ message: "Failed to fetch study material" });
    }
  });

  // POST /api/study-materials - Create new material (with file upload)
  app.post("/api/study-materials", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Please upload a file" });
      }

      // Upload file to object storage
      const prefix = `study-materials/${userId}/`;
      const fileUrl = await uploadToObjectStorage(req.file, prefix);
      
      if (!fileUrl) {
        return res.status(500).json({ message: "Failed to upload file" });
      }

      const { title, description, materialType, courseCode, courseName, faculty, department, level, semester, academicYear, price, isFree } = req.body;

      const material = await storage.createStudyMaterial({
        uploaderId: userId,
        title,
        description,
        materialType: materialType || "past_question",
        courseCode: courseCode || "N/A",
        courseName,
        faculty,
        department,
        level: level || "100L",
        semester,
        academicYear,
        fileUrl,
        fileSize: req.file.size,
        price: price || "0.00",
        isFree: isFree === "true" || isFree === true,
      });

      res.status(201).json(material);
    } catch (error) {
      console.error("Error creating study material:", error);
      res.status(500).json({ message: "Failed to create study material" });
    }
  });

  // PUT /api/study-materials/:id - Update material
  app.put("/api/study-materials/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const material = await storage.getStudyMaterial(id);

      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      if (material.uploaderId !== userId) {
        return res.status(403).json({ message: "You can only update your own materials" });
      }

      const { title, description, materialType, courseCode, courseName, faculty, department, level, semester, academicYear, price, isFree } = req.body;

      const updated = await storage.updateStudyMaterial(id, {
        title,
        description,
        materialType,
        courseCode,
        courseName,
        faculty,
        department,
        level,
        semester,
        academicYear,
        price,
        isFree,
      });

      res.json(updated);
    } catch (error) {
      console.error("Error updating study material:", error);
      res.status(500).json({ message: "Failed to update study material" });
    }
  });

  // DELETE /api/study-materials/:id - Delete material
  app.delete("/api/study-materials/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const material = await storage.getStudyMaterial(id);

      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      if (material.uploaderId !== userId) {
        return res.status(403).json({ message: "You can only delete your own materials" });
      }

      await storage.deleteStudyMaterial(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting study material:", error);
      res.status(500).json({ message: "Failed to delete study material" });
    }
  });

  // POST /api/study-materials/:id/purchase - Purchase material (deduct from wallet)
  app.post("/api/study-materials/:id/purchase", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const material = await storage.getStudyMaterial(id);

      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Check if already purchased
      const alreadyPurchased = await storage.hasUserPurchasedMaterial(id, userId);
      if (alreadyPurchased) {
        return res.status(400).json({ message: "You already own this material" });
      }

      // If it's free, just record the purchase
      if (material.isFree) {
        await storage.purchaseStudyMaterial(id, userId, "0.00");
        return res.json({ success: true, message: "Material added to your library" });
      }

      // Get user's wallet
      const wallet = await storage.getWallet(userId);
      if (!wallet) {
        return res.status(400).json({ message: "Wallet not found" });
      }

      const price = parseFloat(material.price || "0");
      const balance = parseFloat(wallet.balance || "0");

      if (balance < price) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }

      // Deduct from buyer's wallet
      await storage.updateWalletBalance(userId, price.toFixed(2), 'subtract');

      // Record the purchase
      await storage.purchaseStudyMaterial(id, userId, material.price || "0.00");

      // Create transaction record for buyer
      await storage.createTransaction({
        walletId: wallet.id,
        type: "purchase",
        amount: `-${material.price || "0.00"}`,
        description: `Purchase: ${material.title}`,
        status: "completed",
      });

      // Credit the seller (90% of the price, 10% platform fee)
      const sellerAmount = (price * 0.9).toFixed(2);
      const sellerWallet = await storage.getWallet(material.uploaderId);
      if (sellerWallet) {
        await storage.updateWalletBalance(material.uploaderId, sellerAmount, 'add');
        
        await storage.createTransaction({
          walletId: sellerWallet.id,
          type: "sale",
          amount: sellerAmount,
          description: `Sale: ${material.title}`,
          status: "completed",
          relatedUserId: userId,
        });
      }

      res.json({ success: true, message: "Purchase successful" });
    } catch (error) {
      console.error("Error purchasing study material:", error);
      res.status(500).json({ message: "Failed to purchase study material" });
    }
  });

  // GET /api/study-materials/:id/download - Download material (check purchase/free)
  app.get("/api/study-materials/:id/download", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const material = await storage.getStudyMaterial(id);

      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Check if user can download (owner, purchased, or free)
      const isOwner = material.uploaderId === userId;
      const hasPurchased = await storage.hasUserPurchasedMaterial(id, userId);
      const isFree = material.isFree;

      if (!isOwner && !hasPurchased && !isFree) {
        return res.status(403).json({ message: "Please purchase this material to download" });
      }

      // Increment download count
      await storage.incrementMaterialDownloads(id);

      res.json({ downloadUrl: material.fileUrl });
    } catch (error) {
      console.error("Error downloading study material:", error);
      res.status(500).json({ message: "Failed to download study material" });
    }
  });

  // POST /api/study-materials/:id/rate - Rate a material
  app.post("/api/study-materials/:id/rate", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { id } = req.params;
      const { rating, review } = req.body;

      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({ message: "Rating must be between 1 and 5" });
      }

      const material = await storage.getStudyMaterial(id);
      if (!material) {
        return res.status(404).json({ message: "Study material not found" });
      }

      // Check if user has purchased or owns the material
      const isOwner = material.uploaderId === userId;
      const hasPurchased = await storage.hasUserPurchasedMaterial(id, userId);

      if (!isOwner && !hasPurchased && !material.isFree) {
        return res.status(403).json({ message: "You can only rate materials you've purchased" });
      }

      const newRating = await storage.rateStudyMaterial(id, userId, rating, review);
      res.json(newRating);
    } catch (error) {
      console.error("Error rating study material:", error);
      res.status(500).json({ message: "Failed to rate study material" });
    }
  });

  // ==================== TEST EMAIL ENDPOINT ====================
  // Admin endpoint to send test emails for verifying Resend integration
  app.post("/api/admin/send-test-email", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      // Check if user is admin
      const user = await storage.getUser(userId);
      const superAdminIds = (process.env.SUPER_ADMIN_IDS || "").split(",").map(id => id.trim());
      if (!user || !superAdminIds.includes(userId)) {
        return res.status(403).json({ message: "Only admins can send test emails" });
      }
      
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }
      
      const result = await sendTestEmail(email);
      
      if (result.success) {
        console.log(`Test email sent successfully to ${email}`);
        res.json({ 
          success: true, 
          message: `Test email sent successfully to ${email}`,
          messageId: result.messageId 
        });
      } else {
        console.error(`Failed to send test email to ${email}:`, result.error);
        res.status(500).json({ 
          success: false, 
          message: `Failed to send test email: ${result.error}` 
        });
      }
    } catch (error: any) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: error.message || "Failed to send test email" });
    }
  });

  // ==================== RESELLER API ENDPOINTS ====================
  
  // Get current user's reseller site
  app.get("/api/reseller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      res.json(site || null);
    } catch (error) {
      console.error("Error fetching reseller site:", error);
      res.status(500).json({ message: "Failed to fetch reseller site" });
    }
  });

  // Create a new reseller site
  app.post("/api/reseller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Validate input
      const validatedData = createResellerSiteSchema.parse(req.body);

      // Check if user already has a reseller site
      const existingSite = await storage.getResellerSite(userId);
      if (existingSite) {
        return res.status(400).json({ message: "You already have a reseller site" });
      }

      // Check if subdomain is taken
      const subdomainTaken = await storage.getResellerSiteBySubdomain(validatedData.subdomain);
      if (subdomainTaken) {
        return res.status(400).json({ message: "This subdomain is already taken" });
      }

      // Get tier pricing
      const tierPrices: Record<string, number> = {
        starter: 5000,
        business: 15000,
        enterprise: 50000,
      };
      const price = tierPrices[validatedData.tier];

      // Check wallet balance
      const wallet = await storage.getOrCreateWallet(userId);
      if (parseFloat(wallet.balance) < price) {
        return res.status(400).json({ 
          message: `Insufficient balance. You need ₦${price.toLocaleString()} for the ${validatedData.tier} plan.` 
        });
      }

      // Deduct from wallet
      await storage.updateWalletBalance(userId, price.toString(), "subtract");
      
      // Create transaction record
      await storage.createTransaction({
        walletId: wallet.id,
        type: "reseller_setup",
        amount: (-price).toString(),
        description: `Reseller ${validatedData.tier} plan setup fee`,
        status: "completed",
      });

      // Create the reseller site
      const site = await storage.createResellerSite({
        userId,
        tier: validatedData.tier,
        siteName: validatedData.siteName,
        subdomain: validatedData.subdomain,
        siteDescription: validatedData.siteDescription,
        contactEmail: validatedData.contactEmail,
        contactPhone: validatedData.contactPhone,
        whatsappNumber: validatedData.whatsappNumber,
        businessName: validatedData.businessName,
      });

      res.status(201).json(site);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating reseller site:", error);
      res.status(500).json({ message: error.message || "Failed to create reseller site" });
    }
  });

  // Update reseller site settings
  app.patch("/api/reseller", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const validatedData = updateResellerSiteSchema.parse(req.body);
      
      const updatedSite = await storage.updateResellerSite(site.id, validatedData);
      res.json(updatedSite);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error updating reseller site:", error);
      res.status(500).json({ message: "Failed to update reseller site" });
    }
  });

  // Get reseller stats
  app.get("/api/reseller/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const stats = await storage.getResellerStats(site.id);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching reseller stats:", error);
      res.status(500).json({ message: "Failed to fetch reseller stats" });
    }
  });

  // Get reseller transactions
  app.get("/api/reseller/transactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const { limit, offset, status } = req.query;
      const transactions = await storage.getResellerTransactions(site.id, {
        limit: limit ? parseInt(limit as string) : undefined,
        offset: offset ? parseInt(offset as string) : undefined,
        status: status as string | undefined,
      });
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching reseller transactions:", error);
      res.status(500).json({ message: "Failed to fetch reseller transactions" });
    }
  });

  // Get reseller customers
  app.get("/api/reseller/customers", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const customers = await storage.getResellerCustomers(site.id);
      res.json(customers);
    } catch (error) {
      console.error("Error fetching reseller customers:", error);
      res.status(500).json({ message: "Failed to fetch reseller customers" });
    }
  });

  // Get reseller's custom pricing
  app.get("/api/reseller/pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const pricing = await storage.getResellerPricing(site.id);
      res.json(pricing);
    } catch (error) {
      console.error("Error fetching reseller pricing:", error);
      res.status(500).json({ message: "Failed to fetch reseller pricing" });
    }
  });

  // Set custom pricing for a service
  app.post("/api/reseller/pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const { serviceType, serviceId, costPrice, sellingPrice } = req.body;
      
      if (!serviceType || !serviceId || !costPrice || !sellingPrice) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const cost = parseFloat(costPrice);
      const sell = parseFloat(sellingPrice);
      
      if (sell < cost) {
        return res.status(400).json({ message: "Selling price cannot be less than cost price" });
      }

      const profitMargin = (((sell - cost) / cost) * 100).toFixed(2);

      const pricing = await storage.setResellerPricing({
        resellerId: site.id,
        serviceType,
        serviceId,
        costPrice: cost.toFixed(2),
        sellingPrice: sell.toFixed(2),
        profitMargin,
      });

      res.json(pricing);
    } catch (error) {
      console.error("Error setting reseller pricing:", error);
      res.status(500).json({ message: "Failed to set reseller pricing" });
    }
  });

  // Delete custom pricing
  app.delete("/api/reseller/pricing/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      await storage.deleteResellerPricing(req.params.id);
      res.json({ message: "Pricing deleted successfully" });
    } catch (error) {
      console.error("Error deleting reseller pricing:", error);
      res.status(500).json({ message: "Failed to delete reseller pricing" });
    }
  });

  // Generate API keys for reseller
  app.post("/api/reseller/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      // Check if API keys already exist
      if (site.apiKey) {
        return res.status(400).json({ message: "API keys already generated. Revoke existing keys first." });
      }

      const { apiKey, apiSecret, webhookSecret } = req.body;
      
      if (!apiKey || !apiSecret || !webhookSecret) {
        return res.status(400).json({ message: "Missing required credentials" });
      }

      // Check if user is admin (free access) or needs to pay
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        // Check wallet balance for API fee
        const wallet = await storage.getWallet(userId);
        if (!wallet || parseFloat(wallet.balance) < 5000) {
          return res.status(400).json({ message: "Insufficient balance. API access costs ₦5,000" });
        }

        // Deduct API fee using updateWalletBalance
        await storage.updateWalletBalance(userId, "5000", "subtract");

        // Create transaction record
        await storage.createTransaction({
          walletId: wallet.id,
          type: "api_access_fee",
          amount: "-5000.00",
          description: "API Access Fee - Reseller API Keys Generation",
          status: "completed",
        });
      }

      // Save API keys
      const updatedSite = await storage.updateResellerSite(site.id, {
        apiKey,
        apiSecret,
        apiWebhookSecret: webhookSecret,
        apiEnabled: true,
        apiCreatedAt: new Date(),
      });

      res.json({ 
        message: "API keys generated successfully",
        apiKey: updatedSite.apiKey,
        apiEnabled: updatedSite.apiEnabled,
      });
    } catch (error) {
      console.error("Error generating API keys:", error);
      res.status(500).json({ message: "Failed to generate API keys" });
    }
  });

  // Revoke/Delete API keys for reseller
  app.delete("/api/reseller/api-keys", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      if (!site.apiKey) {
        return res.status(400).json({ message: "No API keys to revoke" });
      }

      // Revoke API keys
      await storage.updateResellerSite(site.id, {
        apiKey: null,
        apiSecret: null,
        apiWebhookSecret: null,
        apiEnabled: false,
      });

      res.json({ message: "API keys revoked successfully" });
    } catch (error) {
      console.error("Error revoking API keys:", error);
      res.status(500).json({ message: "Failed to revoke API keys" });
    }
  });

  // =====================================================
  // RESELLER WITHDRAWAL/PAYOUT ROUTES
  // =====================================================

  // Create withdrawal request
  app.post("/api/reseller/withdraw", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      if (site.status !== "active") {
        return res.status(403).json({ message: "Reseller site is not active" });
      }

      // Validate request body
      const validation = createResellerWithdrawalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validation.error.errors 
        });
      }

      const { amount, bankName, accountNumber, accountName } = validation.data;
      const pin = req.body.pin;

      // Check if user has PIN set and verify it
      const pinData = await storage.getTransactionPin(userId);
      if (pinData?.transactionPinSet) {
        // PIN is required
        if (!pin) {
          return res.status(400).json({ 
            message: "Transaction PIN is required for withdrawals",
            pinRequired: true
          });
        }

        // Check if user is locked out
        const isLocked = await storage.isUserPinLocked(userId);
        if (isLocked) {
          const lockUntil = pinData?.pinLockUntil;
          const remainingMinutes = lockUntil ? Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 60000) : 30;
          return res.status(429).json({ 
            message: `PIN is temporarily locked. Try again in ${remainingMinutes} minutes.`,
            locked: true,
            remainingMinutes
          });
        }

        // Verify PIN
        const isValid = await bcrypt.compare(pin, pinData.transactionPin!);
        if (!isValid) {
          const attempts = await storage.incrementPinAttempts(userId);
          const remainingAttempts = 5 - attempts;
          
          if (remainingAttempts <= 0) {
            const lockUntil = new Date(Date.now() + 30 * 60 * 1000);
            await storage.lockPin(userId, lockUntil);
            return res.status(429).json({ 
              message: "Too many failed attempts. PIN is locked for 30 minutes.",
              locked: true,
              remainingMinutes: 30
            });
          }
          
          return res.status(401).json({ 
            message: `Incorrect PIN. ${remainingAttempts} attempts remaining.`,
            remainingAttempts
          });
        }

        // Reset attempts on success
        await storage.resetPinAttempts(userId);
      }

      // Calculate available balance
      const totalProfit = parseFloat(site.totalProfit || "0");
      const withdrawnAmount = parseFloat(await storage.getResellerWithdrawnAmount(site.id));
      const availableBalance = totalProfit - withdrawnAmount;

      if (amount > availableBalance) {
        return res.status(400).json({ 
          message: `Insufficient balance. Available: ₦${availableBalance.toLocaleString()}` 
        });
      }

      // Determine initial status based on amount
      // Amounts > ₦50,000 require admin approval
      const initialStatus = amount > 50000 ? "pending" : "processing";

      const withdrawal = await storage.createResellerWithdrawal({
        resellerId: site.id,
        amount: amount.toFixed(2),
        bankName,
        accountNumber,
        accountName,
        status: initialStatus,
      });

      res.json({
        message: initialStatus === "pending" 
          ? "Withdrawal request submitted. Amounts over ₦50,000 require admin approval."
          : "Withdrawal request submitted and is being processed.",
        withdrawal,
        availableBalance: availableBalance - amount,
      });
    } catch (error) {
      console.error("Error creating withdrawal request:", error);
      res.status(500).json({ message: "Failed to create withdrawal request" });
    }
  });

  // Get reseller's withdrawal history
  app.get("/api/reseller/withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const site = await storage.getResellerSite(userId);
      if (!site) {
        return res.status(404).json({ message: "Reseller site not found" });
      }

      const withdrawals = await storage.getResellerWithdrawals(site.id);
      
      // Calculate balance summary
      const totalProfit = parseFloat(site.totalProfit || "0");
      const withdrawnAmount = parseFloat(await storage.getResellerWithdrawnAmount(site.id));
      const availableBalance = totalProfit - withdrawnAmount;

      res.json({
        withdrawals,
        summary: {
          totalEarnings: totalProfit,
          withdrawnAmount,
          availableBalance,
          pendingWithdrawals: withdrawals
            .filter(w => w.status === "pending" || w.status === "processing")
            .reduce((sum, w) => sum + parseFloat(w.amount), 0),
        },
      });
    } catch (error) {
      console.error("Error fetching withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Admin: Get all withdrawal requests
  app.get("/api/admin/reseller-withdrawals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const withdrawals = await storage.getAllResellerWithdrawals();
      res.json(withdrawals);
    } catch (error) {
      console.error("Error fetching all withdrawals:", error);
      res.status(500).json({ message: "Failed to fetch withdrawals" });
    }
  });

  // Admin: Update withdrawal status (approve/reject)
  app.patch("/api/admin/reseller-withdrawals/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (!user || user.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;
      
      // Validate request body
      const validation = updateResellerWithdrawalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validation.error.errors 
        });
      }

      const { status, adminNote } = validation.data;

      const withdrawal = await storage.getResellerWithdrawalById(id);
      if (!withdrawal) {
        return res.status(404).json({ message: "Withdrawal not found" });
      }

      // Don't allow changes to already completed/failed/rejected withdrawals
      if (["completed", "failed", "rejected"].includes(withdrawal.status || "")) {
        return res.status(400).json({ 
          message: `Cannot update withdrawal with status: ${withdrawal.status}` 
        });
      }

      const updatedWithdrawal = await storage.updateResellerWithdrawalStatus(
        id, 
        status, 
        adminNote, 
        userId
      );

      res.json({
        message: `Withdrawal ${status === "completed" ? "approved" : status === "rejected" ? "rejected" : "updated"} successfully`,
        withdrawal: updatedWithdrawal,
      });
    } catch (error) {
      console.error("Error updating withdrawal:", error);
      res.status(500).json({ message: "Failed to update withdrawal" });
    }
  });

  // =====================================================
  // PUBLIC STORE ROUTES - No authentication required
  // These endpoints power the public reseller storefront
  // =====================================================

  // Get reseller site config by subdomain (public)
  app.get("/api/store/:subdomain", async (req, res) => {
    try {
      const { subdomain } = req.params;
      
      if (!subdomain || subdomain.length < 3) {
        return res.status(400).json({ message: "Invalid subdomain" });
      }

      const site = await storage.getResellerSiteBySubdomain(subdomain.toLowerCase());
      
      if (!site) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (site.status !== "active") {
        return res.status(403).json({ message: "Store is not active" });
      }

      // Return only public fields, hide sensitive data
      res.json({
        id: site.id,
        siteName: site.siteName,
        siteDescription: site.siteDescription,
        logoUrl: site.logoUrl,
        faviconUrl: site.faviconUrl,
        primaryColor: site.primaryColor,
        secondaryColor: site.secondaryColor,
        contactEmail: site.contactEmail,
        contactPhone: site.contactPhone,
        whatsappNumber: site.whatsappNumber,
        tier: site.tier,
        subdomain: site.subdomain,
      });
    } catch (error) {
      console.error("Error fetching store config:", error);
      res.status(500).json({ message: "Failed to fetch store configuration" });
    }
  });

  // Get VTU plans with reseller pricing (public)
  app.get("/api/store/:subdomain/plans", async (req, res) => {
    try {
      const { subdomain } = req.params;
      
      if (!subdomain || subdomain.length < 3) {
        return res.status(400).json({ message: "Invalid subdomain" });
      }

      const site = await storage.getResellerSiteBySubdomain(subdomain.toLowerCase());
      
      if (!site) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (site.status !== "active") {
        return res.status(403).json({ message: "Store is not active" });
      }

      // Get tier-based profit margin
      const tierMargins: Record<string, number> = {
        starter: 0.05,    // 5%
        business: 0.07,   // 7%
        enterprise: 0.10, // 10%
      };
      const profitMargin = tierMargins[site.tier] || 0.05;

      // Get custom pricing if any
      const customPricing = await storage.getResellerPricing(site.id);
      const customPriceMap = new Map(
        customPricing.map(p => [`${p.serviceType}:${p.serviceId}`, p])
      );

      // Get base data plans
      const basePlans = getAllDataPlans();
      
      // Apply reseller pricing
      const plans = basePlans.map(plan => {
        const customPrice = customPriceMap.get(`data:${plan.id}`);
        
        if (customPrice && customPrice.isActive) {
          return {
            ...plan,
            sellingPrice: parseFloat(customPrice.sellingPrice),
            resellerMargin: parseFloat(customPrice.profitMargin),
          };
        }
        
        // Apply tier-based margin on top of base price
        const resellerMarkup = Math.ceil(plan.apiPrice * profitMargin);
        const resellerSellingPrice = plan.sellingPrice + resellerMarkup;
        
        return {
          ...plan,
          sellingPrice: resellerSellingPrice,
          resellerMargin: resellerMarkup,
        };
      });

      // Get network info for airtime pricing
      const networks = NETWORK_INFO;

      res.json({
        plans,
        networks,
        discount: getDiscountInfo(),
        profitMargin: Math.round(profitMargin * 100),
      });
    } catch (error) {
      console.error("Error fetching store plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Process guest VTU purchase (public)
  app.post("/api/store/:subdomain/purchase", async (req, res) => {
    try {
      const { subdomain } = req.params;
      const { serviceType, planId, phoneNumber, email, amount } = req.body;
      
      if (!subdomain || subdomain.length < 3) {
        return res.status(400).json({ message: "Invalid subdomain" });
      }

      const site = await storage.getResellerSiteBySubdomain(subdomain.toLowerCase());
      
      if (!site) {
        return res.status(404).json({ message: "Store not found" });
      }

      if (site.status !== "active") {
        return res.status(403).json({ message: "Store is not active" });
      }

      // Validate input
      if (!serviceType || !phoneNumber) {
        return res.status(400).json({ message: "Service type and phone number are required" });
      }

      if (!isValidNigerianPhone(phoneNumber)) {
        return res.status(400).json({ message: "Invalid Nigerian phone number" });
      }

      if (serviceType !== "data" && serviceType !== "airtime") {
        return res.status(400).json({ message: "Invalid service type. Must be 'data' or 'airtime'" });
      }

      // Calculate pricing
      let purchaseAmount: number;
      let costPrice: number;
      let planDetails: DataPlan | null = null;

      const tierMargins: Record<string, number> = {
        starter: 0.05,
        business: 0.07,
        enterprise: 0.10,
      };
      const profitMargin = tierMargins[site.tier] || 0.05;

      if (serviceType === "data") {
        if (!planId) {
          return res.status(400).json({ message: "Plan ID is required for data purchase" });
        }
        
        const plan = getDataPlanById(planId);
        if (!plan) {
          return res.status(400).json({ message: "Invalid data plan" });
        }

        planDetails = plan;
        costPrice = plan.apiPrice;
        
        // Check for custom pricing
        const customPricing = await storage.getResellerPricing(site.id);
        const customPrice = customPricing.find(p => p.serviceType === "data" && p.serviceId === planId);
        
        if (customPrice && customPrice.isActive) {
          purchaseAmount = parseFloat(customPrice.sellingPrice);
        } else {
          const resellerMarkup = Math.ceil(plan.apiPrice * profitMargin);
          purchaseAmount = plan.sellingPrice + resellerMarkup;
        }
      } else {
        // Airtime
        if (!amount || amount < 50 || amount > 50000) {
          return res.status(400).json({ message: "Airtime amount must be between ₦50 and ₦50,000" });
        }
        
        costPrice = amount * 0.98; // 2% discount
        const resellerMarkup = Math.ceil(amount * profitMargin);
        purchaseAmount = amount + resellerMarkup;
      }

      // Calculate reseller profit
      const resellerProfit = purchaseAmount - (costPrice + Math.ceil(costPrice * 0.02)); // Platform takes ~2%
      const platformFee = Math.ceil(costPrice * 0.02);

      // Check daily transaction limit
      const dailyLimit = parseFloat(site.dailyTransactionLimit || "50000");
      if (purchaseAmount > dailyLimit) {
        return res.status(400).json({ 
          message: `Transaction exceeds daily limit of ₦${dailyLimit.toLocaleString()}` 
        });
      }

      // Check if Squad is configured
      if (!isSquadConfigured()) {
        return res.status(503).json({ 
          message: "Payment service is temporarily unavailable" 
        });
      }

      // Generate payment reference
      const paymentReference = generatePaymentReference();

      // Create pending transaction
      const transaction = await storage.createResellerTransaction({
        resellerId: site.id,
        customerPhone: phoneNumber,
        customerEmail: email || null,
        serviceType,
        serviceId: planId || `airtime_${amount}`,
        amount: purchaseAmount.toString(),
        costPrice: costPrice.toString(),
        resellerProfit: resellerProfit.toString(),
        platformFee: platformFee.toString(),
        status: "pending",
        reference: paymentReference,
      });

      // Track or update customer
      await storage.getOrCreateResellerCustomer(site.id, phoneNumber, email || undefined);

      // Get callback URL
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.get("host");
      const callbackUrl = `${protocol}://${host}/api/store/${subdomain}/payment-callback?ref=${paymentReference}`;

      // Initialize Squad payment
      const paymentResult = await squad.initializePayment({
        amount: purchaseAmount,
        email: email || `${phoneNumber}@guest.eksuplug.com`,
        customerName: phoneNumber,
        transactionRef: paymentReference,
        callbackUrl,
        paymentChannels: ["card", "bank", "ussd", "transfer"],
        metadata: {
          storeSubdomain: subdomain,
          resellerId: site.id,
          transactionId: transaction.id,
          serviceType,
          planId: planId || null,
          phoneNumber,
          amount: purchaseAmount,
        },
      });

      res.json({
        success: true,
        checkoutUrl: paymentResult.checkoutUrl,
        transactionReference: paymentResult.transactionRef,
        amount: purchaseAmount,
        serviceSummary: serviceType === "data" && planDetails
          ? `${planDetails.name} - ${planDetails.dataAmount}`
          : `₦${amount} Airtime`,
      });
    } catch (error: any) {
      console.error("Error processing store purchase:", error);
      res.status(500).json({ 
        message: error.userMessage || "Failed to process purchase" 
      });
    }
  });

  // Handle Squad payment callback for store purchases (public)
  app.get("/api/store/:subdomain/payment-callback", async (req, res) => {
    try {
      const { subdomain } = req.params;
      const { ref, reference, transaction_ref } = req.query;
      const transactionRef = (ref || reference || transaction_ref) as string;

      if (!transactionRef) {
        return res.redirect(`/store/${subdomain}?status=error&message=Invalid+reference`);
      }

      // Verify payment with Squad
      const verificationResult = await squad.verifyTransaction(transactionRef);

      if (verificationResult.transactionStatus !== "success") {
        return res.redirect(
          `/store/${subdomain}?status=failed&message=Payment+not+completed`
        );
      }

      // Get transaction from database
      const transactions = await storage.getResellerTransactions(
        verificationResult.email?.includes("@guest.eksuplug.com") 
          ? undefined 
          : verificationResult.email
      );
      const transaction = transactions.find(t => t.reference === transactionRef);

      if (!transaction) {
        console.error("Store transaction not found for ref:", transactionRef);
        return res.redirect(`/store/${subdomain}?status=error&message=Transaction+not+found`);
      }

      // Check if already processed
      if (transaction.status === "completed") {
        return res.redirect(
          `/store/${subdomain}?status=success&message=Already+processed&ref=${transactionRef}`
        );
      }

      // Get transaction metadata
      const metadata = verificationResult.metadata || {};
      const { serviceType, planId, phoneNumber, amount } = metadata as any;

      // Execute VTU purchase
      let purchaseResult;
      try {
        if (serviceType === "data" && planId) {
          const plan = getDataPlanById(planId);
          if (plan) {
            purchaseResult = await purchaseData(plan.network, phoneNumber, plan.planCode);
          }
        } else if (serviceType === "airtime" && phoneNumber) {
          const network = detectNetwork(phoneNumber) || "mtn";
          const airtimeAmount = parseFloat(transaction.amount) / 1.05; // Approximate original amount
          purchaseResult = await purchaseAirtime(network, phoneNumber, airtimeAmount);
        }
      } catch (purchaseError: any) {
        console.error("VTU purchase error:", purchaseError);
        await storage.updateResellerTransaction(transaction.id, {
          status: "failed",
          apiResponse: { error: purchaseError.message },
        });
        return res.redirect(
          `/store/${subdomain}?status=failed&message=Service+delivery+failed`
        );
      }

      if (purchaseResult?.success) {
        // Update transaction as completed
        await storage.updateResellerTransaction(transaction.id, {
          status: "completed",
          apiResponse: purchaseResult,
        });

        return res.redirect(
          `/store/${subdomain}?status=success&ref=${transactionRef}&message=Purchase+successful`
        );
      } else {
        await storage.updateResellerTransaction(transaction.id, {
          status: "failed",
          apiResponse: purchaseResult,
        });
        return res.redirect(
          `/store/${subdomain}?status=failed&message=Service+delivery+failed`
        );
      }
    } catch (error) {
      console.error("Error processing store payment callback:", error);
      const { subdomain } = req.params;
      res.redirect(`/store/${subdomain}?status=error&message=Processing+error`);
    }
  });

  // Webhook for Squad payment notifications for store (public)
  app.post("/api/store/:subdomain/webhook", async (req, res) => {
    try {
      const { subdomain } = req.params;
      const signature = req.headers["x-squad-encrypted-body"] as string;
      const payload = req.body;

      // Get reseller site for webhook verification
      const site = await storage.getResellerSiteBySubdomain(subdomain.toLowerCase());
      
      if (!site) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Verify webhook signature if secret is set
      if (site.apiWebhookSecret && signature) {
        const isValid = squad.verifyWebhookSignature(
          JSON.stringify(payload), 
          signature, 
          site.apiWebhookSecret
        );
        if (!isValid) {
          return res.status(401).json({ message: "Invalid webhook signature" });
        }
      }

      // Process webhook
      const { event, data } = payload;

      if (event === "charge_successful" || event === "charge.success") {
        const transactionRef = data?.transaction_ref || data?.reference;
        
        if (transactionRef) {
          // Find and update transaction
          const transactions = await storage.getResellerTransactions(site.id);
          const transaction = transactions.find(t => t.reference === transactionRef);

          if (transaction && transaction.status === "pending") {
            // Execute VTU purchase
            const metadata = data?.metadata || {};
            const { serviceType, planId, phoneNumber } = metadata;

            let purchaseResult;
            if (serviceType === "data" && planId) {
              const plan = getDataPlanById(planId);
              if (plan) {
                purchaseResult = await purchaseData(plan.network, phoneNumber, plan.planCode);
              }
            } else if (serviceType === "airtime") {
              const network = detectNetwork(phoneNumber) || "mtn";
              const airtimeAmount = parseFloat(transaction.amount) / 1.05;
              purchaseResult = await purchaseAirtime(network, phoneNumber, airtimeAmount);
            }

            await storage.updateResellerTransaction(transaction.id, {
              status: purchaseResult?.success ? "completed" : "failed",
              apiResponse: purchaseResult,
            });
          }
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Error processing store webhook:", error);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  return httpServer;
}
