import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import {
  createSecretMessageLinkSchema,
  sendSecretMessageSchema,
} from "../../../shared/schema";
import {
  getUserId,
  isAdminUser,
} from "../common";

const secretMessageRateLimit = new Map<string, { count: number; resetAt: Date }>();

function checkSecretMessageRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: Date } {
  const now = new Date();
  const limit = secretMessageRateLimit.get(ip);

  if (!limit || now > limit.resetAt) {
    const resetAt = new Date(now.getTime() + 60 * 60 * 1000);
    secretMessageRateLimit.set(ip, { count: 1, resetAt });
    return { allowed: true, remaining: 4, resetAt };
  }

  if (limit.count >= 5) {
    return { allowed: false, remaining: 0, resetAt: limit.resetAt };
  }

  limit.count++;
  return { allowed: true, remaining: 5 - limit.count, resetAt: limit.resetAt };
}

export function registerConfessionsRoutes(app: Express) {
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

      const confession = await storage.getConfession(id);
      if (!confession || confession.status !== "approved") {
        return res.status(404).json({ message: "Confession not found" });
      }

      if (userId) {
        const isNewView = await storage.recordUniqueConfessionView(id, userId);
        res.json({ success: true, isNewView });
      } else {
        const sessionId = req.session?.id || req.ip;
        if (sessionId) {
          const viewerKey = `anon_${sessionId}`;
          const isNewView = await storage.recordUniqueConfessionView(id, viewerKey);
          res.json({ success: true, isNewView });
        } else {
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

  // ===========================================
  // SECRET MESSAGE LINKS (Anonymous Messages)
  // ===========================================

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
      await storage.createSecretMessage(link.id, data.content);

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

      const link = await storage.getSecretMessageLink(id);
      if (!link || link.userId !== userId) {
        return res.status(404).json({ message: "Link not found" });
      }

      const updated = await storage.toggleSecretMessageLink(id);
      res.json(updated);
    } catch (error) {
      console.error("Error toggling secret link:", error);
      res.status(500).json({ message: "Failed to toggle link" });
    }
  });
}
