import type { Express } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { getChatbotResponseWithHandoff, checkForPaymentScam, type ChatMessage } from "../../chatbot";
import { sendErrorReportToAdmin, sendNewTicketNotificationToAdmin, sendTicketReplyNotification } from "../../email-service";
import {
  insertReviewSchema,
  insertReportSchema,
  insertWatchlistSchema,
  createSavedSearchSchema,
  saveDraftSchema,
  createScheduledPostSchema,
  createBoostSchema,
  createDisputeSchema,
  createSupportTicketSchema,
  createAnnouncementSchema,
  updateAnnouncementSchema,
} from "../../../shared/schema";
import {
  getUserId,
  isAdminUser,
} from "../common";

const chatbotRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  currentPage: z.string().optional(),
  conversationHistory: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string()
  })).optional(),
});

export function registerMiscRoutes(app: Express) {
  // ==================== ERROR REPORTING API ROUTES ====================

  app.post("/api/errors/report", async (req, res) => {
    try {
      const { message, stack, componentStack, url, userAgent, timestamp } = req.body;

      console.error("Frontend Error Report:", {
        message,
        stack,
        componentStack,
        url,
        userAgent,
        timestamp,
      });

      sendErrorReportToAdmin("Frontend Error Report", `URL: ${url}\n\nError: ${message}\n\nStack: ${stack}`, {
        componentStack,
        userAgent,
        timestamp,
      }).catch(err => {
        console.error("Failed to send error report email:", err);
      });

      res.json({ success: true, message: "Error report received" });
    } catch (error) {
      console.error("Error processing error report:", error);
      res.status(500).json({ message: "Failed to process error report" });
    }
  });

  // ==================== SAVED SEARCHES ====================

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

  // ==================== DRAFT PRODUCTS ====================

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

  // ==================== SCHEDULED POSTS ====================

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

  // ==================== BOOST REQUESTS ====================

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

      const wallet = await storage.getOrCreateWallet(userId);
      const currentBalance = parseFloat(wallet.balance);
      const boostCost = parseFloat(validated.amount);

      if (currentBalance < boostCost) {
        return res.status(400).json({
          message: `Insufficient balance. Available: ₦${currentBalance}, Required: ₦${boostCost}`
        });
      }

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + validated.duration);

      const updatedWallet = await storage.updateWalletBalance(userId, validated.amount, 'subtract');

      const boost = await storage.createBoostRequest({
        productId: validated.productId,
        sellerId: userId,
        type: validated.type,
        duration: validated.duration,
        amount: validated.amount,
        expiresAt,
      });

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

  // ==================== DISPUTES ====================

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

  // ==================== SUPPORT TICKETS ====================

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

  app.get('/api/support/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const ticket = await storage.getSupportTicketById(id);

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

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

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const isAdmin = user.role === 'admin';

      if (ticket.userId !== userId && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to reply to this ticket" });
      }

      const reply = await storage.createTicketReply({
        ticketId,
        userId,
        message: message.trim(),
        isAdminReply: isAdmin,
      });

      if (isAdmin && ticket.userId !== userId) {
        try {
          const ticketOwner = await storage.getUser(ticket.userId);
          if (ticketOwner) {
            await sendTicketReplyNotification(
              ticketOwner.email,
              ticketOwner.firstName || 'User',
              ticket.ticketNumber || ticket.id,
              ticket.subject,
              message.trim()
            );
          }
        } catch (emailError) {
          console.error("Failed to send ticket reply notification:", emailError);
        }
      }

      res.json(reply);
    } catch (error) {
      console.error("Error creating reply:", error);
      res.status(500).json({ message: "Failed to create reply" });
    }
  });

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

  app.post('/api/tickets/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const validated = createSupportTicketSchema.parse({ ...req.body, userId });
      const ticket = await storage.createSupportTicketWithNumber(validated);

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

  // ==================== REVIEWS ====================

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

  // ==================== WATCHLIST ====================

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

  // ==================== REPORTS ====================

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

  app.post("/api/chatbot", async (req: any, res) => {
    try {
      const validated = chatbotRequestSchema.parse(req.body);

      const userMessage = validated.message;
      const currentPage = validated.currentPage;
      const history = validated.conversationHistory || [];

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

      const hasPaymentWarning = checkForPaymentScam(userMessage);

      const trustedMessages: ChatMessage[] = [
        ...history.slice(-6).map(h => ({ role: h.role as "user" | "assistant", content: h.content })),
        { role: "user" as const, content: userMessage }
      ];

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

  // ==================== NOTIFICATIONS ====================

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

  // ==================== ANNOUNCEMENTS ====================

  app.get("/api/announcements", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const announcements = await storage.getAnnouncements(false);

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

  app.get("/api/announcements/:id", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const announcement = await storage.getAnnouncement(req.params.id);

      if (!announcement) {
        return res.status(404).json({ message: "Announcement not found" });
      }

      if (!announcement.isPublished) {
        if (!userId) {
          return res.status(404).json({ message: "Announcement not found" });
        }
        if (!(await isAdminUser(userId))) {
          return res.status(404).json({ message: "Announcement not found" });
        }
      }

      await storage.incrementAnnouncementViews(req.params.id);

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
}
