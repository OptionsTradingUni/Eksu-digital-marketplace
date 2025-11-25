import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth as setupPassportAuth, isAuthenticated } from "./auth";
import passport from "passport";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { z } from "zod";
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
} from "@shared/schema";
import { getChatbotResponse, checkForPaymentScam, type ChatMessage } from "./chatbot";

// Setup multer for image uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Passport.js authentication (email/password) for Railway deployment
  await setupPassportAuth(app);
  
  // TODO: Replit Auth has been replaced with Passport.js local auth for Railway deployment
  // Remove setupReplitAuth call to avoid session conflicts
  // await setupReplitAuth(app);

  // Serve uploaded images
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  app.use("/uploads", express.static(uploadDir));

  // ==================== NEW AUTH ROUTES (Passport.js Local) ====================
  
  // Registration route
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;

      // Validate required fields
      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        phoneNumber,
      });

      // Remove password from user object before storing in session/sending to client
      const { password: _, ...safeUser } = user;

      // Log the user in
      req.login(safeUser, (err) => {
        if (err) {
          console.error("Error logging in after registration:", err);
          return res.status(500).json({ message: "Registration successful but login failed" });
        }
        res.json(safeUser);
      });
    } catch (error) {
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
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
    req.logout((err) => {
      if (err) {
        console.error("Error logging out:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
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
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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

  // Login streak routes
  app.post('/api/login-streak', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const result = await storage.updateLoginStreak(userId);
      res.json(result);
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

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      // Increment view count
      await storage.incrementProductViews(req.params.id);
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

      // Check if user is a seller or admin
      const user = await storage.getUser(userId);
      if (user?.role !== "seller" && user?.role !== "admin") {
        return res.status(403).json({ message: "Only sellers can create listings" });
      }

      const productData = JSON.parse(req.body.data);
      const validated = insertProductSchema.parse(productData);

      // Get uploaded image paths
      const images = (req.files as Express.Multer.File[])?.map(
        (file) => `/uploads/${file.filename}`
      ) || [];

      const product = await storage.createProduct({
        ...validated,
        sellerId: userId,
        images,
      });

      res.json(product);
    } catch (error: any) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: error.message || "Failed to create product" });
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
      
      // Get new uploaded image paths if any
      const newImages = (req.files as Express.Multer.File[])?.map(
        (file) => `/uploads/${file.filename}`
      ) || [];

      const updateData = {
        ...productData,
        ...(newImages.length > 0 && { images: [...(existing.images || []), ...newImages] }),
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

  // Follow routes
  app.post("/api/users/:id/follow", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const follow = await storage.followUser(userId, req.params.id);
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

      const message = await storage.createMessage(validated);
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
  });
  
  app.post("/api/chatbot", async (req: any, res) => {
    try {
      // Validate request
      const validated = chatbotRequestSchema.parse(req.body);
      
      // SECURITY: Only accept the current user message, not full history
      // We'll maintain conversation history server-side in the future
      const userMessage = validated.message;

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
          };
        }
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      const updated = await storage.approveProduct(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Error approving product:", error);
      res.status(500).json({ message: "Failed to approve product" });
    }
  });

  // Admin Metrics Routes - Database & Memory Monitoring
  app.get("/api/admin/metrics/tables", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
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

      const user = await storage.getUser(userId);
      if (user?.role !== "admin") {
        return res.status(403).json({ message: "Forbidden" });
      }

      // Check if pg_stat_statements extension is available
      const hasExtension = await storage.executeRawSQL<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') as exists`
      );

      let queryStats = [];
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

  // Create HTTP server
  const httpServer = createServer(app);

  // Setup WebSocket server for real-time chat
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  // Store active connections with user IDs
  const connections = new Map<string, WebSocket>();

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
            connections.set(userId, ws);
            console.log(`WebSocket authenticated for user: ${userId}`);
            ws.send(JSON.stringify({ type: "auth_success", userId }));
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
          
          // Send to recipient if they're connected
          const recipientWs = connections.get(data.receiverId);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            recipientWs.send(JSON.stringify({
              type: "new_message",
              message: savedMessage,
            }));
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
        connections.delete(userId);
        console.log(`WebSocket disconnected for user: ${userId}`);
      }
    });
    
    ws.on("error", (error) => {
      console.error(`WebSocket error for user ${userId}:`, error);
      if (userId) {
        connections.delete(userId);
      }
    });
  });

  return httpServer;
}
