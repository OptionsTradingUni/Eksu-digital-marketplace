import { WebSocket } from "ws";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "../../storage";

// ============================================
// WebSocket Connection Management
// ============================================

const wsConnections = new Map<string, Set<WebSocket>>();

export function addWsConnection(userId: string, ws: WebSocket) {
  if (!wsConnections.has(userId)) {
    wsConnections.set(userId, new Set());
  }
  wsConnections.get(userId)!.add(ws);
}

export function removeWsConnection(userId: string, ws: WebSocket) {
  const connections = wsConnections.get(userId);
  if (connections) {
    connections.delete(ws);
    if (connections.size === 0) {
      wsConnections.delete(userId);
    }
  }
}

export async function broadcastNotification(userId: string, notification: any) {
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

export function broadcastToUser(userId: string, data: any) {
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

export function getOnlineUserIds(): string[] {
  return Array.from(wsConnections.keys());
}

export function isUserOnline(userId: string): boolean {
  return wsConnections.has(userId);
}

export function broadcastUserStatusChange(userId: string, isOnline: boolean) {
  const statusMessage = JSON.stringify({
    type: "user_status_change",
    userId,
    isOnline,
  });
  
  wsConnections.forEach((connections) => {
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(statusMessage);
      }
    });
  });
}

export async function createAndBroadcastNotification(data: {
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

// ============================================
// Game Room WebSocket Management
// ============================================

const gameRoomConnections = new Map<string, Map<string, WebSocket>>();

export function addGameRoomConnection(roomCode: string, userId: string, ws: WebSocket) {
  if (!gameRoomConnections.has(roomCode)) {
    gameRoomConnections.set(roomCode, new Map());
  }
  gameRoomConnections.get(roomCode)!.set(userId, ws);
}

export function removeGameRoomConnection(roomCode: string, userId: string) {
  const room = gameRoomConnections.get(roomCode);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      gameRoomConnections.delete(roomCode);
    }
  }
}

export function broadcastToGameRoom(roomCode: string, data: any, excludeUserId?: string) {
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

export function getGameRoomPlayerCount(roomCode: string): number {
  const room = gameRoomConnections.get(roomCode);
  return room ? room.size : 0;
}

// ============================================
// File Upload Configuration
// ============================================

export const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
});

export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images and videos are allowed"));
    }
  },
});

export const uploadDisk = multer({
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

// ============================================
// Authentication Helpers
// ============================================

export function getUserId(req: any): string | null {
  return req.user?.id || null;
}

export function isSuperAdmin(userId: string | null): boolean {
  if (!userId) return false;
  const adminIds = process.env.SUPER_ADMIN_IDS?.split(',').map(id => id.trim()) || [];
  return adminIds.includes(userId);
}

export function isSupportRep(userId: string | null): boolean {
  if (!userId) return false;
  const supportIds = process.env.SUPPORT_IDS?.split(',').map(id => id.trim()) || [];
  return supportIds.includes(userId);
}

export function hasAdminAccess(userId: string | null): boolean {
  return isSuperAdmin(userId);
}

export function hasSupportAccess(userId: string | null): boolean {
  return isSuperAdmin(userId) || isSupportRep(userId);
}

export async function isAdminUser(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  if (isSuperAdmin(userId)) return true;
  const user = await storage.getUser(userId);
  return user?.role === "admin";
}

// ============================================
// Email Verification
// ============================================

export const MAX_LISTINGS_UNVERIFIED = 3;

export async function checkEmailVerified(userId: string): Promise<{ verified: boolean; message?: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { verified: false, message: "User not found" };
  }
  
  const systemUserId = process.env.SYSTEM_USER_ID || process.env.SYSTEM_WELCOME_USER_ID;
  if (userId === systemUserId) {
    return { verified: true };
  }
  
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

export function requireEmailVerified(req: any, res: any, next: any) {
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
    return res.status(500).json({ 
      message: "Unable to verify email status. Please try again.",
      code: "VERIFICATION_ERROR"
    });
  });
}

export function requireAdmin(req: any, res: any, next: any) {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (isSuperAdmin(userId)) {
    return next();
  }
  
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
