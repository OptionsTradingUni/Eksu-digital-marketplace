import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import { insertProductSchema, insertMessageSchema, insertReviewSchema, insertReportSchema, insertWatchlistSchema } from "@shared/schema";

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

// Helper to get user ID from session
function getUserId(req: any): string | null {
  return req.user?.claims?.sub || null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup auth middleware
  await setupAuth(app);

  // Serve uploaded images
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  });
  app.use("/uploads", express.static(uploadDir));

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
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
