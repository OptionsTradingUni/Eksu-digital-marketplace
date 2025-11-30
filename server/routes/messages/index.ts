import type { Express } from "express";
import { WebSocket } from "ws";
import { storage } from "../../storage";
import { isAuthenticated } from "../../auth";
import { 
  insertMessageSchema,
  type Order,
} from "../../../shared/schema";
import { uploadToObjectStorage } from "../../object-storage";
import { getChatbotResponseWithHandoff } from "../../chatbot";
import {
  sendMessageNotification,
  sendOrderMessageNotification,
  sendMessageReplyNotification,
} from "../../email-service";
import {
  getUserId,
  requireEmailVerified,
  createAndBroadcastNotification,
  isSystemAccount,
  getWsConnections,
  upload,
} from "../common";

const recentSupportTickets = new Map<string, number>();
const SUPPORT_TICKET_COOLDOWN_MS = 5 * 60 * 1000;

function containsSupportKeywords(content: string): boolean {
  const supportKeywords = ['help', 'support', 'agent', 'human', 'assistance', 'problem', 'issue', 'complaint', 'refund', 'dispute'];
  const lowerContent = content.toLowerCase();
  return supportKeywords.some(keyword => lowerContent.includes(keyword));
}

async function processSystemAccountMessage(userMessage: string, userId: string, productId?: string | null): Promise<void> {
  const systemUserId = process.env.SYSTEM_USER_ID;
  if (!systemUserId) return;

  try {
    const user = await storage.getUser(userId);
    const userName = user?.firstName || 'there';

    const response = await getChatbotResponseWithHandoff(
      [{ role: 'user', content: userMessage }],
      { 
        userId, 
        role: user?.role || 'buyer',
        currentPage: 'messages' 
      }
    );

    let aiResponse: string;
    if (response.shouldHandoff) {
      aiResponse = `Hey ${userName}! I noticed you might need some extra help with this. ${response.message}\n\nIf you need to speak with a human agent, please create a support ticket from the Help section. Our team will get back to you within 24 hours!`;
    } else {
      aiResponse = response.message;
    }

    const aiMessage = await storage.createMessage({
      senderId: systemUserId,
      receiverId: userId,
      content: aiResponse,
      productId: productId || undefined,
    });

    const wsConnections = getWsConnections();
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
    try {
      const fallbackMessage = await storage.createMessage({
        senderId: systemUserId,
        receiverId: userId,
        content: "Hey! Thanks for reaching out to Campus Hub. I'm having a small technical glitch right now. Please try again in a moment, or create a support ticket from the Help section if you need immediate assistance.",
        productId: productId || undefined,
      });
      
      const wsConnections = getWsConnections();
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

async function maybeCreateSupportTicket(userId: string, content: string): Promise<void> {
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
      description: content,
      category: 'general',
      priority: 'medium',
    });
    recentSupportTickets.set(userId, now);
    console.log(`Auto-created support ticket for user ${userId}`);
  } catch (ticketError) {
    console.error("Failed to auto-create support ticket:", ticketError);
  }
}

export function registerMessagesRoutes(app: Express) {
  app.get("/api/messages/threads", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const threads = await storage.getMessageThreads(userId);
      
      const filteredThreads = [];
      for (const thread of threads) {
        const otherUserId = thread.user?.id;
        if (!otherUserId) continue;
        
        if (isSystemAccount(otherUserId)) {
          filteredThreads.push(thread);
          continue;
        }
        
        const [userBlockedOther, otherBlockedUser] = await Promise.all([
          storage.isUserBlocked(userId, otherUserId),
          storage.isUserBlocked(otherUserId, userId),
        ]);
        
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
      
      await storage.markMessagesAsRead(userId, req.params.otherUserId);
      
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

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

      if (!isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          storage.isUserBlocked(userId, validated.receiverId),
          storage.isUserBlocked(validated.receiverId, userId),
        ]);
        
        if (senderBlockedReceiver || receiverBlockedSender) {
          return res.status(403).json({ message: "You cannot message this user" });
        }
      }

      const message = await storage.createMessage(validated);
      
      if (isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
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
      } else {
        if (validated.receiverId && validated.receiverId !== userId) {
          const sender = await storage.getUser(userId);
          const receiver = await storage.getUser(validated.receiverId);
          if (sender && receiver) {
            const senderName = sender.firstName && sender.lastName 
              ? `${sender.firstName} ${sender.lastName}` 
              : sender.email;
            
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
                    o.status && !['completed', 'cancelled', 'refunded'].includes(o.status)
                  ) || receiverOrders.find((o: Order) =>
                    o.productId === validated.productId && 
                    o.buyerId === userId &&
                    o.status && !['completed', 'cancelled', 'refunded'].includes(o.status)
                  );
                }
                
                const existingMessages = await storage.getMessageThread(userId, validated.receiverId);
                const isReply = existingMessages.length > 1;
                
                if (relatedOrder && product) {
                  const isBuyerMessage = relatedOrder.buyerId === userId;
                  await sendOrderMessageNotification(receiver.email, {
                    senderName,
                    senderId: userId,
                    messagePreview: validated.content,
                    orderId: relatedOrder.id,
                    productName: product.title,
                    productId: validated.productId || undefined,
                    orderStatus: relatedOrder.status || undefined,
                    isBuyerMessage,
                  });
                } else if (isReply) {
                  await sendMessageReplyNotification(receiver.email, {
                    senderName,
                    senderId: userId,
                    messagePreview: validated.content,
                    productName: product?.title,
                    productId: validated.productId || undefined,
                  });
                } else {
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

  app.post("/api/messages/with-attachment", isAuthenticated, requireEmailVerified, upload.single("attachment"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      let imageUrl: string | null = null;

      if (req.file) {
        imageUrl = await uploadToObjectStorage(req.file, "message-attachments/");
        if (!imageUrl) {
          return res.status(500).json({ message: "Failed to upload attachment" });
        }
      }

      const { receiverId, content, productId } = req.body;

      if (!receiverId) {
        return res.status(400).json({ message: "Receiver ID is required" });
      }

      if (!isSystemAccount(receiverId) && !isSystemAccount(userId)) {
        const [senderBlockedReceiver, receiverBlockedSender] = await Promise.all([
          storage.isUserBlocked(userId, receiverId),
          storage.isUserBlocked(receiverId, userId),
        ]);
        
        if (senderBlockedReceiver || receiverBlockedSender) {
          return res.status(403).json({ message: "You cannot message this user" });
        }
      }

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
      
      if (isSystemAccount(validated.receiverId) && !isSystemAccount(userId)) {
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
      
      if (validated.receiverId && validated.receiverId !== userId && !isSystemAccount(validated.receiverId)) {
        const sender = await storage.getUser(userId);
        const receiver = await storage.getUser(validated.receiverId);
        if (sender && receiver) {
          const senderName = sender.firstName && sender.lastName 
            ? `${sender.firstName} ${sender.lastName}` 
            : sender.email;
          
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
                  o.status && !['completed', 'cancelled', 'refunded'].includes(o.status)
                ) || receiverOrders.find((o: Order) =>
                  o.productId === validated.productId && 
                  o.buyerId === userId &&
                  o.status && !['completed', 'cancelled', 'refunded'].includes(o.status)
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
                  orderStatus: relatedOrder.status || undefined,
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

  app.post("/api/conversations/:userId/disappearing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { duration } = req.body;
      const validDurations = [0, 86400, 604800, 7776000];
      
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
}
