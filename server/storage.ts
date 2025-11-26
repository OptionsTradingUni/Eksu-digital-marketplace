// Database storage implementation
import crypto from "crypto";
import {
  users,
  products,
  categories,
  messages,
  reviews,
  reports,
  watchlist,
  wallets,
  transactions,
  referrals,
  welcomeBonuses,
  savedSearches,
  draftProducts,
  scheduledPosts,
  voicePosts,
  boostRequests,
  disputes,
  supportTickets,
  loginStreaks,
  sellerAnalytics,
  follows,
  hostels,
  events,
  escrowTransactions,
  paystackPayments,
  withdrawals,
  cartItems,
  games,
  gameMatches,
  gameScores,
  triviaQuestions,
  typingTexts,
  priceGuessProducts,
  passwordResetTokens,
  announcements,
  announcementReads,
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
  type Wallet,
  type InsertWallet,
  type Transaction,
  type InsertTransaction,
  type Referral,
  type WelcomeBonus,
  type SavedSearch,
  type InsertSavedSearch,
  type DraftProduct,
  type InsertDraftProduct,
  type ScheduledPost,
  type InsertScheduledPost,
  type VoicePost,
  type BoostRequest,
  type InsertBoostRequest,
  type Dispute,
  type InsertDispute,
  type SupportTicket,
  type InsertSupportTicket,
  type LoginStreak,
  type SellerAnalytics,
  type Hostel,
  type InsertHostel,
  type Event,
  type InsertEvent,
  type EscrowTransaction,
  type InsertEscrowTransaction,
  type PaystackPayment,
  type InsertPaystackPayment,
  type Withdrawal,
  type InsertWithdrawal,
  type Follow,
  type InsertFollow,
  type CartItem,
  type Game,
  type InsertGame,
  type GameMatch,
  type InsertGameMatch,
  type GameScore,
  type TriviaQuestion,
  type TypingText,
  type PriceGuessProduct,
  type PasswordResetToken,
  type Announcement,
  type CreateAnnouncementInput,
  type UpdateAnnouncementInput,
  type AnnouncementRead,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, sql, gt } from "drizzle-orm";

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface IStorage {
  // User operations (authentication & profiles)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByReferralCode(referralCode: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: { email: string; password: string; firstName: string; lastName: string; phoneNumber?: string; role?: "buyer" | "seller" | "both" | "admin" }): Promise<User>;
  updateUserProfile(id: string, data: Partial<User>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  verifyUser(id: string): Promise<User>;
  banUser(id: string, reason: string): Promise<User>;
  
  // Product operations
  createProduct(product: InsertProduct & { sellerId: string }): Promise<Product>;
  getProduct(id: string): Promise<(Product & { seller: User }) | undefined>;
  getProducts(filters?: { search?: string; categoryId?: string; condition?: string; location?: string }): Promise<(Product & { seller: User })[]>;
  getSellerProducts(sellerId: string): Promise<Product[]>;
  getSellerProductsWithAnalytics(sellerId: string): Promise<(Product & { inquiryCount: number })[]>;
  updateProduct(id: string, data: UpdateProduct): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  incrementProductViews(id: string): Promise<void>;
  incrementProductInquiries(productId: string): Promise<void>;
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
  
  // Wallet operations
  getOrCreateWallet(userId: string): Promise<Wallet>;
  getWallet(userId: string): Promise<Wallet | undefined>;
  updateWalletBalance(userId: string, amount: string, type: 'add' | 'subtract'): Promise<Wallet>;
  
  // Transaction operations
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  getUserTransactions(walletId: string): Promise<Transaction[]>;
  
  // Welcome bonus operations
  createWelcomeBonus(userId: string, amount: string): Promise<WelcomeBonus>;
  getWelcomeBonus(userId: string): Promise<WelcomeBonus | undefined>;
  
  // Referral operations
  createReferral(referrerId: string, referredUserId: string): Promise<Referral>;
  getUserReferrals(userId: string): Promise<(Referral & { referredUser?: { firstName: string | null; lastName: string | null; email: string; profileImageUrl: string | null } })[]>;
  markReferralPaid(referralId: string): Promise<Referral>;
  
  // Saved search operations
  createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch>;
  getUserSavedSearches(userId: string): Promise<SavedSearch[]>;
  deleteSavedSearch(id: string): Promise<void>;
  
  // Draft product operations
  saveDraft(sellerId: string, data: any): Promise<DraftProduct>;
  getUserDrafts(sellerId: string): Promise<DraftProduct[]>;
  deleteDraft(id: string): Promise<void>;
  
  // Scheduled post operations
  createScheduledPost(post: InsertScheduledPost): Promise<ScheduledPost>;
  getUserScheduledPosts(sellerId: string): Promise<ScheduledPost[]>;
  getPendingScheduledPosts(): Promise<ScheduledPost[]>;
  markScheduledPostPublished(id: string, productId: string): Promise<ScheduledPost>;
  
  // Voice post operations
  createVoicePost(post: any): Promise<VoicePost>;
  getUserVoicePosts(userId: string): Promise<VoicePost[]>;
  
  // Boost request operations
  createBoostRequest(request: InsertBoostRequest): Promise<BoostRequest>;
  getUserBoostRequests(sellerId: string): Promise<BoostRequest[]>;
  getActiveBoosts(): Promise<BoostRequest[]>;
  expireBoost(id: string): Promise<BoostRequest>;
  
  // Dispute operations
  createDispute(dispute: InsertDispute): Promise<Dispute>;
  getUserDisputes(userId: string): Promise<Dispute[]>;
  getAllDisputes(): Promise<Dispute[]>;
  resolveDispute(id: string, resolution: string, resolvedBy: string): Promise<Dispute>;
  
  // Support ticket operations
  createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket>;
  getUserSupportTickets(userId: string): Promise<SupportTicket[]>;
  getAllSupportTickets(): Promise<SupportTicket[]>;
  updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket>;
  
  // Login streak operations
  getOrCreateLoginStreak(userId: string): Promise<LoginStreak>;
  updateLoginStreak(userId: string, ipAddress?: string): Promise<{ streak: LoginStreak; reward: number; securityWarning?: string }>;
  
  // Seller analytics operations
  getOrCreateSellerAnalytics(sellerId: string): Promise<SellerAnalytics>;
  updateSellerAnalytics(sellerId: string, data: Partial<SellerAnalytics>): Promise<SellerAnalytics>;
  
  // Follow operations
  followUser(followerId: string, followingId: string): Promise<Follow>;
  unfollowUser(followerId: string, followingId: string): Promise<void>;
  getFollowers(userId: string): Promise<(Follow & { follower: User })[]>;
  getFollowing(userId: string): Promise<(Follow & { following: User })[]>;
  getFollowerCount(userId: string): Promise<number>;
  getFollowingCount(userId: string): Promise<number>;
  isFollowing(followerId: string, followingId: string): Promise<boolean>;
  
  // Hostel operations
  createHostel(hostel: InsertHostel & { agentId: string }): Promise<Hostel>;
  getHostel(id: string): Promise<(Hostel & { agent: User }) | undefined>;
  getHostels(filters?: { location?: string; minPrice?: number; maxPrice?: number }): Promise<Hostel[]>;
  getUserHostels(agentId: string): Promise<Hostel[]>;
  updateHostel(id: string, data: Partial<Hostel>): Promise<Hostel>;
  deleteHostel(id: string): Promise<void>;
  incrementHostelViews(id: string): Promise<void>;
  
  // Event operations
  createEvent(event: InsertEvent & { organizerId: string }): Promise<Event>;
  getEvent(id: string): Promise<(Event & { organizer: User }) | undefined>;
  getEvents(filters?: { eventType?: string; upcoming?: boolean }): Promise<Event[]>;
  getUserEvents(organizerId: string): Promise<Event[]>;
  updateEvent(id: string, data: Partial<Event>): Promise<Event>;
  deleteEvent(id: string): Promise<void>;
  incrementEventViews(id: string): Promise<void>;
  purchaseTicket(eventId: string, userId: string): Promise<Event>;
  
  // Escrow operations
  createEscrowTransaction(transaction: InsertEscrowTransaction & { buyerId: string; sellerId: string }): Promise<EscrowTransaction>;
  getEscrowTransaction(id: string): Promise<EscrowTransaction | undefined>;
  getUserEscrowTransactions(userId: string): Promise<EscrowTransaction[]>;
  confirmEscrowByBuyer(id: string): Promise<EscrowTransaction>;
  confirmEscrowBySeller(id: string): Promise<EscrowTransaction>;
  releaseEscrowFunds(id: string): Promise<EscrowTransaction>;
  refundEscrow(id: string): Promise<EscrowTransaction>;
  
  // Paystack payment operations
  createPaystackPayment(payment: InsertPaystackPayment & { userId: string }): Promise<PaystackPayment>;
  updatePaystackPayment(reference: string, data: Partial<PaystackPayment>): Promise<PaystackPayment>;
  getPaystackPayment(reference: string): Promise<PaystackPayment | undefined>;
  getUserPaystackPayments(userId: string): Promise<PaystackPayment[]>;
  processPaystackSuccess(reference: string, amount: string): Promise<void>;
  
  // Withdrawal operations
  createWithdrawal(withdrawal: InsertWithdrawal & { userId: string }): Promise<Withdrawal>;
  getUserWithdrawals(userId: string): Promise<Withdrawal[]>;
  updateWithdrawal(id: string, data: Partial<Withdrawal>): Promise<Withdrawal>;
  
  // NIN verification operations
  updateNINVerification(userId: string, ninHash: string, vnin: string): Promise<User>;
  
  // Social media update operations
  updateSocialMedia(userId: string, data: { instagramHandle?: string; tiktokHandle?: string; facebookProfile?: string }): Promise<User>;
  
  // Trust badge operations
  awardTrustBadge(userId: string): Promise<User>;
  revokeTrustBadge(userId: string): Promise<User>;
  
  // Referral update operations
  markReferralPurchase(referredUserId: string, purchaseId: string): Promise<void>;
  
  // Leaderboard operations
  getTopSellers(limit?: number): Promise<any[]>;
  getMostTrustedUsers(limit?: number): Promise<any[]>;
  
  // Notification operations
  getUserNotifications(userId: string): Promise<any[]>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<void>;
  createNotification(data: { userId: string; type: string; title: string; message: string; link?: string; relatedUserId?: string; relatedProductId?: string }): Promise<any>;
  
  // Raw SQL execution for admin metrics
  executeRawSQL<T = any>(query: string, params?: any[]): Promise<T[]>;
  
  // Cart operations
  getCartItems(userId: string): Promise<(CartItem & { product: Product })[]>;
  addToCart(userId: string, productId: string, quantity?: number): Promise<CartItem>;
  updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem>;
  removeFromCart(cartItemId: string): Promise<void>;
  clearCart(userId: string): Promise<void>;
  
  // Game operations
  createGame(game: { gameType: string; player1Id: string; stakeAmount: string; mode?: string }): Promise<Game>;
  getGame(id: string): Promise<(Game & { player1: User; player2: User | null }) | undefined>;
  getAvailableGames(gameType?: string): Promise<(Game & { player1: User })[]>;
  getUserGames(userId: string): Promise<Game[]>;
  joinGame(gameId: string, player2Id: string): Promise<Game>;
  startGame(gameId: string): Promise<Game>;
  completeGame(gameId: string, winnerId: string): Promise<Game>;
  cancelGame(gameId: string): Promise<Game>;
  createGameMatch(match: InsertGameMatch): Promise<GameMatch>;
  getGameMatches(gameId: string): Promise<GameMatch[]>;
  
  // Game score/leaderboard operations
  getOrCreateGameScore(userId: string, gameType: string): Promise<GameScore>;
  updateGameScore(userId: string, gameType: string, won: boolean, score: number, earnings?: string): Promise<GameScore>;
  getLeaderboard(gameType: string, limit?: number): Promise<(GameScore & { user: User })[]>;
  getGlobalLeaderboard(limit?: number): Promise<any[]>;
  
  // Game content operations
  getTriviaQuestions(limit?: number, category?: string): Promise<TriviaQuestion[]>;
  getRandomTriviaQuestion(): Promise<TriviaQuestion | undefined>;
  getTypingTexts(limit?: number): Promise<TypingText[]>;
  getRandomTypingText(): Promise<TypingText | undefined>;
  getPriceGuessProducts(limit?: number): Promise<PriceGuessProduct[]>;
  getRandomPriceGuessProduct(): Promise<PriceGuessProduct | undefined>;
  seedGameContent(): Promise<void>;
  
  // Password reset token operations
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  updateUserPassword(userId: string, hashedPassword: string): Promise<User>;
  
  // Announcement operations
  createAnnouncement(data: CreateAnnouncementInput & { authorId: string }): Promise<Announcement>;
  getAnnouncement(id: string): Promise<(Announcement & { author: User }) | undefined>;
  getAnnouncements(includeUnpublished?: boolean): Promise<(Announcement & { author: User })[]>;
  updateAnnouncement(id: string, data: UpdateAnnouncementInput): Promise<Announcement>;
  deleteAnnouncement(id: string): Promise<void>;
  incrementAnnouncementViews(id: string): Promise<void>;
  markAnnouncementAsRead(userId: string, announcementId: string): Promise<AnnouncementRead>;
  getUserAnnouncementReads(userId: string): Promise<AnnouncementRead[]>;
  isAnnouncementRead(userId: string, announcementId: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByReferralCode(referralCode: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.referralCode, referralCode.toUpperCase()));
    return user;
  }

  private async generateUniqueReferralCode(): Promise<string> {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const code = generateReferralCode();
      const existing = await this.getUserByReferralCode(code);
      if (!existing) {
        return code;
      }
      attempts++;
    }
    
    throw new Error('Failed to generate unique referral code after max attempts');
  }

  async createUser(userData: { email: string; password: string; firstName: string; lastName: string; phoneNumber?: string; role?: "buyer" | "seller" | "both" | "admin" }): Promise<User> {
    const referralCode = await this.generateUniqueReferralCode();
    
    const [user] = await db.insert(users).values({
      ...userData,
      referralCode,
    }).returning();
    
    // Create wallet and give welcome bonus for new users
    const bonusAmount = (Math.random() * 48 + 2).toFixed(2); // Random ₦2-₦50
    await this.createWelcomeBonus(user.id, bonusAmount);
    
    // Create login streak
    await this.getOrCreateLoginStreak(user.id);
    
    // If seller, create analytics
    if (user.role === 'seller' || user.role === 'admin') {
      await this.getOrCreateSellerAnalytics(user.id);
    }
    
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check if this is a new user
    const existing = userData.id ? await this.getUser(userData.id) : undefined;
    const isNewUser = !existing;

    // Generate referral code for new users
    const referralCode = isNewUser ? await this.generateUniqueReferralCode() : undefined;

    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        ...(referralCode && { referralCode }),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    // For new users, create wallet and give welcome bonus
    if (isNewUser) {
      const bonusAmount = (Math.random() * 48 + 2).toFixed(2); // Random ₦2-₦50
      await this.createWelcomeBonus(user.id, bonusAmount);
      
      // Create login streak
      await this.getOrCreateLoginStreak(user.id);
      
      // If seller, create analytics
      if (user.role === 'seller' || user.role === 'admin') {
        await this.getOrCreateSellerAnalytics(user.id);
      }
    }

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

  async getSellerProductsWithAnalytics(sellerId: string): Promise<(Product & { inquiryCount: number })[]> {
    const sellerProducts = await db
      .select()
      .from(products)
      .where(eq(products.sellerId, sellerId))
      .orderBy(desc(products.createdAt));

    // Get inquiry counts for each product
    const productsWithInquiries = await Promise.all(
      sellerProducts.map(async (product) => {
        const inquiries = await db
          .select()
          .from(messages)
          .where(eq(messages.productId, product.id));
        return {
          ...product,
          inquiryCount: inquiries.length,
        };
      })
    );

    return productsWithInquiries;
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

  async incrementProductInquiries(productId: string): Promise<void> {
    await db
      .update(products)
      .set({ inquiries: sql`${products.inquiries} + 1` })
      .where(eq(products.id, productId));
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

    const userIds = Array.from(new Set([
      ...sentMessages.map(m => m.userId),
      ...receivedMessages.map(m => m.userId),
    ]));

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

  // Wallet operations
  async getOrCreateWallet(userId: string): Promise<Wallet> {
    const existing = await this.getWallet(userId);
    if (existing) return existing;

    const [wallet] = await db.insert(wallets).values({ userId }).returning();
    return wallet;
  }

  async getWallet(userId: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.userId, userId));
    return wallet;
  }

  async updateWalletBalance(userId: string, amount: string, type: 'add' | 'subtract'): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(userId);
    
    // Check for sufficient balance when subtracting
    if (type === 'subtract') {
      const currentBalance = parseFloat(wallet.balance);
      const amountToSubtract = parseFloat(amount);
      
      if (currentBalance < amountToSubtract) {
        throw new Error(`Insufficient balance. Available: ₦${currentBalance}, Required: ₦${amountToSubtract}`);
      }
    }
    
    // Use SQL arithmetic for safe decimal operations
    const [updated] = await db
      .update(wallets)
      .set({
        balance: type === 'add'
          ? sql`${wallets.balance} + ${amount}`
          : sql`${wallets.balance} - ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id))
      .returning();

    return updated;
  }

  // Transaction operations
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async getUserTransactions(walletId: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(desc(transactions.createdAt));
  }

  // Welcome bonus operations
  async createWelcomeBonus(userId: string, amount: string): Promise<WelcomeBonus> {
    const [bonus] = await db
      .insert(welcomeBonuses)
      .values({ userId, amount })
      .returning();

    // Add to wallet and create transaction
    const wallet = await this.getOrCreateWallet(userId);
    await this.updateWalletBalance(userId, amount, 'add');
    await this.createTransaction({
      walletId: wallet.id,
      type: 'welcome_bonus',
      amount,
      description: 'Welcome to EKSU Marketplace!',
      status: 'completed',
    });

    return bonus;
  }

  async getWelcomeBonus(userId: string): Promise<WelcomeBonus | undefined> {
    const [bonus] = await db
      .select()
      .from(welcomeBonuses)
      .where(eq(welcomeBonuses.userId, userId));
    return bonus;
  }

  // Referral operations
  async createReferral(referrerId: string, referredUserId: string): Promise<Referral> {
    // Prevent self-referrals
    if (referrerId === referredUserId) {
      throw new Error("Cannot refer yourself");
    }

    // Check for duplicate referrals
    const [existing] = await db
      .select()
      .from(referrals)
      .where(
        and(
          eq(referrals.referrerId, referrerId),
          eq(referrals.referredUserId, referredUserId)
        )
      );

    if (existing) {
      throw new Error("Referral already exists");
    }

    const [referral] = await db
      .insert(referrals)
      .values({ referrerId, referredUserId })
      .returning();
    return referral;
  }

  async getUserReferrals(userId: string): Promise<(Referral & { referredUser?: { firstName: string | null; lastName: string | null; email: string; profileImageUrl: string | null } })[]> {
    const results = await db
      .select({
        referral: referrals,
        referredUser: {
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        },
      })
      .from(referrals)
      .leftJoin(users, eq(referrals.referredUserId, users.id))
      .where(eq(referrals.referrerId, userId))
      .orderBy(desc(referrals.createdAt));
    
    return results.map(r => ({
      ...r.referral,
      referredUser: r.referredUser || undefined,
    }));
  }

  async markReferralPaid(referralId: string): Promise<Referral> {
    const [updated] = await db
      .update(referrals)
      .set({ bonusPaid: true })
      .where(eq(referrals.id, referralId))
      .returning();
    return updated;
  }

  // Saved search operations
  async createSavedSearch(search: InsertSavedSearch): Promise<SavedSearch> {
    const [saved] = await db.insert(savedSearches).values(search).returning();
    return saved;
  }

  async getUserSavedSearches(userId: string): Promise<SavedSearch[]> {
    return await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(desc(savedSearches.createdAt));
  }

  async deleteSavedSearch(id: string): Promise<void> {
    await db.delete(savedSearches).where(eq(savedSearches.id, id));
  }

  // Draft product operations
  async saveDraft(sellerId: string, data: any): Promise<DraftProduct> {
    const [draft] = await db
      .insert(draftProducts)
      .values({ sellerId, data })
      .returning();
    return draft;
  }

  async getUserDrafts(sellerId: string): Promise<DraftProduct[]> {
    return await db
      .select()
      .from(draftProducts)
      .where(eq(draftProducts.sellerId, sellerId))
      .orderBy(desc(draftProducts.updatedAt));
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(draftProducts).where(eq(draftProducts.id, id));
  }

  // Scheduled post operations
  async createScheduledPost(post: InsertScheduledPost): Promise<ScheduledPost> {
    const [created] = await db.insert(scheduledPosts).values(post).returning();
    return created;
  }

  async getUserScheduledPosts(sellerId: string): Promise<ScheduledPost[]> {
    return await db
      .select()
      .from(scheduledPosts)
      .where(and(eq(scheduledPosts.sellerId, sellerId), eq(scheduledPosts.published, false)))
      .orderBy(scheduledPosts.scheduledFor);
  }

  async getPendingScheduledPosts(): Promise<ScheduledPost[]> {
    const now = new Date();
    return await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.published, false),
          sql`${scheduledPosts.scheduledFor} <= ${now}`
        )
      );
  }

  async markScheduledPostPublished(id: string, productId: string): Promise<ScheduledPost> {
    const [updated] = await db
      .update(scheduledPosts)
      .set({ published: true, publishedProductId: productId })
      .where(eq(scheduledPosts.id, id))
      .returning();
    return updated;
  }

  // Voice post operations
  async createVoicePost(post: any): Promise<VoicePost> {
    const [created] = await db.insert(voicePosts).values(post).returning();
    return created;
  }

  async getUserVoicePosts(userId: string): Promise<VoicePost[]> {
    return await db
      .select()
      .from(voicePosts)
      .where(eq(voicePosts.userId, userId))
      .orderBy(desc(voicePosts.createdAt));
  }

  // Boost request operations
  async createBoostRequest(request: InsertBoostRequest): Promise<BoostRequest> {
    const [created] = await db.insert(boostRequests).values(request).returning();
    return created;
  }

  async getUserBoostRequests(sellerId: string): Promise<BoostRequest[]> {
    return await db
      .select()
      .from(boostRequests)
      .where(eq(boostRequests.sellerId, sellerId))
      .orderBy(desc(boostRequests.createdAt));
  }

  async getActiveBoosts(): Promise<BoostRequest[]> {
    const now = new Date();
    return await db
      .select()
      .from(boostRequests)
      .where(
        and(
          eq(boostRequests.status, 'active'),
          sql`${boostRequests.expiresAt} > ${now}`
        )
      );
  }

  async expireBoost(id: string): Promise<BoostRequest> {
    const [updated] = await db
      .update(boostRequests)
      .set({ status: 'expired' })
      .where(eq(boostRequests.id, id))
      .returning();
    return updated;
  }

  // Dispute operations
  async createDispute(dispute: InsertDispute): Promise<Dispute> {
    const [created] = await db.insert(disputes).values(dispute).returning();
    return created;
  }

  async getUserDisputes(userId: string): Promise<Dispute[]> {
    return await db
      .select()
      .from(disputes)
      .where(or(eq(disputes.buyerId, userId), eq(disputes.sellerId, userId)))
      .orderBy(desc(disputes.createdAt));
  }

  async getAllDisputes(): Promise<Dispute[]> {
    return await db.select().from(disputes).orderBy(desc(disputes.createdAt));
  }

  async resolveDispute(id: string, resolution: string, resolvedBy: string): Promise<Dispute> {
    const [updated] = await db
      .update(disputes)
      .set({
        status: 'resolved',
        resolution,
        resolvedBy,
        resolvedAt: new Date(),
      })
      .where(eq(disputes.id, id))
      .returning();
    return updated;
  }

  // Support ticket operations
  async createSupportTicket(ticket: InsertSupportTicket): Promise<SupportTicket> {
    const [created] = await db.insert(supportTickets).values(ticket).returning();
    return created;
  }

  async getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
    return await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.userId, userId))
      .orderBy(desc(supportTickets.createdAt));
  }

  async getAllSupportTickets(): Promise<SupportTicket[]> {
    return await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));
  }

  async updateSupportTicket(id: string, data: Partial<SupportTicket>): Promise<SupportTicket> {
    const [updated] = await db
      .update(supportTickets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  // Login streak operations
  async getOrCreateLoginStreak(userId: string): Promise<LoginStreak> {
    const [existing] = await db
      .select()
      .from(loginStreaks)
      .where(eq(loginStreaks.userId, userId));

    if (existing) return existing;

    const [created] = await db
      .insert(loginStreaks)
      .values({ userId })
      .returning();
    return created;
  }

  async updateLoginStreak(userId: string, ipAddress?: string): Promise<{ streak: LoginStreak; reward: number; securityWarning?: string }> {
    const streak = await this.getOrCreateLoginStreak(userId);
    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    today.setHours(0, 0, 0, 0);
    
    let securityWarning: string | undefined;
    
    // Generate daily claim hash for replay attack prevention
    const serverSecret = process.env.LOGIN_REWARD_SECRET || 'default-login-streak-secret-change-in-production';
    const dailyHash = crypto.createHash('sha256')
      .update(`${todayDateStr}:${userId}:${serverSecret}`)
      .digest('hex');
    
    // Check if this exact claim was already processed today (replay attack prevention)
    if (streak.dailyClaimHash === dailyHash) {
      return { streak, reward: 0 };
    }
    
    // Check for suspicious IP changes (potential account sharing or abuse)
    const previousIp = streak.lastIpAddress;
    if (previousIp && ipAddress && previousIp !== ipAddress) {
      // Different IP detected - flag for monitoring but allow claim
      const newSuspiciousCount = (streak.suspiciousActivityCount || 0) + 1;
      
      // If too many IP changes (more than 5), add warning
      if (newSuspiciousCount > 5) {
        securityWarning = 'Multiple IP address changes detected. Your account is being monitored for suspicious activity.';
        console.log(`Security alert: User ${userId} has ${newSuspiciousCount} IP changes. Previous: ${previousIp}, Current: ${ipAddress}`);
      }
    }
    
    const lastLogin = streak.lastLoginDate ? new Date(streak.lastLoginDate) : null;
    lastLogin?.setHours(0, 0, 0, 0);

    const daysDiff = lastLogin
      ? Math.floor((today.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24))
      : 1;

    let newStreak = streak.currentStreak;
    let reward = 0;

    if (daysDiff === 0) {
      // Already logged in today - update IP if changed but no reward
      if (ipAddress && ipAddress !== streak.lastIpAddress) {
        await db
          .update(loginStreaks)
          .set({
            lastIpAddress: ipAddress,
            lastClaimAttempt: new Date(),
            suspiciousActivityCount: (streak.suspiciousActivityCount || 0) + 1,
            updatedAt: new Date(),
          })
          .where(eq(loginStreaks.id, streak.id));
      }
      return { streak, reward: 0, securityWarning };
    } else if (daysDiff === 1) {
      // Consecutive day - increment streak
      newStreak = (streak.currentStreak || 0) + 1;
      reward = Math.floor(Math.random() * 48 + 2); // Random ₦2-₦50
    } else {
      // Streak broken - reset
      newStreak = 1;
      reward = Math.floor(Math.random() * 48 + 2); // Random ₦2-₦50
    }

    // Calculate new suspicious activity count
    const suspiciousIncrement = (previousIp && ipAddress && previousIp !== ipAddress) ? 1 : 0;

    const [updated] = await db
      .update(loginStreaks)
      .set({
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longestStreak || 0),
        lastLoginDate: new Date(),
        totalRewards: sql`${loginStreaks.totalRewards} + ${reward}`,
        // Security fields
        lastIpAddress: ipAddress || streak.lastIpAddress,
        dailyClaimHash: dailyHash,
        claimCount: sql`COALESCE(${loginStreaks.claimCount}, 0) + 1`,
        lastClaimAttempt: new Date(),
        suspiciousActivityCount: sql`COALESCE(${loginStreaks.suspiciousActivityCount}, 0) + ${suspiciousIncrement}`,
        updatedAt: new Date(),
      })
      .where(eq(loginStreaks.id, streak.id))
      .returning();

    // Add reward to wallet
    if (reward > 0) {
      const wallet = await this.getOrCreateWallet(userId);
      await this.updateWalletBalance(userId, reward.toString(), 'add');
      await this.createTransaction({
        walletId: wallet.id,
        type: 'login_reward',
        amount: reward.toString(),
        description: `${newStreak}-day login streak reward`,
        status: 'completed',
      });
    }

    return { streak: updated, reward, securityWarning };
  }

  // Seller analytics operations
  async getOrCreateSellerAnalytics(sellerId: string): Promise<SellerAnalytics> {
    const [existing] = await db
      .select()
      .from(sellerAnalytics)
      .where(eq(sellerAnalytics.sellerId, sellerId));

    if (existing) return existing;

    const [created] = await db
      .insert(sellerAnalytics)
      .values({ sellerId })
      .returning();
    return created;
  }

  async updateSellerAnalytics(sellerId: string, data: Partial<SellerAnalytics>): Promise<SellerAnalytics> {
    const analytics = await this.getOrCreateSellerAnalytics(sellerId);
    const [updated] = await db
      .update(sellerAnalytics)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sellerAnalytics.id, analytics.id))
      .returning();
    return updated;
  }

  // Follow operations
  async followUser(followerId: string, followingId: string): Promise<Follow> {
    // Prevent self-follow
    if (followerId === followingId) {
      throw new Error("Cannot follow yourself");
    }

    // Check if already following (idempotent)
    const existing = await db
      .select()
      .from(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      ));

    if (existing.length > 0) {
      return existing[0];
    }

    const [created] = await db
      .insert(follows)
      .values({ followerId, followingId })
      .returning();
    return created;
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    await db
      .delete(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      ));
  }

  async getFollowers(userId: string): Promise<(Follow & { follower: User })[]> {
    const result = await db
      .select()
      .from(follows)
      .leftJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .orderBy(desc(follows.createdAt));

    return result.map(r => ({ ...r.follows, follower: r.users! }));
  }

  async getFollowing(userId: string): Promise<(Follow & { following: User })[]> {
    const result = await db
      .select()
      .from(follows)
      .leftJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt));

    return result.map(r => ({ ...r.follows, following: r.users! }));
  }

  async getFollowerCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, userId));
    return result[0]?.count || 0;
  }

  async getFollowingCount(userId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, userId));
    return result[0]?.count || 0;
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(follows)
      .where(and(
        eq(follows.followerId, followerId),
        eq(follows.followingId, followingId)
      ));
    return result.length > 0;
  }

  // Hostel operations
  async createHostel(hostelData: InsertHostel & { agentId: string }): Promise<Hostel> {
    const [created] = await db.insert(hostels).values(hostelData).returning();
    return created;
  }

  async getHostel(id: string): Promise<(Hostel & { agent: User }) | undefined> {
    const result = await db
      .select()
      .from(hostels)
      .leftJoin(users, eq(hostels.agentId, users.id))
      .where(eq(hostels.id, id));
    
    if (!result[0]) return undefined;
    return { ...result[0].hostels, agent: result[0].users! };
  }

  async getHostels(filters?: { location?: string; minPrice?: number; maxPrice?: number }): Promise<Hostel[]> {
    const conditions = [eq(hostels.isAvailable, true)];
    
    if (filters?.location) {
      conditions.push(like(hostels.location, `%${filters.location}%`));
    }
    
    return await db
      .select()
      .from(hostels)
      .where(and(...conditions))
      .orderBy(desc(hostels.createdAt));
  }

  async getUserHostels(agentId: string): Promise<Hostel[]> {
    return await db.select().from(hostels).where(eq(hostels.agentId, agentId)).orderBy(desc(hostels.createdAt));
  }

  async updateHostel(id: string, data: Partial<Hostel>): Promise<Hostel> {
    const [updated] = await db
      .update(hostels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(hostels.id, id))
      .returning();
    return updated;
  }

  async deleteHostel(id: string): Promise<void> {
    await db.delete(hostels).where(eq(hostels.id, id));
  }

  async incrementHostelViews(id: string): Promise<void> {
    await db
      .update(hostels)
      .set({ views: sql`${hostels.views} + 1` })
      .where(eq(hostels.id, id));
  }

  // Event operations
  async createEvent(eventData: InsertEvent & { organizerId: string }): Promise<Event> {
    const [created] = await db.insert(events).values(eventData).returning();
    return created;
  }

  async getEvent(id: string): Promise<(Event & { organizer: User }) | undefined> {
    const result = await db
      .select()
      .from(events)
      .leftJoin(users, eq(events.organizerId, users.id))
      .where(eq(events.id, id));
    
    if (!result[0]) return undefined;
    return { ...result[0].events, organizer: result[0].users! };
  }

  async getEvents(filters?: { eventType?: string; upcoming?: boolean }): Promise<Event[]> {
    const conditions = [eq(events.isActive, true)];
    
    if (filters?.upcoming) {
      conditions.push(sql`${events.eventDate} >= NOW()`);
    }
    
    return await db
      .select()
      .from(events)
      .where(and(...conditions))
      .orderBy(events.eventDate);
  }

  async getUserEvents(organizerId: string): Promise<Event[]> {
    return await db.select().from(events).where(eq(events.organizerId, organizerId)).orderBy(desc(events.createdAt));
  }

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async incrementEventViews(id: string): Promise<void> {
    await db
      .update(events)
      .set({ views: sql`${events.views} + 1` })
      .where(eq(events.id, id));
  }

  async purchaseTicket(eventId: string, userId: string): Promise<Event> {
    const [updated] = await db
      .update(events)
      .set({ 
        ticketsSold: sql`${events.ticketsSold} + 1`,
        updatedAt: new Date()
      })
      .where(eq(events.id, eventId))
      .returning();
    return updated;
  }

  // Escrow operations
  async createEscrowTransaction(transactionData: InsertEscrowTransaction & { buyerId: string; sellerId: string }): Promise<EscrowTransaction> {
    const [created] = await db.insert(escrowTransactions).values(transactionData).returning();
    return created;
  }

  async getEscrowTransaction(id: string): Promise<EscrowTransaction | undefined> {
    const [transaction] = await db.select().from(escrowTransactions).where(eq(escrowTransactions.id, id));
    return transaction;
  }

  async getUserEscrowTransactions(userId: string): Promise<EscrowTransaction[]> {
    return await db
      .select()
      .from(escrowTransactions)
      .where(or(eq(escrowTransactions.buyerId, userId), eq(escrowTransactions.sellerId, userId)))
      .orderBy(desc(escrowTransactions.createdAt));
  }

  async confirmEscrowByBuyer(id: string): Promise<EscrowTransaction> {
    const [updated] = await db
      .update(escrowTransactions)
      .set({ buyerConfirmed: true, updatedAt: new Date() })
      .where(eq(escrowTransactions.id, id))
      .returning();
    return updated;
  }

  async confirmEscrowBySeller(id: string): Promise<EscrowTransaction> {
    const [updated] = await db
      .update(escrowTransactions)
      .set({ sellerConfirmed: true, updatedAt: new Date() })
      .where(eq(escrowTransactions.id, id))
      .returning();
    return updated;
  }

  async releaseEscrowFunds(id: string): Promise<EscrowTransaction> {
    const transaction = await this.getEscrowTransaction(id);
    if (!transaction) throw new Error("Escrow transaction not found");
    if (transaction.status !== 'held') throw new Error("Can only release funds from 'held' status");

    // Move funds from escrowBalance to balance for seller
    const sellerWallet = await this.getWallet(transaction.sellerId);
    if (!sellerWallet) throw new Error("Seller wallet not found");

    await db
      .update(wallets)
      .set({
        escrowBalance: sql`${wallets.escrowBalance} - ${transaction.amount}`,
        balance: sql`${wallets.balance} + ${transaction.amount}`,
        totalEarned: sql`${wallets.totalEarned} + ${transaction.amount}`,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, sellerWallet.id));
    
    // Create transaction record
    await this.createTransaction({
      walletId: sellerWallet.id,
      type: 'escrow_release',
      amount: transaction.amount,
      description: 'Escrow funds released',
      relatedUserId: transaction.buyerId,
      status: 'completed',
    });

    // Deduct platform fee
    const feeAmount = parseFloat(transaction.platformFee);
    if (feeAmount > 0) {
      await db
        .update(wallets)
        .set({
          balance: sql`${wallets.balance} - ${transaction.platformFee}`,
          updatedAt: new Date()
        })
        .where(eq(wallets.id, sellerWallet.id));

      await this.createTransaction({
        walletId: sellerWallet.id,
        type: 'platform_fee',
        amount: `-${transaction.platformFee}`,
        description: 'Platform fee deducted',
        status: 'completed',
      });
    }

    const [updated] = await db
      .update(escrowTransactions)
      .set({ 
        status: 'released',
        releasedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(escrowTransactions.id, id))
      .returning();
    
    return updated;
  }

  async refundEscrow(id: string): Promise<EscrowTransaction> {
    const transaction = await this.getEscrowTransaction(id);
    if (!transaction) throw new Error("Escrow transaction not found");
    if (transaction.status !== 'held') throw new Error("Can only refund funds from 'held' status");

    // Move funds from seller's escrowBalance to buyer's balance
    const sellerWallet = await this.getWallet(transaction.sellerId);
    const buyerWallet = await this.getWallet(transaction.buyerId);
    if (!sellerWallet) throw new Error("Seller wallet not found");
    if (!buyerWallet) throw new Error("Buyer wallet not found");

    // Deduct from seller's escrow balance
    await db
      .update(wallets)
      .set({
        escrowBalance: sql`${wallets.escrowBalance} - ${transaction.amount}`,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, sellerWallet.id));

    // Add to buyer's balance
    await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${transaction.amount}`,
        updatedAt: new Date()
      })
      .where(eq(wallets.id, buyerWallet.id));
    
    // Create transaction records
    await this.createTransaction({
      walletId: buyerWallet.id,
      type: 'refund',
      amount: transaction.amount,
      description: 'Escrow refunded',
      relatedUserId: transaction.sellerId,
      status: 'completed',
    });

    const [updated] = await db
      .update(escrowTransactions)
      .set({ 
        status: 'refunded',
        updatedAt: new Date()
      })
      .where(eq(escrowTransactions.id, id))
      .returning();
    
    return updated;
  }

  // Paystack payment operations
  async createPaystackPayment(paymentData: InsertPaystackPayment & { userId: string }): Promise<PaystackPayment> {
    const [created] = await db.insert(paystackPayments).values(paymentData).returning();
    return created;
  }

  async updatePaystackPayment(reference: string, data: Partial<PaystackPayment>): Promise<PaystackPayment> {
    const [updated] = await db
      .update(paystackPayments)
      .set(data)
      .where(eq(paystackPayments.reference, reference))
      .returning();
    return updated;
  }

  async getPaystackPayment(reference: string): Promise<PaystackPayment | undefined> {
    const [payment] = await db.select().from(paystackPayments).where(eq(paystackPayments.reference, reference));
    return payment;
  }

  async getUserPaystackPayments(userId: string): Promise<PaystackPayment[]> {
    return await db
      .select()
      .from(paystackPayments)
      .where(eq(paystackPayments.userId, userId))
      .orderBy(desc(paystackPayments.createdAt));
  }

  // Withdrawal operations
  async createWithdrawal(withdrawalData: InsertWithdrawal & { userId: string }): Promise<Withdrawal> {
    const [created] = await db.insert(withdrawals).values(withdrawalData).returning();
    return created;
  }

  async getUserWithdrawals(userId: string): Promise<Withdrawal[]> {
    return await db
      .select()
      .from(withdrawals)
      .where(eq(withdrawals.userId, userId))
      .orderBy(desc(withdrawals.createdAt));
  }

  async updateWithdrawal(id: string, data: Partial<Withdrawal>): Promise<Withdrawal> {
    const [updated] = await db
      .update(withdrawals)
      .set(data)
      .where(eq(withdrawals.id, id))
      .returning();
    return updated;
  }

  // NIN verification operations
  async updateNINVerification(userId: string, ninHash: string, vnin: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        ninHash,
        ninVnin: vnin,
        ninVerified: true,
        ninVerificationDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Social media update operations
  async updateSocialMedia(userId: string, data: { instagramHandle?: string; tiktokHandle?: string; facebookProfile?: string }): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        ...data,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Trust badge operations
  async awardTrustBadge(userId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        isTrustedSeller: true,
        trustedSellerSince: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async revokeTrustBadge(userId: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ 
        isTrustedSeller: false,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  // Referral update operations
  async markReferralPurchase(referredUserId: string, purchaseId: string): Promise<void> {
    // Find referral where this user was referred
    const [referral] = await db
      .select()
      .from(referrals)
      .where(and(
        eq(referrals.referredUserId, referredUserId),
        eq(referrals.bonusPaid, false),
        eq(referrals.referredUserMadePurchase, false)
      ));

    if (!referral) return;

    // Generate random bonus amount ₦2-50
    const bonusAmount = (Math.random() * 48 + 2).toFixed(2);

    // Update referral
    await db
      .update(referrals)
      .set({
        referredUserMadePurchase: true,
        firstPurchaseId: purchaseId,
        bonusAmount,
        bonusPaid: true,
        bonusPaidAt: new Date(),
      })
      .where(eq(referrals.id, referral.id));

    // Pay bonus to referrer
    const referrerWallet = await this.getOrCreateWallet(referral.referrerId);
    await this.updateWalletBalance(referral.referrerId, bonusAmount, 'add');
    await this.createTransaction({
      walletId: referrerWallet.id,
      type: 'referral_bonus',
      amount: bonusAmount,
      description: `Referral bonus for ${referredUserId}'s first purchase`,
      status: 'completed',
    });
  }

  // Leaderboard operations
  async getTopSellers(limit: number = 10): Promise<any[]> {
    return await db
      .select({
        user: users,
        productCount: sql<number>`COUNT(${products.id})`,
      })
      .from(users)
      .leftJoin(products, eq(users.id, products.sellerId))
      .where(eq(users.isActive, true))
      .groupBy(users.id)
      .orderBy(sql`COUNT(${products.id}) DESC`)
      .limit(limit);
  }

  async getMostTrustedUsers(limit: number = 10): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(and(eq(users.isTrustedSeller, true), eq(users.isActive, true)))
      .orderBy(desc(users.trustedSellerSince))
      .limit(limit);
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    try {
      const { notifications } = await import("@shared/schema");
      return await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(desc(notifications.createdAt));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    try {
      const { notifications } = await import("@shared/schema");
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    try {
      const { notifications } = await import("@shared/schema");
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.userId, userId));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }

  async deleteNotification(id: string, userId: string): Promise<void> {
    try {
      const { notifications } = await import("@shared/schema");
      await db
        .delete(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  }

  async createNotification(data: { userId: string; type: string; title: string; message: string; link?: string; relatedUserId?: string; relatedProductId?: string }): Promise<any> {
    try {
      const { notifications } = await import("@shared/schema");
      const [notification] = await db
        .insert(notifications)
        .values({
          userId: data.userId,
          type: data.type as any,
          title: data.title,
          message: data.message,
          link: data.link,
          relatedUserId: data.relatedUserId,
          relatedProductId: data.relatedProductId,
        })
        .returning();
      return notification;
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  }

  // Raw SQL execution for admin metrics
  async executeRawSQL<T = any>(query: string, params?: any[]): Promise<T[]> {
    const { pool } = await import("./db");
    const result = await pool.query(query, params);
    return result.rows as T[];
  }

  // Cart operations
  async getCartItems(userId: string): Promise<(CartItem & { product: Product })[]> {
    const results = await db
      .select()
      .from(cartItems)
      .leftJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.userId, userId))
      .orderBy(desc(cartItems.createdAt));

    return results
      .filter(r => r.cart_items && r.products)
      .map(r => ({
        ...r.cart_items!,
        product: r.products!,
      }));
  }

  async addToCart(userId: string, productId: string, quantity: number = 1): Promise<CartItem> {
    const existing = await db
      .select()
      .from(cartItems)
      .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)));

    if (existing.length > 0) {
      const newQuantity = existing[0].quantity + quantity;
      const [updated] = await db
        .update(cartItems)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(cartItems.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(cartItems)
      .values({ userId, productId, quantity })
      .returning();
    return created;
  }

  async updateCartItemQuantity(cartItemId: string, quantity: number): Promise<CartItem> {
    const [updated] = await db
      .update(cartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItems.id, cartItemId))
      .returning();

    if (!updated) {
      throw new Error(`Cart item ${cartItemId} not found`);
    }

    return updated;
  }

  async removeFromCart(cartItemId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.id, cartItemId));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(cartItems).where(eq(cartItems.userId, userId));
  }

  // Game operations
  async createGame(game: { gameType: string; player1Id: string; stakeAmount: string; mode?: string }): Promise<Game> {
    const [created] = await db.insert(games).values({
      gameType: game.gameType as any,
      player1Id: game.player1Id,
      stakeAmount: game.stakeAmount,
      status: "waiting",
      gameData: game.mode ? { mode: game.mode } : null,
    }).returning();
    return created;
  }

  async getGame(id: string): Promise<(Game & { player1: User; player2: User | null }) | undefined> {
    const result = await db
      .select()
      .from(games)
      .leftJoin(users, eq(games.player1Id, users.id))
      .where(eq(games.id, id));

    if (result.length === 0 || !result[0].games || !result[0].users) return undefined;

    const game = result[0].games;
    const player1 = result[0].users;

    let player2: User | null = null;
    if (game.player2Id) {
      const [p2] = await db.select().from(users).where(eq(users.id, game.player2Id));
      player2 = p2 || null;
    }

    return {
      ...game,
      player1,
      player2,
    };
  }

  async getAvailableGames(gameType?: string): Promise<(Game & { player1: User })[]> {
    let query = db
      .select()
      .from(games)
      .leftJoin(users, eq(games.player1Id, users.id))
      .where(eq(games.status, "waiting"))
      .orderBy(desc(games.createdAt));

    const results = await query;

    let filtered = results
      .filter(r => r.games && r.users)
      .map(r => ({
        ...r.games!,
        player1: r.users!,
      }));

    if (gameType) {
      filtered = filtered.filter(g => g.gameType === gameType);
    }

    return filtered;
  }

  async getUserGames(userId: string): Promise<Game[]> {
    return await db
      .select()
      .from(games)
      .where(or(eq(games.player1Id, userId), eq(games.player2Id, userId)))
      .orderBy(desc(games.createdAt));
  }

  async joinGame(gameId: string, player2Id: string): Promise<Game> {
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId));

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "waiting") {
      throw new Error("Game is not available to join");
    }

    if (game.player1Id === player2Id) {
      throw new Error("Cannot join your own game");
    }

    const [updated] = await db
      .update(games)
      .set({
        player2Id,
        status: "in_progress",
        startedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    return updated;
  }

  async startGame(gameId: string): Promise<Game> {
    const [updated] = await db
      .update(games)
      .set({
        status: "in_progress",
        startedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    if (!updated) {
      throw new Error("Game not found");
    }

    return updated;
  }

  async completeGame(gameId: string, winnerId: string): Promise<Game> {
    const [updated] = await db
      .update(games)
      .set({
        status: "completed",
        winnerId,
        completedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    if (!updated) {
      throw new Error("Game not found");
    }

    return updated;
  }

  async cancelGame(gameId: string): Promise<Game> {
    const [updated] = await db
      .update(games)
      .set({
        status: "cancelled",
        completedAt: new Date(),
      })
      .where(eq(games.id, gameId))
      .returning();

    if (!updated) {
      throw new Error("Game not found");
    }

    return updated;
  }

  async createGameMatch(match: InsertGameMatch): Promise<GameMatch> {
    const [created] = await db.insert(gameMatches).values(match).returning();
    return created;
  }

  async getGameMatches(gameId: string): Promise<GameMatch[]> {
    return await db
      .select()
      .from(gameMatches)
      .where(eq(gameMatches.gameId, gameId))
      .orderBy(gameMatches.roundNumber);
  }

  // Game score/leaderboard operations
  async getOrCreateGameScore(userId: string, gameType: string): Promise<GameScore> {
    const [existing] = await db
      .select()
      .from(gameScores)
      .where(and(eq(gameScores.userId, userId), eq(gameScores.gameType, gameType as any)));
    
    if (existing) return existing;
    
    const [created] = await db
      .insert(gameScores)
      .values({
        userId,
        gameType: gameType as any,
        totalScore: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        highScore: 0,
        totalEarnings: "0.00",
      })
      .returning();
    return created;
  }

  async updateGameScore(userId: string, gameType: string, won: boolean, score: number, earnings?: string): Promise<GameScore> {
    const existing = await this.getOrCreateGameScore(userId, gameType);
    
    const newTotalScore = existing.totalScore + score;
    const newGamesPlayed = existing.gamesPlayed + 1;
    const newGamesWon = won ? existing.gamesWon + 1 : existing.gamesWon;
    const newHighScore = score > (existing.highScore || 0) ? score : existing.highScore;
    const newEarnings = earnings 
      ? (parseFloat(existing.totalEarnings || "0") + parseFloat(earnings)).toFixed(2)
      : existing.totalEarnings;
    
    const [updated] = await db
      .update(gameScores)
      .set({
        totalScore: newTotalScore,
        gamesPlayed: newGamesPlayed,
        gamesWon: newGamesWon,
        highScore: newHighScore,
        totalEarnings: newEarnings,
        updatedAt: new Date(),
      })
      .where(eq(gameScores.id, existing.id))
      .returning();
    return updated;
  }

  async getLeaderboard(gameType: string, limit: number = 10): Promise<(GameScore & { user: User })[]> {
    const results = await db
      .select()
      .from(gameScores)
      .leftJoin(users, eq(gameScores.userId, users.id))
      .where(eq(gameScores.gameType, gameType as any))
      .orderBy(desc(gameScores.totalScore))
      .limit(limit);
    
    return results
      .filter(r => r.game_scores && r.users)
      .map(r => ({
        ...r.game_scores!,
        user: r.users!,
      }));
  }

  async getGlobalLeaderboard(limit: number = 10): Promise<any[]> {
    const results = await db
      .select({
        userId: gameScores.userId,
        totalScore: sql<number>`SUM(${gameScores.totalScore})`.as('total'),
        gamesPlayed: sql<number>`SUM(${gameScores.gamesPlayed})`.as('games'),
        gamesWon: sql<number>`SUM(${gameScores.gamesWon})`.as('wins'),
      })
      .from(gameScores)
      .groupBy(gameScores.userId)
      .orderBy(desc(sql`SUM(${gameScores.totalScore})`))
      .limit(limit);
    
    const userIds = results.map(r => r.userId);
    const userResults = await db.select().from(users).where(sql`${users.id} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)})`);
    const userMap = new Map(userResults.map(u => [u.id, u]));
    
    return results.map(r => ({
      ...r,
      user: userMap.get(r.userId),
      winRate: r.gamesPlayed > 0 ? Math.round((r.gamesWon / r.gamesPlayed) * 100) : 0,
    }));
  }

  // Game content operations
  async getTriviaQuestions(limit: number = 10, category?: string): Promise<TriviaQuestion[]> {
    let query = db.select().from(triviaQuestions);
    if (category) {
      query = query.where(eq(triviaQuestions.category, category)) as any;
    }
    return await query.limit(limit);
  }

  async getRandomTriviaQuestion(): Promise<TriviaQuestion | undefined> {
    const [question] = await db
      .select()
      .from(triviaQuestions)
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return question;
  }

  async getTypingTexts(limit: number = 10): Promise<TypingText[]> {
    return await db.select().from(typingTexts).limit(limit);
  }

  async getRandomTypingText(): Promise<TypingText | undefined> {
    const [text] = await db
      .select()
      .from(typingTexts)
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return text;
  }

  async getPriceGuessProducts(limit: number = 10): Promise<PriceGuessProduct[]> {
    return await db.select().from(priceGuessProducts).limit(limit);
  }

  async getRandomPriceGuessProduct(): Promise<PriceGuessProduct | undefined> {
    const [product] = await db
      .select()
      .from(priceGuessProducts)
      .orderBy(sql`RANDOM()`)
      .limit(1);
    return product;
  }

  async seedGameContent(): Promise<void> {
    // Seed trivia questions
    const existingTrivia = await db.select().from(triviaQuestions).limit(1);
    if (existingTrivia.length === 0) {
      await db.insert(triviaQuestions).values([
        { question: "What is the capital of Nigeria?", options: ["Lagos", "Abuja", "Kano", "Port Harcourt"], correctAnswer: 1, category: "Geography", difficulty: "easy" },
        { question: "Which Nigerian artist released the song 'Essence'?", options: ["Davido", "Wizkid", "Burna Boy", "Olamide"], correctAnswer: 1, category: "Music", difficulty: "easy" },
        { question: "What year did Nigeria gain independence?", options: ["1958", "1960", "1963", "1970"], correctAnswer: 1, category: "History", difficulty: "easy" },
        { question: "What is the largest city in Nigeria by population?", options: ["Abuja", "Kano", "Lagos", "Ibadan"], correctAnswer: 2, category: "Geography", difficulty: "easy" },
        { question: "Which Nigerian footballer won the African Player of the Year in 2013?", options: ["Jay-Jay Okocha", "Yobo", "Yaya Toure", "John Obi Mikel"], correctAnswer: 2, category: "Sports", difficulty: "medium" },
        { question: "What is the official currency of Nigeria?", options: ["Dollar", "Naira", "Cedi", "Rand"], correctAnswer: 1, category: "General", difficulty: "easy" },
        { question: "Which river is the longest in Nigeria?", options: ["Niger", "Benue", "Ogun", "Cross"], correctAnswer: 0, category: "Geography", difficulty: "medium" },
        { question: "Who was the first President of Nigeria?", options: ["Nnamdi Azikiwe", "Tafawa Balewa", "Aguiyi Ironsi", "Yakubu Gowon"], correctAnswer: 0, category: "History", difficulty: "medium" },
        { question: "What is the traditional dress of the Yoruba people called?", options: ["Agbada", "Kaftan", "Buba", "Dashiki"], correctAnswer: 0, category: "Culture", difficulty: "easy" },
        { question: "Which Nigerian state is known as the 'Centre of Excellence'?", options: ["Abuja", "Lagos", "Rivers", "Kano"], correctAnswer: 1, category: "Geography", difficulty: "easy" },
        { question: "What is Jollof rice?", options: ["A dessert", "A spicy rice dish", "A soup", "A drink"], correctAnswer: 1, category: "Food", difficulty: "easy" },
        { question: "Which Nigerian author wrote 'Things Fall Apart'?", options: ["Wole Soyinka", "Chinua Achebe", "Chimamanda Adichie", "Ben Okri"], correctAnswer: 1, category: "Literature", difficulty: "easy" },
      ]);
    }

    // Seed typing texts
    const existingTexts = await db.select().from(typingTexts).limit(1);
    if (existingTexts.length === 0) {
      await db.insert(typingTexts).values([
        { text: "The quick brown fox jumps over the lazy dog.", wordCount: 9, difficulty: "easy" },
        { text: "Pack my box with five dozen liquor jugs.", wordCount: 8, difficulty: "easy" },
        { text: "How vexingly quick daft zebras jump!", wordCount: 6, difficulty: "medium" },
        { text: "The five boxing wizards jump quickly.", wordCount: 6, difficulty: "medium" },
        { text: "Sphinx of black quartz, judge my vow.", wordCount: 7, difficulty: "medium" },
        { text: "Two driven jocks help fax my big quiz.", wordCount: 8, difficulty: "medium" },
        { text: "The early morning sun cast long shadows across the campus as students hurried to their classes.", wordCount: 16, difficulty: "hard" },
        { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", wordCount: 16, difficulty: "hard" },
        { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", wordCount: 17, difficulty: "hard" },
        { text: "The greatest glory in living lies not in never falling, but in rising every time we fall.", wordCount: 17, difficulty: "hard" },
      ]);
    }

    // Seed price guess products
    const existingProducts = await db.select().from(priceGuessProducts).limit(1);
    if (existingProducts.length === 0) {
      await db.insert(priceGuessProducts).values([
        { name: "iPhone 15 Pro Max", actualPrice: "1850000.00", category: "Electronics", difficulty: "medium" },
        { name: "Samsung Galaxy S24 Ultra", actualPrice: "1650000.00", category: "Electronics", difficulty: "medium" },
        { name: "Nike Air Jordan 1", actualPrice: "85000.00", category: "Fashion", difficulty: "easy" },
        { name: "MacBook Pro 14-inch", actualPrice: "2400000.00", category: "Electronics", difficulty: "hard" },
        { name: "PlayStation 5", actualPrice: "550000.00", category: "Electronics", difficulty: "easy" },
        { name: "Ray-Ban Aviator Sunglasses", actualPrice: "45000.00", category: "Fashion", difficulty: "easy" },
        { name: "Louis Vuitton Neverfull Bag", actualPrice: "2100000.00", category: "Fashion", difficulty: "hard" },
        { name: "Apple AirPods Pro", actualPrice: "175000.00", category: "Electronics", difficulty: "easy" },
        { name: "Rolex Submariner", actualPrice: "12500000.00", category: "Fashion", difficulty: "hard" },
        { name: "Nike Air Force 1", actualPrice: "55000.00", category: "Fashion", difficulty: "easy" },
      ]);
    }
  }

  async processPaystackSuccess(reference: string, amount: string): Promise<void> {
    const [payment] = await db
      .select()
      .from(paystackPayments)
      .where(eq(paystackPayments.reference, reference));
    
    if (!payment) {
      throw new Error("Payment not found");
    }

    await db
      .update(paystackPayments)
      .set({ status: "success", paidAt: new Date() })
      .where(eq(paystackPayments.reference, reference));

    await this.updateWalletBalance(payment.userId, amount, "add");

    await this.createTransaction({
      walletId: (await this.getWallet(payment.userId))!.id,
      amount,
      type: "deposit",
      status: "completed",
      description: `Paystack deposit - ${reference}`,
    });
  }

  // Password reset token operations
  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId));

    const [created] = await db
      .insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return created;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date())
        )
      );
    return resetToken;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(
        or(
          eq(passwordResetTokens.used, true),
          sql`${passwordResetTokens.expiresAt} < NOW()`
        )
      );
  }

  async updateUserPassword(userId: string, hashedPassword: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    
    return user;
  }

  // Announcement operations
  async createAnnouncement(data: CreateAnnouncementInput & { authorId: string }): Promise<Announcement> {
    const [announcement] = await db
      .insert(announcements)
      .values({
        authorId: data.authorId,
        title: data.title,
        content: data.content,
        category: data.category,
        priority: data.priority || "normal",
        isPinned: data.isPinned || false,
        isPublished: data.isPublished !== false,
      })
      .returning();
    return announcement;
  }

  async getAnnouncement(id: string): Promise<(Announcement & { author: User }) | undefined> {
    const [result] = await db
      .select()
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id))
      .where(eq(announcements.id, id));
    
    if (!result) return undefined;
    
    return {
      ...result.announcements,
      author: result.users,
    };
  }

  async getAnnouncements(includeUnpublished: boolean = false): Promise<(Announcement & { author: User })[]> {
    let query = db
      .select()
      .from(announcements)
      .innerJoin(users, eq(announcements.authorId, users.id));
    
    const conditions = includeUnpublished 
      ? [] 
      : [eq(announcements.isPublished, true)];
    
    const results = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
      : await query.orderBy(desc(announcements.isPinned), desc(announcements.createdAt));
    
    return results.map(r => ({
      ...r.announcements,
      author: r.users,
    }));
  }

  async updateAnnouncement(id: string, data: UpdateAnnouncementInput): Promise<Announcement> {
    const [announcement] = await db
      .update(announcements)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, id))
      .returning();
    
    if (!announcement) {
      throw new Error("Announcement not found");
    }
    
    return announcement;
  }

  async deleteAnnouncement(id: string): Promise<void> {
    await db.delete(announcements).where(eq(announcements.id, id));
  }

  async incrementAnnouncementViews(id: string): Promise<void> {
    await db
      .update(announcements)
      .set({ views: sql`COALESCE(${announcements.views}, 0) + 1` })
      .where(eq(announcements.id, id));
  }

  async markAnnouncementAsRead(userId: string, announcementId: string): Promise<AnnouncementRead> {
    const existing = await db
      .select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, userId),
          eq(announcementReads.announcementId, announcementId)
        )
      );
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [read] = await db
      .insert(announcementReads)
      .values({ userId, announcementId })
      .returning();
    
    return read;
  }

  async getUserAnnouncementReads(userId: string): Promise<AnnouncementRead[]> {
    return await db
      .select()
      .from(announcementReads)
      .where(eq(announcementReads.userId, userId));
  }

  async isAnnouncementRead(userId: string, announcementId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(announcementReads)
      .where(
        and(
          eq(announcementReads.userId, userId),
          eq(announcementReads.announcementId, announcementId)
        )
      );
    return !!result;
  }
}

export const storage = new DatabaseStorage();
