import type { Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { uploadToObjectStorage, uploadVideoToStorage } from "../../object-storage";
import { sendNewPostFromFollowingEmail } from "../../email-service";
import {
  getUserId,
  isAdminUser,
  uploadMedia,
  requireEmailVerified,
  createAndBroadcastNotification,
} from "../common";

export function registerSocialRoutes(app: Express) {
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
      
      if (!hasContent && !hasMedia) {
        return res.status(400).json({ message: "Please add some text or media to your post" });
      }

      const images: string[] = [];
      const videos: string[] = [];
      
      if (req.files && Array.isArray(req.files)) {
        const prefix = `posts/${userId}/`;
        
        for (const file of req.files as Express.Multer.File[]) {
          let mediaUrl: string | null = null;
          
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

      const fullPost = await storage.getSocialPost(post.id);
      
      (async () => {
        try {
          const author = await storage.getUser(userId);
          if (!author) return;
          
          const authorName = author.firstName && author.lastName 
            ? `${author.firstName} ${author.lastName}` 
            : author.username || author.email.split('@')[0];
          
          const authorUsername = author.username || author.email.split('@')[0];
          const postPreview = hasContent ? content.trim() : "[Media post]";
          
          const followers = await storage.getFollowers(userId);
          
          const followersToEmail = followers.slice(0, 50);
          
          for (const follow of followers) {
            await createAndBroadcastNotification({
              userId: follow.follower.id,
              type: "new_post",
              title: "New Post",
              message: `${authorName} shared a new post`,
              link: `/the-plug?post=${post.id}`,
              relatedUserId: userId,
            });
          }
          
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

      const isLiked = await storage.isPostLiked(postId, userId);

      if (isLiked) {
        await storage.unlikeSocialPost(postId, userId);
        res.json({ liked: false });
      } else {
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

      const isReposted = await storage.isPostReposted(postId, userId);
      
      if (isReposted) {
        await storage.unrepostSocialPost(postId, userId);
        res.json({ success: true, action: "unreposted" });
      } else {
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

  // Track post view (unique: 1 view per user per 24 hours)
  app.post("/api/social-posts/:id/view", async (req: any, res) => {
    try {
      const postId = req.params.id;
      const userId = getUserId(req);
      
      if (userId) {
        const isNewView = await storage.recordUniquePostView(postId, userId);
        res.json({ success: true, isNewView });
      } else {
        const sessionId = req.session?.id || req.ip;
        if (sessionId) {
          const viewerKey = `anon_${sessionId}`;
          const isNewView = await storage.recordUniquePostView(postId, viewerKey);
          res.json({ success: true, isNewView });
        } else {
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

  // Get enhanced feed with algorithm
  app.get("/api/feed", async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const feedTypeParam = req.query.type as string;
      const userLat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
      const userLng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
      
      if (feedTypeParam === 'bookmarks') {
        if (!userId) {
          return res.status(401).json({ message: "Login to view saved posts" });
        }
        const bookmarkedPostData = await storage.getUserBookmarks(userId);
        
        const followingList = await storage.getFollowing(userId);
        const followingIds = new Set(followingList.map((f: any) => f.followingId || f.following?.id));
        
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
}
