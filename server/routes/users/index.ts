import { Router, type Express } from "express";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { uploadToObjectStorage } from "../../object-storage";
import { sendNewFollowerEmail } from "../../email-service";
import { roleUpdateSchema } from "../../../shared/schema";
import {
  getUserId,
  upload,
  createAndBroadcastNotification,
  getOnlineUserIds,
  isSystemAccount,
} from "../common";

const router = Router();

router.get("/users/online-status", async (req, res) => {
  try {
    const onlineUserIds = getOnlineUserIds();
    res.json({ onlineUserIds });
  } catch (error) {
    console.error("Error fetching online status:", error);
    res.status(500).json({ message: "Failed to fetch online status" });
  }
});

router.get("/users/blocked", isAuthenticated, async (req: any, res) => {
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

router.get("/users/muted", isAuthenticated, async (req: any, res) => {
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

router.get("/users/username/:username", async (req, res) => {
  try {
    const username = req.params.username;
    const user = await storage.getUserByUsername(username);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const { password, ...safeUser } = user;
    res.json(safeUser);
  } catch (error) {
    console.error("Error fetching user by username:", error);
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

router.get("/users/:id", async (req: any, res) => {
  try {
    const targetUserId = req.params.id;
    const user = await storage.getUser(targetUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    const viewerId = getUserId(req);
    if (viewerId && viewerId !== targetUserId) {
      const isBlockedByTarget = await storage.isUserBlocked(targetUserId, viewerId);
      
      if (isBlockedByTarget) {
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

router.put("/users/:id", isAuthenticated, async (req: any, res) => {
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

router.post("/upload", isAuthenticated, upload.single("image"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = getUserId(req);
    const prefix = userId ? `profiles/${userId}/` : "uploads/";
    
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

router.put("/users/:id/profile-image", isAuthenticated, async (req: any, res) => {
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

router.put("/users/:id/cover-image", isAuthenticated, async (req: any, res) => {
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

router.put("/users/:id/role", isAuthenticated, async (req: any, res) => {
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

router.post("/users/verify-account", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { phoneNumber, location, ninNumber } = req.body;

    if (!phoneNumber && !location && !ninNumber) {
      return res.status(400).json({ 
        message: "Please provide at least one verification field (phone number, location, or NIN)" 
      });
    }

    const updateData: Record<string, any> = {
      isVerified: true,
    };

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

router.post("/users/:id/follow", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const targetUserId = req.params.id;
    
    if (isSystemAccount(targetUserId) && !isSystemAccount(userId)) {
      return res.status(403).json({ 
        message: "You cannot follow the official Campus Hub account. You are already following it!" 
      });
    }
    
    const follow = await storage.followUser(userId, targetUserId);
    
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

router.delete("/users/:id/follow", isAuthenticated, async (req: any, res) => {
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

router.get("/users/:id/followers", async (req, res) => {
  try {
    const followers = await storage.getFollowers(req.params.id);
    res.json(followers);
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({ message: "Failed to fetch followers" });
  }
});

router.get("/users/:id/following", async (req, res) => {
  try {
    const following = await storage.getFollowing(req.params.id);
    res.json(following);
  } catch (error) {
    console.error("Error fetching following:", error);
    res.status(500).json({ message: "Failed to fetch following" });
  }
});

router.get("/users/:id/follow-stats", async (req: any, res) => {
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

router.post("/users/:id/block", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const targetUserId = req.params.id;
    
    if (userId === targetUserId) {
      return res.status(400).json({ message: "You cannot block yourself" });
    }

    await storage.blockUser(userId, targetUserId);
    
    try {
      await storage.unfollowUser(userId, targetUserId);
      await storage.unfollowUser(targetUserId, userId);
    } catch (e) {
    }

    res.json({ message: "User blocked successfully" });
  } catch (error: any) {
    console.error("Error blocking user:", error);
    res.status(400).json({ message: error.message || "Failed to block user" });
  }
});

router.delete("/users/:id/block", isAuthenticated, async (req: any, res) => {
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

router.post("/users/:id/mute", isAuthenticated, async (req: any, res) => {
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

router.delete("/users/:id/mute", isAuthenticated, async (req: any, res) => {
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

router.post("/users/:id/report", isAuthenticated, async (req: any, res) => {
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

router.get("/users/:id/relationship", isAuthenticated, async (req: any, res) => {
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

router.get("/blocked-users", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const blockedUsersWithRelation = await storage.getBlockedUsers(userId);
    
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

router.patch("/users/me/location", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { latitude, longitude } = req.body;
    
    if (latitude === undefined || longitude === undefined) {
      return res.status(400).json({ message: "Latitude and longitude are required" });
    }
    
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

router.patch("/users/me/username", isAuthenticated, async (req: any, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { username } = req.body;
    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ message: "Username must be 3-20 characters" });
    }
    
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

export function registerUsersRoutes(app: Express) {
  app.use("/api", router);
}
