// Database storage implementation
import {
  users,
  products,
  categories,
  messages,
  reviews,
  reports,
  watchlist,
  type User,
  type UpsertUser,
  type Product,
  type InsertProduct,
  type UpdateProduct,
  type Category,
  type InsertCategory,
  type Message,
  type InsertMessage,
  type Review,
  type InsertReport,
  type Watchlist,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(id: string, data: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  verifyUser(id: string): Promise<User>;
  banUser(id: string, reason: string): Promise<User>;
  
  // Product operations
  createProduct(product: InsertProduct & { sellerId: string }): Promise<Product>;
  getProduct(id: string): Promise<(Product & { seller: User }) | undefined>;
  getProducts(filters?: { search?: string; categoryId?: string; condition?: string; location?: string }): Promise<(Product & { seller: User })[]>;
  getSellerProducts(sellerId: string): Promise<Product[]>;
  updateProduct(id: string, data: UpdateProduct): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  incrementProductViews(id: string): Promise<void>;
  flagProduct(id: string, reason: string): Promise<Product>;
  approveProduct(id: string): Promise<Product>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Message operations
  getMessageThread(userId1: string, userId2: string): Promise<Message[]>;
  getMessageThreads(userId: string): Promise<any[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  markMessagesAsRead(userId: string, fromUserId: string): Promise<void>;
  
  // Review operations
  getUserReviews(userId: string): Promise<Review[]>;
  createReview(review: any): Promise<Review>;
  
  // Watchlist operations
  addToWatchlist(userId: string, productId: string): Promise<Watchlist>;
  getUserWatchlist(userId: string): Promise<Watchlist[]>;
  removeFromWatchlist(userId: string, productId: string): Promise<void>;
  
  // Report operations
  createReport(report: InsertReport): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async verifyUser(id: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isVerified: true, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    
    return user;
  }

  async banUser(id: string, reason: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isBanned: true, banReason: reason, isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    
    return user;
  }

  // Product operations
  async createProduct(product: InsertProduct & { sellerId: string }): Promise<Product> {
    const [created] = await db.insert(products).values(product).returning();
    return created;
  }

  async getProduct(id: string): Promise<(Product & { seller: User }) | undefined> {
    const result = await db
      .select()
      .from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(products.id, id));
    
    if (result.length === 0 || !result[0].products) return undefined;
    
    // If seller doesn't exist (orphaned product), return undefined
    if (!result[0].users) {
      console.error(`Product ${id} has invalid seller reference`);
      return undefined;
    }
    
    return {
      ...result[0].products,
      seller: result[0].users,
    };
  }

  async getProducts(filters?: { search?: string; categoryId?: string; condition?: string; location?: string }): Promise<(Product & { seller: User })[]> {
    let query = db
      .select()
      .from(products)
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(and(
        eq(products.isAvailable, true),
        eq(products.isApproved, true)
      ))
      .orderBy(desc(products.createdAt));

    const results = await query;
    
    // Filter out products with missing sellers (orphaned records)
    let filtered = results
      .filter(r => r.products && r.users)
      .map(r => ({
        ...r.products!,
        seller: r.users!,
      }));

    // Apply filters
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(searchLower) || 
        p.description.toLowerCase().includes(searchLower)
      );
    }

    if (filters?.categoryId) {
      filtered = filtered.filter(p => p.categoryId === filters.categoryId);
    }

    if (filters?.condition) {
      filtered = filtered.filter(p => p.condition === filters.condition);
    }

    if (filters?.location) {
      const locationLower = filters.location.toLowerCase();
      filtered = filtered.filter(p => p.location?.toLowerCase().includes(locationLower));
    }

    return filtered;
  }

  async getSellerProducts(sellerId: string): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(eq(products.sellerId, sellerId))
      .orderBy(desc(products.createdAt));
  }

  async updateProduct(id: string, data: UpdateProduct): Promise<Product> {
    const [updated] = await db
      .update(products)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    
    if (!updated) {
      throw new Error(`Product ${id} not found`);
    }
    
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.delete(products).where(eq(products.id, id));
  }

  async incrementProductViews(id: string): Promise<void> {
    await db
      .update(products)
      .set({ views: sql`${products.views} + 1` })
      .where(eq(products.id, id));
  }

  async flagProduct(id: string, reason: string): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ isFlagged: true, flagReason: reason, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  async approveProduct(id: string): Promise<Product> {
    const [product] = await db
      .update(products)
      .set({ isApproved: true, isFlagged: false, flagReason: null, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return product;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  // Message operations
  async getMessageThread(userId1: string, userId2: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(
        or(
          and(eq(messages.senderId, userId1), eq(messages.receiverId, userId2)),
          and(eq(messages.senderId, userId2), eq(messages.receiverId, userId1))
        )
      )
      .orderBy(messages.createdAt);
  }

  async getMessageThreads(userId: string): Promise<any[]> {
    // Get unique users this user has chatted with
    const sentMessages = await db
      .select({ userId: messages.receiverId })
      .from(messages)
      .where(eq(messages.senderId, userId));

    const receivedMessages = await db
      .select({ userId: messages.senderId })
      .from(messages)
      .where(eq(messages.receiverId, userId));

    const userIds = [...new Set([
      ...sentMessages.map(m => m.userId),
      ...receivedMessages.map(m => m.userId),
    ])];

    // Get user details and last message for each thread
    const threads = await Promise.all(
      userIds.map(async (otherUserId) => {
        const [user] = await db.select().from(users).where(eq(users.id, otherUserId));
        const thread = await this.getMessageThread(userId, otherUserId);
        const lastMessage = thread[thread.length - 1];
        const unreadCount = thread.filter(
          m => m.receiverId === userId && !m.isRead
        ).length;

        return {
          user,
          lastMessage,
          unreadCount,
        };
      })
    );

    return threads.sort((a, b) => {
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.createdAt!).getTime() - new Date(a.lastMessage.createdAt!).getTime();
    });
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const [created] = await db.insert(messages).values(message).returning();
    return created;
  }

  async markMessagesAsRead(userId: string, fromUserId: string): Promise<void> {
    await db
      .update(messages)
      .set({ isRead: true })
      .where(
        and(
          eq(messages.receiverId, userId),
          eq(messages.senderId, fromUserId)
        )
      );
  }

  // Review operations
  async getUserReviews(userId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.reviewedUserId, userId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(review: any): Promise<Review> {
    const [created] = await db.insert(reviews).values(review).returning();
    
    // Update user's trust score and rating count
    const userReviews = await this.getUserReviews(review.reviewedUserId);
    const avgRating = userReviews.reduce((sum, r) => sum + r.rating, 0) / userReviews.length;
    
    await db
      .update(users)
      .set({
        trustScore: avgRating.toFixed(1),
        totalRatings: userReviews.length,
        updatedAt: new Date(),
      })
      .where(eq(users.id, review.reviewedUserId));

    return created;
  }

  // Watchlist operations
  async addToWatchlist(userId: string, productId: string): Promise<Watchlist> {
    const [created] = await db
      .insert(watchlist)
      .values({ userId, productId })
      .returning();
    
    // Increment product watchers count
    await db
      .update(products)
      .set({ watchers: sql`${products.watchers} + 1` })
      .where(eq(products.id, productId));
    
    return created;
  }

  async getUserWatchlist(userId: string): Promise<Watchlist[]> {
    return await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.createdAt));
  }

  async removeFromWatchlist(userId: string, productId: string): Promise<void> {
    const result = await db
      .delete(watchlist)
      .where(and(eq(watchlist.userId, userId), eq(watchlist.productId, productId)))
      .returning();
    
    // Only decrement if a row was actually deleted
    if (result.length > 0) {
      await db
        .update(products)
        .set({ watchers: sql`GREATEST(${products.watchers} - 1, 0)` })
        .where(eq(products.id, productId));
    } else {
      throw new Error("Watchlist item not found");
    }
  }

  // Report operations
  async createReport(report: InsertReport): Promise<any> {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
