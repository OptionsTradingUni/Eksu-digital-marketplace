import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { uploadMultipleToObjectStorage, uploadVideoToStorage } from "../../object-storage";
import {
  getUserId,
  uploadMedia,
  createAndBroadcastNotification,
} from "../common";

export function registerStoriesRoutes(app: Express) {
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

      const userStories = await storage.getUserActiveStories(targetUserId);

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
}
