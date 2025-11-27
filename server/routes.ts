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
} from "@shared/schema";
import { getChatbotResponse, checkForPaymentScam, type ChatMessage } from "./chatbot";
import { squad, generatePaymentReference, generateTransferReference, isSquadConfigured } from "./squad";
import { calculatePricingFromSellerPrice, calculateSquadFee, getCommissionRate, getSecurityDepositAmount, isWithdrawalAllowed } from "./pricing";

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

  // ==================== NEW AUTH ROUTES (Passport.js Local) ====================
  
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

      const { email, password, firstName, lastName, phoneNumber, role, referralCode } = validationResult.data;

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user - only pass phoneNumber if it's not empty
      const userData: { 
        email: string; 
        password: string; 
        firstName: string; 
        lastName: string; 
        phoneNumber?: string; 
        role: "buyer" | "seller" | "both" 
      } = {
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
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
            console.log(`New user ${user.email} now follows system user @${systemUser.firstName || 'CampusPlugOfficial'}`);
            
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
      
      res.status(500).json({ 
        message: "Failed to register user. Please try again.",
        error: process.env.NODE_ENV === "development" ? error.message : undefined
      });
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

      // TODO: In production, you could:
      // 1. Save to database for error tracking
      // 2. Send email notification via Resend
      // 3. Send to error monitoring service (Sentry, LogRocket, etc.)

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

  app.post('/api/wallet/deposit', isAuthenticated, async (req: any, res) => {
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

  app.post('/api/wallet/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, bankName, accountNumber, accountName } = req.body;

      if (!amount || parseFloat(amount) < 500) {
        return res.status(400).json({ message: "Minimum withdrawal is 500 NGN" });
      }

      if (!bankName || !accountNumber || !accountName) {
        return res.status(400).json({ message: "Bank details are required" });
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

  // Check if Squad is configured
  app.get('/api/squad/status', (req, res) => {
    res.json({ configured: isSquadConfigured() });
  });

  // Initialize a Squad payment
  app.post('/api/squad/initialize', isAuthenticated, async (req: any, res) => {
    try {
      if (!isSquadConfigured()) {
        return res.status(503).json({ message: "Payment service is not configured" });
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

      const paymentResult = await squad.initializePayment({
        amount,
        email: user.email,
        customerName: `${user.firstName} ${user.lastName}`,
        transactionRef: paymentReference,
        callbackUrl: redirectUrl,
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

      res.json({
        checkoutUrl: paymentResult.checkoutUrl,
        transactionReference: paymentResult.transactionRef,
        paymentReference,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error initializing Squad payment:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to initialize payment" });
    }
  });

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
          transferResult.transactionStatus,
          undefined,
          transferResult.transactionStatus === 'success' ? new Date() : undefined
        );

        res.json({
          message: "Withdrawal initiated successfully",
          reference,
          status: transferResult.transactionStatus,
        });
      } catch (transferError) {
        // Refund wallet if transfer fails
        await storage.updateWalletBalance(userId, withdrawAmount.toString(), 'add');
        await storage.updateSquadTransferStatus(reference, 'failed', String(transferError));
        
        throw transferError;
      }
    } catch (error) {
      console.error("Error processing Squad withdrawal:", error);
      res.status(500).json({ message: error instanceof Error ? error.message : "Failed to process withdrawal" });
    }
  });

  // ==================== NEGOTIATION ROUTES ====================

  // Submit a price offer on a product
  app.post('/api/negotiations', isAuthenticated, async (req: any, res) => {
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
      if (validated.role === 'seller' || validated.role === 'admin') {
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
  const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute window
  const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per minute per user

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
  function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const userLimit = loginStreakRateLimits.get(userId);
    
    if (!userLimit || (now - userLimit.windowStart) > RATE_LIMIT_WINDOW_MS) {
      // New window or expired window
      loginStreakRateLimits.set(userId, { count: 1, windowStart: now });
      return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS };
    }
    
    if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
      const resetIn = RATE_LIMIT_WINDOW_MS - (now - userLimit.windowStart);
      return { allowed: false, remaining: 0, resetIn };
    }
    
    userLimit.count++;
    loginStreakRateLimits.set(userId, userLimit);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - userLimit.count, resetIn: RATE_LIMIT_WINDOW_MS - (now - userLimit.windowStart) };
  }

  // Login streak routes
  app.post('/api/login-streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Check rate limit
      const rateCheck = checkRateLimit(userId);
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
      const ticket = await storage.createSupportTicket(validated);
      res.json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
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
      const { search, category, condition, location } = req.query;
      const products = await storage.getProducts({
        search: search as string,
        categoryId: category as string,
        condition: condition as string,
        location: location as string,
      });
      res.json(products);
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
      
      res.json(product);
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
      
      if (user.role !== "seller" && user.role !== "admin" && user.role !== "both") {
        return res.status(403).json({ 
          message: "Only sellers can create listings. Please update your role to 'Seller' or 'Both' in your profile settings." 
        });
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
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
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
      
      // Prevent non-admins from setting admin role
      if (role === "admin") {
        if (!(await isAdminUser(userId))) {
          return res.status(403).json({ message: "Cannot set admin role" });
        }
      }

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
      if (follower && targetUserId !== userId) {
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

  // Message routes
  app.get("/api/messages/threads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const threads = await storage.getMessageThreads(userId);
      res.json(threads);
    } catch (error) {
      console.error("Error fetching threads:", error);
      res.status(500).json({ message: "Failed to fetch threads" });
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

  app.post("/api/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const validated = insertMessageSchema.parse({
        senderId: userId,
        ...req.body,
      });

      // Prevent regular users from messaging the system account
      if (isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
        return res.status(403).json({ 
          message: "You cannot send messages to the Campus Hub account. For support, please use the Help section." 
        });
      }

      const message = await storage.createMessage(validated);
      
      // Create notification for the message receiver
      if (validated.receiverId && validated.receiverId !== userId) {
        const sender = await storage.getUser(userId);
        if (sender) {
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
            link: `/messages/${userId}`,
            relatedUserId: userId,
            relatedProductId: validated.productId || undefined,
          });
        }
      }
      
      res.json(message);
    } catch (error: any) {
      console.error("Error creating message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
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
  });
  
  app.post("/api/chatbot", async (req: any, res) => {
    try {
      // Validate request
      const validated = chatbotRequestSchema.parse(req.body);
      
      // SECURITY: Only accept the current user message, not full history
      // We'll maintain conversation history server-side in the future
      const userMessage = validated.message;
      const currentPage = validated.currentPage;

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
          };
        }
      } else if (currentPage) {
        userContext = { currentPage };
      }

      // Check for payment scam patterns in the user message
      const hasPaymentWarning = checkForPaymentScam(userMessage);

      // Build trusted conversation (for now just single message)
      // In production, this should pull from server-side session storage
      const trustedMessages: ChatMessage[] = [
        { role: "user", content: userMessage }
      ];

      const response = await getChatbotResponse(trustedMessages, userContext);

      res.json({
        message: response,
        hasPaymentWarning,
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
  app.post("/api/social-posts", isAuthenticated, uploadMedia.array("media", 10), async (req: any, res) => {
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
  app.post("/api/social-posts/:id/comments", isAuthenticated, async (req: any, res) => {
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
  app.post("/api/orders", isAuthenticated, async (req: any, res) => {
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

  return httpServer;
}
