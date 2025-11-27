// Database storage implementation
import crypto from "crypto";
import {
  users,
  products,
  productViews,
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
  socialPosts,
  socialPostLikes,
  socialPostComments,
  socialPostReposts,
  blockedUsers,
  postBookmarks,
  feedEngagementScores,
  squadPayments,
  squadTransfers,
  negotiations,
  orders,
  orderStatusHistory,
  userBlocks,
  userMutes,
  userReports,
  vtuPlans,
  vtuTransactions,
  vtuBeneficiaries,
  userSettings,
  sponsoredAds,
  platformSettings,
  kycVerifications,
  kycVerificationLogs,
  scheduledVtuPurchases,
  giftData,
  billPayments,
  stories,
  storyViews,
  storyReactions,
  storyReplies,
  type User,
  type UpsertUser,
  type Product,
  type ProductView,
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
  type SocialPost,
  type InsertSocialPost,
  type SocialPostLike,
  type SocialPostComment,
  type InsertSocialPostComment,
  type SocialPostRepost,
  type BlockedUser,
  type InsertBlockedUser,
  type PostBookmark,
  type InsertPostBookmark,
  type FeedEngagementScore,
  type SquadPayment,
  type InsertSquadPayment,
  type SquadTransfer,
  type InsertSquadTransfer,
  type Negotiation,
  type InsertNegotiation,
  type Order,
  type InsertOrder,
  type OrderStatusHistory,
  type InsertOrderStatusHistory,
  type UserBlock,
  type InsertUserBlock,
  type UserMute,
  type InsertUserMute,
  type UserReport,
  type InsertUserReport,
  type VtuPlan,
  type InsertVtuPlan,
  type VtuTransaction,
  type InsertVtuTransaction,
  type VtuBeneficiary,
  type InsertVtuBeneficiary,
  type UserSettings,
  type InsertUserSettings,
  type SponsoredAd,
  type InsertSponsoredAd,
  type PlatformSetting,
  type KycVerification,
  type InsertKycVerification,
  type KycVerificationLog,
  type ScheduledVtuPurchase,
  type InsertScheduledVtuPurchase,
  type GiftData,
  type InsertGiftData,
  type BillPayment,
  type InsertBillPayment,
  type Story,
  type InsertStory,
  type StoryView,
  type StoryReaction,
  type StoryReply,
  confessions,
  confessionVotes,
  confessionComments,
  confessionReports,
  type Confession,
  type InsertConfession,
  type ConfessionVote,
  type ConfessionComment,
  communities,
  communityMembers,
  communityPosts,
  communityPostComments,
  communityPostLikes,
  type Community,
  type CommunityMember,
  type CommunityPost,
  type CommunityPostComment,
  type CommunityPostLike,
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
  
  // Unique product view tracking
  hasViewedProduct(productId: string, viewerId: string): Promise<boolean>;
  recordProductView(productId: string, viewerId: string): Promise<void>;
  recordUniqueProductView(productId: string, viewerId: string): Promise<boolean>;
  
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
  getWishlistWithProducts(userId: string): Promise<(Watchlist & { product: Product & { seller: User } })[]>;
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
  getEscrowTransactionWithDetails(id: string): Promise<(EscrowTransaction & { product?: Product; buyer: User; seller: User }) | undefined>;
  getUserEscrowTransactions(userId: string): Promise<EscrowTransaction[]>;
  getUserPurchases(buyerId: string): Promise<(EscrowTransaction & { product?: Product; seller: User })[]>;
  getUserSales(sellerId: string): Promise<(EscrowTransaction & { product?: Product; buyer: User })[]>;
  confirmEscrowByBuyer(id: string): Promise<EscrowTransaction>;
  confirmEscrowBySeller(id: string): Promise<EscrowTransaction>;
  releaseEscrowFunds(id: string): Promise<EscrowTransaction>;
  refundEscrow(id: string): Promise<EscrowTransaction>;
  addToEscrowBalance(sellerId: string, amount: string): Promise<Wallet>;
  getSellerCompletedSalesCount(sellerId: string): Promise<number>;
  lockSecurityDeposit(userId: string, amount: string): Promise<Wallet>;
  
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
  
  // Social post operations ("The Plug")
  getSocialPosts(options?: { authorId?: string; followingOnly?: boolean; userId?: string }): Promise<(SocialPost & { author: User; isLiked?: boolean; isFollowingAuthor?: boolean; isReposted?: boolean })[]>;
  getSocialPostById(postId: string): Promise<SocialPost | undefined>;
  createSocialPost(post: { authorId: string; content: string; images?: string[]; videos?: string[] }): Promise<SocialPost>;
  getSocialPost(id: string): Promise<(SocialPost & { author: User }) | undefined>;
  likeSocialPost(postId: string, userId: string): Promise<SocialPostLike>;
  unlikeSocialPost(postId: string, userId: string): Promise<void>;
  isPostLiked(postId: string, userId: string): Promise<boolean>;
  getPostComments(postId: string): Promise<(SocialPostComment & { author: User })[]>;
  createPostComment(comment: { postId: string; authorId: string; content: string }): Promise<SocialPostComment>;
  deleteSocialPost(postId: string): Promise<void>;
  repostSocialPost(postId: string, userId: string, quoteContent?: string): Promise<SocialPostRepost>;
  unrepostSocialPost(postId: string, userId: string): Promise<void>;
  isPostReposted(postId: string, userId: string): Promise<boolean>;
  getPostReposts(postId: string): Promise<(SocialPostRepost & { reposter: User })[]>;
  
  // Post bookmark operations
  bookmarkPost(userId: string, postId: string): Promise<PostBookmark>;
  unbookmarkPost(userId: string, postId: string): Promise<void>;
  isPostBookmarked(userId: string, postId: string): Promise<boolean>;
  getUserBookmarks(userId: string): Promise<(PostBookmark & { post: SocialPost; author: User })[]>;
  
  // Smart feed algorithm operations  
  getSocialPostsWithAlgorithm(options?: { userId?: string; feedType?: 'for_you' | 'following' }): Promise<(SocialPost & { author: User; isLiked?: boolean; isFollowingAuthor?: boolean; isReposted?: boolean; engagementScore?: string })[]>;
  updatePostEngagementScore(postId: string): Promise<void>;
  incrementPostViews(postId: string): Promise<void>;
  incrementPostShares(postId: string): Promise<void>;
  
  // Username and system account operations
  getUserByUsername(username: string): Promise<User | undefined>;
  updateUsername(userId: string, username: string): Promise<User>;
  getSystemAccount(type: string): Promise<User | undefined>;
  createSystemAccount(data: { email: string; username: string; firstName: string; lastName: string; type: string; bio?: string; profileImageUrl?: string }): Promise<User>;
  
  // Enhanced social post operations
  createSocialPostWithOptions(post: { authorId: string; content: string; images?: string[]; videos?: string[]; replyRestriction?: string; mentionedUserIds?: string[]; hashtags?: string[]; isFromSystemAccount?: boolean }): Promise<SocialPost>;
  updateSocialPost(postId: string, data: Partial<SocialPost>): Promise<SocialPost>;
  pinPost(postId: string): Promise<void>;
  unpinPost(postId: string): Promise<void>;
  getUserPinnedPosts(userId: string): Promise<(SocialPost & { author: User })[]>;
  
  // Squad payment operations
  createSquadPayment(payment: InsertSquadPayment): Promise<SquadPayment>;
  getSquadPayment(id: string): Promise<SquadPayment | undefined>;
  getSquadPaymentByReference(transactionReference: string): Promise<SquadPayment | undefined>;
  updateSquadPaymentStatus(transactionReference: string, status: string, paidAt?: Date): Promise<SquadPayment | undefined>;
  getUserSquadPayments(userId: string): Promise<SquadPayment[]>;
  
  // Squad transfer operations
  createSquadTransfer(transfer: InsertSquadTransfer): Promise<SquadTransfer>;
  getSquadTransferByReference(transactionReference: string): Promise<SquadTransfer | undefined>;
  updateSquadTransferStatus(transactionReference: string, status: string, responseMessage?: string, completedAt?: Date): Promise<SquadTransfer | undefined>;
  
  // Negotiation operations
  createNegotiation(negotiation: InsertNegotiation): Promise<Negotiation>;
  getNegotiation(id: string): Promise<Negotiation | undefined>;
  getProductNegotiations(productId: string): Promise<Negotiation[]>;
  getUserNegotiations(userId: string): Promise<Negotiation[]>;
  updateNegotiationStatus(id: string, status: string, data?: Partial<Negotiation>): Promise<Negotiation | undefined>;
  
  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrderByNumber(orderNumber: string): Promise<Order | undefined>;
  getBuyerOrders(buyerId: string): Promise<Order[]>;
  getSellerOrders(sellerId: string): Promise<Order[]>;
  updateOrderStatus(orderId: string, status: string, changedBy: string, notes?: string): Promise<Order>;
  addOrderStatusHistory(history: InsertOrderStatusHistory): Promise<OrderStatusHistory>;
  getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]>;
  
  // User relationship operations (block/mute/report)
  blockUser(blockerId: string, blockedId: string): Promise<UserBlock>;
  unblockUser(blockerId: string, blockedId: string): Promise<void>;
  muteUser(muterId: string, mutedId: string): Promise<UserMute>;
  unmuteUser(muterId: string, mutedId: string): Promise<void>;
  isUserBlocked(userId: string, targetId: string): Promise<boolean>;
  isUserMuted(userId: string, targetId: string): Promise<boolean>;
  getBlockedUsers(userId: string): Promise<(UserBlock & { blockedUser: User })[]>;
  getMutedUsers(userId: string): Promise<(UserMute & { mutedUser: User })[]>;
  createUserReport(data: InsertUserReport): Promise<UserReport>;
  reportUser(reporterId: string, reportedId: string, reason: string, description: string): Promise<UserReport>;
  getUserRelationship(userId: string, targetId: string): Promise<{ isBlocked: boolean; isMuted: boolean; isBlockedByTarget: boolean }>;
  
  // VTU (Virtual Top-Up) operations
  getVtuPlans(network?: string): Promise<VtuPlan[]>;
  getVtuPlan(id: string): Promise<VtuPlan | undefined>;
  createVtuTransaction(data: InsertVtuTransaction): Promise<VtuTransaction>;
  updateVtuTransaction(id: string, data: Partial<VtuTransaction>): Promise<VtuTransaction>;
  getUserVtuTransactions(userId: string, filters?: { status?: string; network?: string; startDate?: Date; endDate?: Date }): Promise<VtuTransaction[]>;
  
  // VTU Beneficiaries operations
  getUserBeneficiaries(userId: string): Promise<VtuBeneficiary[]>;
  getBeneficiary(id: string): Promise<VtuBeneficiary | undefined>;
  createBeneficiary(data: InsertVtuBeneficiary): Promise<VtuBeneficiary>;
  updateBeneficiary(id: string, data: Partial<VtuBeneficiary>): Promise<VtuBeneficiary>;
  deleteBeneficiary(id: string): Promise<void>;
  updateBeneficiaryUsage(id: string): Promise<void>;
  
  // User Settings operations
  getOrCreateUserSettings(userId: string): Promise<UserSettings>;
  updateUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings>;
  requestAccountDeletion(userId: string): Promise<UserSettings>;
  cancelAccountDeletion(userId: string): Promise<UserSettings>;
  
  // Sponsored Ads operations
  getActiveSponsoredAds(type?: string): Promise<SponsoredAd[]>;
  createSponsoredAd(data: InsertSponsoredAd): Promise<SponsoredAd>;
  recordAdImpression(adId: string): Promise<void>;
  recordAdClick(adId: string): Promise<void>;
  
  // Platform Settings operations
  getAllPlatformSettings(): Promise<PlatformSetting[]>;
  getPlatformSetting(key: string): Promise<PlatformSetting | undefined>;
  updatePlatformSetting(key: string, value: string, updatedBy?: string): Promise<PlatformSetting>;
  
  // KYC Verification operations
  createKycVerification(userId: string): Promise<KycVerification>;
  getKycVerification(userId: string): Promise<KycVerification | undefined>;
  getKycVerificationById(id: string): Promise<KycVerification | undefined>;
  updateKycVerification(id: string, data: Partial<KycVerification>): Promise<KycVerification>;
  getPendingKycVerifications(): Promise<KycVerification[]>;
  createKycLog(data: { kycId: string; userId: string; action: string; result?: string; similarityScore?: number | string; reviewedBy?: string; ipAddress?: string; userAgent?: string; metadata?: any }): Promise<void>;
  
  // Scheduled VTU Purchases operations
  getScheduledPurchases(userId: string): Promise<ScheduledVtuPurchase[]>;
  getScheduledPurchase(id: string): Promise<ScheduledVtuPurchase | undefined>;
  createScheduledPurchase(data: InsertScheduledVtuPurchase): Promise<ScheduledVtuPurchase>;
  updateScheduledPurchase(id: string, data: Partial<ScheduledVtuPurchase>): Promise<ScheduledVtuPurchase>;
  deleteScheduledPurchase(id: string): Promise<void>;
  
  // Gift Data operations
  getGiftsByUser(userId: string): Promise<GiftData[]>;
  getGiftByCode(code: string): Promise<GiftData | undefined>;
  createGiftData(data: InsertGiftData): Promise<GiftData>;
  claimGiftData(giftId: string, claimerId: string): Promise<GiftData>;
  
  // Bill Payment operations
  createBillPayment(data: InsertBillPayment): Promise<BillPayment>;
  updateBillPayment(id: string, data: Partial<BillPayment>): Promise<BillPayment>;
  getUserBillPayments(userId: string): Promise<BillPayment[]>;
  
  // Story operations
  createStory(data: { authorId: string; type: "image" | "video" | "text"; mediaUrl?: string; textContent?: string; backgroundColor?: string; fontStyle?: string }): Promise<Story>;
  getStory(id: string): Promise<(Story & { author: User }) | undefined>;
  getActiveStories(userId: string): Promise<(Story & { author: User; hasViewed: boolean })[]>;
  getUserActiveStories(userId: string): Promise<(Story & { author: User })[]>;
  deleteStory(id: string): Promise<void>;
  viewStory(storyId: string, viewerId: string): Promise<StoryView>;
  hasViewedStory(storyId: string, viewerId: string): Promise<boolean>;
  getStoryViews(storyId: string): Promise<(StoryView & { viewer: User })[]>;
  reactToStory(storyId: string, reactorId: string, reaction: string): Promise<StoryReaction>;
  getStoryReactions(storyId: string): Promise<(StoryReaction & { reactor: User })[]>;
  replyToStory(storyId: string, senderId: string, content: string): Promise<StoryReply>;
  getStoryReplies(storyId: string): Promise<(StoryReply & { sender: User })[]>;
  getUsersWithActiveStories(currentUserId: string): Promise<{ user: User; storyCount: number; hasUnviewed: boolean; latestStoryAt: Date }[]>;
  incrementStoryViews(storyId: string): Promise<void>;
  incrementStoryLikes(storyId: string): Promise<void>;
  decrementStoryLikes(storyId: string): Promise<void>;
  
  // Confession operations
  createConfession(data: { authorId?: string; content: string; category?: string; isAnonymous?: boolean }): Promise<Confession>;
  getConfession(id: string): Promise<(Confession & { author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null }) | undefined>;
  getConfessions(options?: { category?: string; status?: string; page?: number; limit?: number }): Promise<{ confessions: Confession[]; total: number }>;
  getTrendingConfessions(limit?: number): Promise<Confession[]>;
  deleteConfession(id: string): Promise<void>;
  approveConfession(id: string, moderatedBy: string): Promise<Confession>;
  rejectConfession(id: string, moderatedBy: string): Promise<Confession>;
  flagConfession(id: string): Promise<Confession>;
  autoApproveOldConfessions(): Promise<number>;
  
  // Confession vote operations
  voteConfession(confessionId: string, voterId: string, voteType: 'like' | 'dislike'): Promise<ConfessionVote>;
  removeVote(confessionId: string, voterId: string): Promise<void>;
  getUserVote(confessionId: string, voterId: string): Promise<ConfessionVote | undefined>;
  
  // Confession comment operations
  getConfessionComments(confessionId: string): Promise<(ConfessionComment & { author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null })[]>;
  createConfessionComment(data: { confessionId: string; authorId?: string; content: string; isAnonymous?: boolean; parentId?: string }): Promise<ConfessionComment>;
  deleteConfessionComment(id: string): Promise<void>;
  
  // Confession report operations
  createConfessionReport(data: { confessionId: string; reporterId: string; reason: string; description?: string }): Promise<any>;
  getConfessionReports(confessionId: string): Promise<any[]>;

  // Community operations
  createCommunity(data: { name: string; slug: string; description?: string; iconUrl?: string; coverUrl?: string; type?: "public" | "private" | "invite_only"; category?: string; rules?: string[]; ownerId: string }): Promise<Community>;
  getCommunity(id: string): Promise<(Community & { owner: User }) | undefined>;
  getCommunityBySlug(slug: string): Promise<(Community & { owner: User }) | undefined>;
  getPublicCommunities(): Promise<(Community & { owner: User })[]>;
  getUserJoinedCommunities(userId: string): Promise<(Community & { owner: User; membership: CommunityMember })[]>;
  updateCommunity(id: string, data: Partial<Community>): Promise<Community>;
  deleteCommunity(id: string): Promise<void>;
  
  // Community member operations
  joinCommunity(communityId: string, userId: string): Promise<CommunityMember>;
  leaveCommunity(communityId: string, userId: string): Promise<void>;
  getCommunityMember(communityId: string, userId: string): Promise<CommunityMember | undefined>;
  getCommunityMembers(communityId: string): Promise<(CommunityMember & { user: User })[]>;
  updateMemberRole(communityId: string, userId: string, role: "member" | "moderator" | "admin" | "owner"): Promise<CommunityMember>;
  banMember(communityId: string, userId: string, reason: string, until?: Date): Promise<CommunityMember>;
  
  // Community post operations
  createCommunityPost(data: { communityId: string; authorId: string; title?: string; content: string; images?: string[] }): Promise<CommunityPost>;
  getCommunityPost(id: string): Promise<(CommunityPost & { author: User; community: Community }) | undefined>;
  getCommunityPosts(communityId: string): Promise<(CommunityPost & { author: User; isLiked?: boolean })[]>;
  updateCommunityPost(id: string, data: Partial<CommunityPost>): Promise<CommunityPost>;
  deleteCommunityPost(id: string): Promise<void>;
  pinPost(id: string, isPinned: boolean): Promise<CommunityPost>;
  lockPost(id: string, isLocked: boolean): Promise<CommunityPost>;
  
  // Community post like operations
  likeCommunityPost(postId: string, userId: string): Promise<CommunityPostLike>;
  unlikeCommunityPost(postId: string, userId: string): Promise<void>;
  hasLikedCommunityPost(postId: string, userId: string): Promise<boolean>;
  
  // Community post comment operations
  createCommunityPostComment(data: { postId: string; authorId: string; content: string; parentId?: string }): Promise<CommunityPostComment>;
  getCommunityPostComments(postId: string): Promise<(CommunityPostComment & { author: User })[]>;
  deleteCommunityPostComment(id: string): Promise<void>;
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
    
    // Auto-follow system user and send welcome DM
    await this.autoFollowSystemUserAndSendWelcomeDM(user.id);
    
    return user;
  }
  
  private async autoFollowSystemUserAndSendWelcomeDM(userId: string): Promise<void> {
    try {
      const systemUserId = process.env.SYSTEM_WELCOME_USER_ID;
      if (!systemUserId) {
        console.log('SYSTEM_WELCOME_USER_ID not configured, skipping auto-follow and welcome DM');
        return;
      }
      
      // Verify system user exists
      const systemUser = await this.getUser(systemUserId);
      if (!systemUser) {
        console.log(`System user ${systemUserId} not found, skipping auto-follow and welcome DM`);
        return;
      }
      
      // Auto-follow the system user (new user follows @CampusPlugOfficial)
      try {
        await this.followUser(userId, systemUserId);
        console.log(`User ${userId} now follows system user ${systemUserId}`);
      } catch (error) {
        console.log(`Could not auto-follow system user: ${error}`);
      }
      
      // Send welcome DM from system user
      const welcomeMessage = "Welcome to the family! Check out 'The Plug' for campus gist and verify your account to start selling. Stay safe and only pay through the CampusPlug Wallet!";
      
      await this.createMessage({
        senderId: systemUserId,
        receiverId: userId,
        content: welcomeMessage,
      });
      console.log(`Welcome DM sent to user ${userId}`);
      
    } catch (error) {
      console.error('Error in autoFollowSystemUserAndSendWelcomeDM:', error);
    }
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
      
      // Auto-follow system user and send welcome DM
      await this.autoFollowSystemUserAndSendWelcomeDM(user.id);
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

  // Unique product view tracking methods
  async hasViewedProduct(productId: string, viewerId: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(productViews)
      .where(
        and(
          eq(productViews.productId, productId),
          eq(productViews.viewerId, viewerId)
        )
      )
      .limit(1);
    return existing.length > 0;
  }

  async recordProductView(productId: string, viewerId: string): Promise<void> {
    await db.insert(productViews).values({
      productId,
      viewerId,
    });
  }

  async recordUniqueProductView(productId: string, viewerId: string): Promise<boolean> {
    // Check if this viewer has already viewed this product
    const hasViewed = await this.hasViewedProduct(productId, viewerId);
    
    if (!hasViewed) {
      // Record the new view
      await this.recordProductView(productId, viewerId);
      // Increment the product's view counter
      await this.incrementProductViews(productId);
      return true; // New unique view recorded
    }
    
    return false; // Already viewed, no increment
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

  async getWishlistWithProducts(userId: string): Promise<(Watchlist & { product: Product & { seller: User } })[]> {
    const results = await db
      .select()
      .from(watchlist)
      .leftJoin(products, eq(watchlist.productId, products.id))
      .leftJoin(users, eq(products.sellerId, users.id))
      .where(eq(watchlist.userId, userId))
      .orderBy(desc(watchlist.createdAt));

    // Filter out items with missing products or sellers and map to the expected format
    return results
      .filter(r => r.watchlist && r.products && r.users)
      .map(r => ({
        ...r.watchlist!,
        product: {
          ...r.products!,
          seller: r.users!,
        },
      }));
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

  async getEscrowTransactionWithDetails(id: string): Promise<(EscrowTransaction & { product?: Product; buyer: User; seller: User }) | undefined> {
    const [transaction] = await db.select().from(escrowTransactions).where(eq(escrowTransactions.id, id));
    if (!transaction) return undefined;
    
    const [buyer] = await db.select().from(users).where(eq(users.id, transaction.buyerId));
    const [seller] = await db.select().from(users).where(eq(users.id, transaction.sellerId));
    
    let product: Product | undefined;
    if (transaction.productId) {
      const [p] = await db.select().from(products).where(eq(products.id, transaction.productId));
      product = p;
    }
    
    return { ...transaction, product, buyer, seller };
  }

  async getUserPurchases(buyerId: string): Promise<(EscrowTransaction & { product?: Product; seller: User })[]> {
    const transactions = await db
      .select()
      .from(escrowTransactions)
      .where(eq(escrowTransactions.buyerId, buyerId))
      .orderBy(desc(escrowTransactions.createdAt));
    
    const results: (EscrowTransaction & { product?: Product; seller: User })[] = [];
    for (const transaction of transactions) {
      const [seller] = await db.select().from(users).where(eq(users.id, transaction.sellerId));
      let product: Product | undefined;
      if (transaction.productId) {
        const [p] = await db.select().from(products).where(eq(products.id, transaction.productId));
        product = p;
      }
      results.push({ ...transaction, product, seller });
    }
    return results;
  }

  async getUserSales(sellerId: string): Promise<(EscrowTransaction & { product?: Product; buyer: User })[]> {
    const transactions = await db
      .select()
      .from(escrowTransactions)
      .where(eq(escrowTransactions.sellerId, sellerId))
      .orderBy(desc(escrowTransactions.createdAt));
    
    const results: (EscrowTransaction & { product?: Product; buyer: User })[] = [];
    for (const transaction of transactions) {
      const [buyer] = await db.select().from(users).where(eq(users.id, transaction.buyerId));
      let product: Product | undefined;
      if (transaction.productId) {
        const [p] = await db.select().from(products).where(eq(products.id, transaction.productId));
        product = p;
      }
      results.push({ ...transaction, product, buyer });
    }
    return results;
  }

  async addToEscrowBalance(sellerId: string, amount: string): Promise<Wallet> {
    const wallet = await this.getWallet(sellerId);
    if (!wallet) throw new Error("Wallet not found");
    
    const [updated] = await db
      .update(wallets)
      .set({
        escrowBalance: sql`${wallets.escrowBalance} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(wallets.userId, sellerId))
      .returning();
    
    return updated;
  }

  async getSellerCompletedSalesCount(sellerId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(escrowTransactions)
      .where(and(
        eq(escrowTransactions.sellerId, sellerId),
        eq(escrowTransactions.status, 'released')
      ));
    return result[0]?.count ?? 0;
  }

  async lockSecurityDeposit(userId: string, amount: string): Promise<Wallet> {
    const wallet = await this.getWallet(userId);
    if (!wallet) throw new Error("Wallet not found");
    
    const [updated] = await db
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${amount}`,
        securityDepositLocked: sql`${wallets.securityDepositLocked} + ${amount}`,
        updatedAt: new Date()
      })
      .where(eq(wallets.userId, userId))
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

  // Social post operations ("The Plug")
  async getSocialPostById(postId: string): Promise<SocialPost | undefined> {
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
    return post;
  }

  async getSocialPosts(options?: { authorId?: string; followingOnly?: boolean; userId?: string }): Promise<(SocialPost & { author: User; isLiked?: boolean; isFollowingAuthor?: boolean; isReposted?: boolean })[]> {
    let query = db
      .select()
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.authorId, users.id))
      .where(eq(socialPosts.isVisible, true))
      .orderBy(desc(socialPosts.createdAt));

    const results = await query;
    let posts = results
      .filter(r => r.social_posts && r.users)
      .map(r => ({
        ...r.social_posts!,
        author: r.users!,
      }));

    // Filter by author if specified
    if (options?.authorId) {
      posts = posts.filter(p => p.authorId === options.authorId);
    }

    // Get following list for both filtering and display
    let followingIds = new Set<string>();
    if (options?.userId) {
      const followingResult = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, options.userId));
      
      followingIds = new Set(followingResult.map(f => f.followingId));
    }

    // Filter by following only if specified
    if (options?.followingOnly && options?.userId) {
      posts = posts.filter(p => followingIds.has(p.authorId));
    }

    // Add isLiked, isFollowingAuthor, and isReposted status if userId is provided
    if (options?.userId) {
      const [likedPosts, repostedPosts] = await Promise.all([
        db.select({ postId: socialPostLikes.postId })
          .from(socialPostLikes)
          .where(eq(socialPostLikes.userId, options.userId)),
        db.select({ originalPostId: socialPostReposts.originalPostId })
          .from(socialPostReposts)
          .where(eq(socialPostReposts.reposterId, options.userId))
      ]);
      
      const likedPostIds = new Set(likedPosts.map(l => l.postId));
      const repostedPostIds = new Set(repostedPosts.map(r => r.originalPostId));
      
      return posts.map(p => ({
        ...p,
        isLiked: likedPostIds.has(p.id),
        isFollowingAuthor: followingIds.has(p.authorId),
        isReposted: repostedPostIds.has(p.id),
      }));
    }

    return posts;
  }

  async createSocialPost(post: { authorId: string; content: string; images?: string[]; videos?: string[] }): Promise<SocialPost> {
    const [created] = await db
      .insert(socialPosts)
      .values({
        authorId: post.authorId,
        content: post.content,
        images: post.images || [],
        videos: post.videos || [],
      })
      .returning();
    return created;
  }

  async getSocialPost(id: string): Promise<(SocialPost & { author: User }) | undefined> {
    const [result] = await db
      .select()
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.authorId, users.id))
      .where(eq(socialPosts.id, id));
    
    if (!result || !result.social_posts || !result.users) return undefined;
    
    return {
      ...result.social_posts,
      author: result.users,
    };
  }

  async likeSocialPost(postId: string, userId: string): Promise<SocialPostLike> {
    // Check if already liked
    const existing = await db
      .select()
      .from(socialPostLikes)
      .where(
        and(
          eq(socialPostLikes.postId, postId),
          eq(socialPostLikes.userId, userId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    // Create like
    const [like] = await db
      .insert(socialPostLikes)
      .values({ postId, userId })
      .returning();

    // Increment likes count
    await db
      .update(socialPosts)
      .set({ likesCount: sql`COALESCE(${socialPosts.likesCount}, 0) + 1` })
      .where(eq(socialPosts.id, postId));

    return like;
  }

  async unlikeSocialPost(postId: string, userId: string): Promise<void> {
    const result = await db
      .delete(socialPostLikes)
      .where(
        and(
          eq(socialPostLikes.postId, postId),
          eq(socialPostLikes.userId, userId)
        )
      )
      .returning();

    // Decrement likes count only if we actually deleted a like
    if (result.length > 0) {
      await db
        .update(socialPosts)
        .set({ likesCount: sql`GREATEST(COALESCE(${socialPosts.likesCount}, 0) - 1, 0)` })
        .where(eq(socialPosts.id, postId));
    }
  }

  async isPostLiked(postId: string, userId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(socialPostLikes)
      .where(
        and(
          eq(socialPostLikes.postId, postId),
          eq(socialPostLikes.userId, userId)
        )
      );
    return !!result;
  }

  async getPostComments(postId: string): Promise<(SocialPostComment & { author: User })[]> {
    const results = await db
      .select()
      .from(socialPostComments)
      .leftJoin(users, eq(socialPostComments.authorId, users.id))
      .where(eq(socialPostComments.postId, postId))
      .orderBy(socialPostComments.createdAt);

    return results
      .filter(r => r.social_post_comments && r.users)
      .map(r => ({
        ...r.social_post_comments!,
        author: r.users!,
      }));
  }

  async createPostComment(comment: { postId: string; authorId: string; content: string }): Promise<SocialPostComment> {
    const [created] = await db
      .insert(socialPostComments)
      .values(comment)
      .returning();

    // Increment comments count
    await db
      .update(socialPosts)
      .set({ commentsCount: sql`COALESCE(${socialPosts.commentsCount}, 0) + 1` })
      .where(eq(socialPosts.id, comment.postId));

    return created;
  }

  async deleteSocialPost(postId: string): Promise<void> {
    await db.delete(socialPosts).where(eq(socialPosts.id, postId));
  }

  async repostSocialPost(postId: string, userId: string, quoteContent?: string): Promise<SocialPostRepost> {
    // Check if already reposted
    const existing = await db
      .select()
      .from(socialPostReposts)
      .where(
        and(
          eq(socialPostReposts.originalPostId, postId),
          eq(socialPostReposts.reposterId, userId)
        )
      );

    if (existing.length > 0) {
      return existing[0];
    }

    // Create repost
    const [repost] = await db
      .insert(socialPostReposts)
      .values({ originalPostId: postId, reposterId: userId, quoteContent })
      .returning();

    // Increment reposts count
    await db
      .update(socialPosts)
      .set({ repostsCount: sql`COALESCE(${socialPosts.repostsCount}, 0) + 1` })
      .where(eq(socialPosts.id, postId));

    return repost;
  }

  async unrepostSocialPost(postId: string, userId: string): Promise<void> {
    const result = await db
      .delete(socialPostReposts)
      .where(
        and(
          eq(socialPostReposts.originalPostId, postId),
          eq(socialPostReposts.reposterId, userId)
        )
      )
      .returning();

    // Decrement reposts count only if we actually deleted a repost
    if (result.length > 0) {
      await db
        .update(socialPosts)
        .set({ repostsCount: sql`GREATEST(COALESCE(${socialPosts.repostsCount}, 0) - 1, 0)` })
        .where(eq(socialPosts.id, postId));
    }
  }

  async isPostReposted(postId: string, userId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(socialPostReposts)
      .where(
        and(
          eq(socialPostReposts.originalPostId, postId),
          eq(socialPostReposts.reposterId, userId)
        )
      );
    return !!result;
  }

  async getPostReposts(postId: string): Promise<(SocialPostRepost & { reposter: User })[]> {
    const results = await db
      .select()
      .from(socialPostReposts)
      .leftJoin(users, eq(socialPostReposts.reposterId, users.id))
      .where(eq(socialPostReposts.originalPostId, postId))
      .orderBy(desc(socialPostReposts.createdAt));

    return results
      .filter(r => r.social_post_reposts && r.users)
      .map(r => ({
        ...r.social_post_reposts!,
        reposter: r.users!,
      }));
  }

  // Post bookmark operations
  async bookmarkPost(userId: string, postId: string): Promise<PostBookmark> {
    const [existing] = await db
      .select()
      .from(postBookmarks)
      .where(and(eq(postBookmarks.userId, userId), eq(postBookmarks.postId, postId)));
    
    if (existing) return existing;
    
    const [bookmark] = await db.insert(postBookmarks).values({ userId, postId }).returning();
    return bookmark;
  }

  async unbookmarkPost(userId: string, postId: string): Promise<void> {
    await db
      .delete(postBookmarks)
      .where(and(eq(postBookmarks.userId, userId), eq(postBookmarks.postId, postId)));
  }

  async isPostBookmarked(userId: string, postId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(postBookmarks)
      .where(and(eq(postBookmarks.userId, userId), eq(postBookmarks.postId, postId)));
    return !!result;
  }

  async getUserBookmarks(userId: string): Promise<(PostBookmark & { post: SocialPost; author: User })[]> {
    const results = await db
      .select()
      .from(postBookmarks)
      .leftJoin(socialPosts, eq(postBookmarks.postId, socialPosts.id))
      .leftJoin(users, eq(socialPosts.authorId, users.id))
      .where(eq(postBookmarks.userId, userId))
      .orderBy(desc(postBookmarks.createdAt));

    return results
      .filter(r => r.post_bookmarks && r.social_posts && r.users)
      .map(r => ({
        ...r.post_bookmarks!,
        post: r.social_posts!,
        author: r.users!,
      }));
  }

  // Smart feed algorithm operations
  async getSocialPostsWithAlgorithm(options?: { userId?: string; feedType?: 'for_you' | 'following' }): Promise<(SocialPost & { author: User; isLiked?: boolean; isFollowingAuthor?: boolean; isReposted?: boolean; engagementScore?: string })[]> {
    const feedType = options?.feedType || 'for_you';
    
    let query = db
      .select()
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.authorId, users.id))
      .leftJoin(feedEngagementScores, eq(socialPosts.id, feedEngagementScores.postId))
      .where(eq(socialPosts.isVisible, true));
    
    // Get following list if feedType is 'following'
    let followingIds: string[] = [];
    if (options?.userId && feedType === 'following') {
      const followingList = await db
        .select({ followingId: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, options.userId));
      followingIds = followingList.map(f => f.followingId);
    }
    
    const results = await query.orderBy(
      feedType === 'for_you' 
        ? desc(sql`COALESCE(${feedEngagementScores.engagementScore}, 0) + CASE WHEN ${socialPosts.createdAt} > NOW() - INTERVAL '24 hours' THEN 10 ELSE 0 END`)
        : desc(socialPosts.createdAt)
    ).limit(50);

    let likedPostIds: string[] = [];
    let repostedPostIds: string[] = [];
    
    if (options?.userId) {
      const [likedResult, repostedResult] = await Promise.all([
        db.select({ postId: socialPostLikes.postId })
          .from(socialPostLikes)
          .where(eq(socialPostLikes.userId, options.userId)),
        db.select({ originalPostId: socialPostReposts.originalPostId })
          .from(socialPostReposts)
          .where(eq(socialPostReposts.reposterId, options.userId))
      ]);
      likedPostIds = likedResult.map(l => l.postId);
      repostedPostIds = repostedResult.map(r => r.originalPostId);
    }

    return results
      .filter(r => r.social_posts && r.users)
      .filter(r => {
        if (feedType === 'following' && options?.userId) {
          return followingIds.includes(r.social_posts!.authorId) || r.social_posts!.authorId === options.userId;
        }
        return true;
      })
      .map(r => ({
        ...r.social_posts!,
        author: r.users!,
        isLiked: likedPostIds.includes(r.social_posts!.id),
        isFollowingAuthor: followingIds.includes(r.social_posts!.authorId),
        isReposted: repostedPostIds.includes(r.social_posts!.id),
        engagementScore: r.feed_engagement_scores?.engagementScore || "0",
      }));
  }

  async updatePostEngagementScore(postId: string): Promise<void> {
    const [post] = await db.select().from(socialPosts).where(eq(socialPosts.id, postId));
    if (!post) return;

    // Calculate engagement score based on likes, comments, reposts, shares, views
    const likesWeight = 1;
    const commentsWeight = 3;
    const repostsWeight = 5;
    const sharesWeight = 2;
    const viewsWeight = 0.1;
    
    const score = (
      (post.likesCount || 0) * likesWeight +
      (post.commentsCount || 0) * commentsWeight +
      (post.repostsCount || 0) * repostsWeight +
      (post.sharesCount || 0) * sharesWeight +
      (post.viewsCount || 0) * viewsWeight
    );
    
    // Calculate velocity (engagement in last 24 hours)
    const hoursOld = Math.max(1, (Date.now() - new Date(post.createdAt || Date.now()).getTime()) / (1000 * 60 * 60));
    const velocity = score / hoursOld;
    
    // Recency bonus (decays over time)
    const recencyBonus = Math.max(0, 10 - hoursOld / 2.4);
    
    const [existing] = await db.select().from(feedEngagementScores).where(eq(feedEngagementScores.postId, postId));
    
    if (existing) {
      await db.update(feedEngagementScores)
        .set({ 
          engagementScore: score.toFixed(4), 
          velocityScore: velocity.toFixed(4),
          recencyBonus: recencyBonus.toFixed(4),
          calculatedAt: new Date()
        })
        .where(eq(feedEngagementScores.postId, postId));
    } else {
      await db.insert(feedEngagementScores).values({
        postId,
        engagementScore: score.toFixed(4),
        velocityScore: velocity.toFixed(4),
        recencyBonus: recencyBonus.toFixed(4),
      });
    }
  }

  async incrementPostViews(postId: string): Promise<void> {
    await db
      .update(socialPosts)
      .set({ viewsCount: sql`COALESCE(${socialPosts.viewsCount}, 0) + 1` })
      .where(eq(socialPosts.id, postId));
  }

  async incrementPostShares(postId: string): Promise<void> {
    await db
      .update(socialPosts)
      .set({ sharesCount: sql`COALESCE(${socialPosts.sharesCount}, 0) + 1` })
      .where(eq(socialPosts.id, postId));
  }

  // Username and system account operations
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username.toLowerCase()));
    return user;
  }

  async updateUsername(userId: string, username: string): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ username: username.toLowerCase(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return updated;
  }

  async getSystemAccount(type: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(and(eq(users.isSystemAccount, true), eq(users.systemAccountType, type)));
    return user;
  }

  async createSystemAccount(data: { email: string; username: string; firstName: string; lastName: string; type: string; bio?: string; profileImageUrl?: string }): Promise<User> {
    const [user] = await db.insert(users).values({
      email: data.email,
      username: data.username.toLowerCase(),
      firstName: data.firstName,
      lastName: data.lastName,
      bio: data.bio,
      profileImageUrl: data.profileImageUrl,
      isSystemAccount: true,
      systemAccountType: data.type,
      isVerified: true,
      isActive: true,
    }).returning();
    return user;
  }

  // Enhanced social post operations
  async createSocialPostWithOptions(post: { authorId: string; content: string; images?: string[]; videos?: string[]; replyRestriction?: string; mentionedUserIds?: string[]; hashtags?: string[]; isFromSystemAccount?: boolean }): Promise<SocialPost> {
    const [created] = await db.insert(socialPosts).values({
      authorId: post.authorId,
      content: post.content,
      images: post.images || [],
      videos: post.videos || [],
      replyRestriction: (post.replyRestriction as any) || 'everyone',
      mentionedUserIds: post.mentionedUserIds || [],
      hashtags: post.hashtags || [],
      isFromSystemAccount: post.isFromSystemAccount || false,
    }).returning();
    
    // Calculate initial engagement score
    await this.updatePostEngagementScore(created.id);
    
    return created;
  }

  async updateSocialPost(postId: string, data: Partial<SocialPost>): Promise<SocialPost> {
    const [updated] = await db
      .update(socialPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(socialPosts.id, postId))
      .returning();
    return updated;
  }

  async pinPost(postId: string): Promise<void> {
    await db.update(socialPosts).set({ isPinned: true }).where(eq(socialPosts.id, postId));
  }

  async unpinPost(postId: string): Promise<void> {
    await db.update(socialPosts).set({ isPinned: false }).where(eq(socialPosts.id, postId));
  }

  async getUserPinnedPosts(userId: string): Promise<(SocialPost & { author: User })[]> {
    const results = await db
      .select()
      .from(socialPosts)
      .leftJoin(users, eq(socialPosts.authorId, users.id))
      .where(and(eq(socialPosts.authorId, userId), eq(socialPosts.isPinned, true)))
      .orderBy(desc(socialPosts.createdAt));

    return results
      .filter(r => r.social_posts && r.users)
      .map(r => ({
        ...r.social_posts!,
        author: r.users!,
      }));
  }

  // Squad payment operations
  async createSquadPayment(payment: InsertSquadPayment): Promise<SquadPayment> {
    const [created] = await db.insert(squadPayments).values(payment).returning();
    return created;
  }

  async getSquadPayment(id: string): Promise<SquadPayment | undefined> {
    const [payment] = await db.select().from(squadPayments).where(eq(squadPayments.id, id));
    return payment;
  }

  async getSquadPaymentByReference(transactionReference: string): Promise<SquadPayment | undefined> {
    const [payment] = await db.select().from(squadPayments).where(eq(squadPayments.transactionReference, transactionReference));
    return payment;
  }

  async updateSquadPaymentStatus(transactionReference: string, status: string, paidAt?: Date): Promise<SquadPayment | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (paidAt) {
      updateData.paidAt = paidAt;
    }
    const [updated] = await db
      .update(squadPayments)
      .set(updateData)
      .where(eq(squadPayments.transactionReference, transactionReference))
      .returning();
    return updated;
  }

  async getUserSquadPayments(userId: string): Promise<SquadPayment[]> {
    return await db
      .select()
      .from(squadPayments)
      .where(eq(squadPayments.userId, userId))
      .orderBy(desc(squadPayments.createdAt));
  }

  // Squad transfer operations
  async createSquadTransfer(transfer: InsertSquadTransfer): Promise<SquadTransfer> {
    const [created] = await db.insert(squadTransfers).values(transfer).returning();
    return created;
  }

  async getSquadTransferByReference(transactionReference: string): Promise<SquadTransfer | undefined> {
    const [transfer] = await db.select().from(squadTransfers).where(eq(squadTransfers.transactionReference, transactionReference));
    return transfer;
  }

  async updateSquadTransferStatus(transactionReference: string, status: string, responseMessage?: string, completedAt?: Date): Promise<SquadTransfer | undefined> {
    const updateData: any = { status };
    if (responseMessage) {
      updateData.responseMessage = responseMessage;
    }
    if (completedAt) {
      updateData.completedAt = completedAt;
    }
    const [updated] = await db
      .update(squadTransfers)
      .set(updateData)
      .where(eq(squadTransfers.transactionReference, transactionReference))
      .returning();
    return updated;
  }

  // Negotiation operations
  async createNegotiation(negotiation: InsertNegotiation): Promise<Negotiation> {
    const [created] = await db.insert(negotiations).values(negotiation).returning();
    return created;
  }

  async getNegotiation(id: string): Promise<Negotiation | undefined> {
    const [negotiation] = await db.select().from(negotiations).where(eq(negotiations.id, id));
    return negotiation;
  }

  async getProductNegotiations(productId: string): Promise<Negotiation[]> {
    return await db
      .select()
      .from(negotiations)
      .where(eq(negotiations.productId, productId))
      .orderBy(desc(negotiations.createdAt));
  }

  async getUserNegotiations(userId: string): Promise<Negotiation[]> {
    return await db
      .select()
      .from(negotiations)
      .where(or(eq(negotiations.buyerId, userId), eq(negotiations.sellerId, userId)))
      .orderBy(desc(negotiations.createdAt));
  }

  async updateNegotiationStatus(id: string, status: string, data?: Partial<Negotiation>): Promise<Negotiation | undefined> {
    const updateData: any = { status, updatedAt: new Date(), ...data };
    const [updated] = await db
      .update(negotiations)
      .set(updateData)
      .where(eq(negotiations.id, id))
      .returning();
    return updated;
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return order;
  }

  async getBuyerOrders(buyerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.buyerId, buyerId))
      .orderBy(desc(orders.createdAt));
  }

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.sellerId, sellerId))
      .orderBy(desc(orders.createdAt));
  }

  async updateOrderStatus(orderId: string, status: string, changedBy: string, notes?: string): Promise<Order> {
    const currentOrder = await this.getOrder(orderId);
    const fromStatus = currentOrder?.status || null;
    
    const timestampField = this.getTimestampFieldForStatus(status);
    const updateData: any = { 
      status, 
      updatedAt: new Date(),
    };
    
    if (timestampField) {
      updateData[timestampField] = new Date();
    }
    
    const [updated] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();
    
    await this.addOrderStatusHistory({
      orderId,
      fromStatus,
      toStatus: status as "pending" | "paid" | "seller_confirmed" | "preparing" | "ready_for_pickup" | "shipped" | "out_for_delivery" | "delivered" | "buyer_confirmed" | "completed" | "cancelled" | "disputed" | "refunded",
      changedBy,
      notes,
    });
    
    return updated;
  }

  private getTimestampFieldForStatus(status: string): string | null {
    const statusTimestampMap: Record<string, string> = {
      'paid': 'paidAt',
      'seller_confirmed': 'sellerConfirmedAt',
      'preparing': 'preparingAt',
      'ready_for_pickup': 'readyAt',
      'shipped': 'shippedAt',
      'out_for_delivery': 'outForDeliveryAt',
      'delivered': 'deliveredAt',
      'buyer_confirmed': 'buyerConfirmedAt',
      'completed': 'completedAt',
      'cancelled': 'cancelledAt',
    };
    return statusTimestampMap[status] || null;
  }

  async addOrderStatusHistory(history: InsertOrderStatusHistory): Promise<OrderStatusHistory> {
    const [created] = await db.insert(orderStatusHistory).values(history).returning();
    return created;
  }

  async getOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
    return await db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(desc(orderStatusHistory.createdAt));
  }

  // User relationship operations (block/mute/report)
  async blockUser(blockerId: string, blockedId: string): Promise<UserBlock> {
    const existing = await db
      .select()
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [block] = await db.insert(userBlocks).values({ blockerId, blockedId }).returning();
    return block;
  }

  async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    await db
      .delete(userBlocks)
      .where(and(eq(userBlocks.blockerId, blockerId), eq(userBlocks.blockedId, blockedId)));
  }

  async muteUser(muterId: string, mutedId: string): Promise<UserMute> {
    const existing = await db
      .select()
      .from(userMutes)
      .where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [mute] = await db.insert(userMutes).values({ muterId, mutedId }).returning();
    return mute;
  }

  async unmuteUser(muterId: string, mutedId: string): Promise<void> {
    await db
      .delete(userMutes)
      .where(and(eq(userMutes.muterId, muterId), eq(userMutes.mutedId, mutedId)));
  }

  async isUserBlocked(userId: string, targetId: string): Promise<boolean> {
    const [block] = await db
      .select()
      .from(userBlocks)
      .where(and(eq(userBlocks.blockerId, userId), eq(userBlocks.blockedId, targetId)));
    return !!block;
  }

  async isUserMuted(userId: string, targetId: string): Promise<boolean> {
    const [mute] = await db
      .select()
      .from(userMutes)
      .where(and(eq(userMutes.muterId, userId), eq(userMutes.mutedId, targetId)));
    return !!mute;
  }

  async getBlockedUsers(userId: string): Promise<(UserBlock & { blockedUser: User })[]> {
    const blocks = await db
      .select()
      .from(userBlocks)
      .where(eq(userBlocks.blockerId, userId))
      .orderBy(desc(userBlocks.createdAt));
    
    const result: (UserBlock & { blockedUser: User })[] = [];
    for (const block of blocks) {
      const [blockedUser] = await db.select().from(users).where(eq(users.id, block.blockedId));
      if (blockedUser) {
        result.push({ ...block, blockedUser });
      }
    }
    return result;
  }

  async getMutedUsers(userId: string): Promise<(UserMute & { mutedUser: User })[]> {
    const mutes = await db
      .select()
      .from(userMutes)
      .where(eq(userMutes.muterId, userId))
      .orderBy(desc(userMutes.createdAt));
    
    const result: (UserMute & { mutedUser: User })[] = [];
    for (const mute of mutes) {
      const [mutedUser] = await db.select().from(users).where(eq(users.id, mute.mutedId));
      if (mutedUser) {
        result.push({ ...mute, mutedUser });
      }
    }
    return result;
  }

  async createUserReport(data: InsertUserReport): Promise<UserReport> {
    const [report] = await db.insert(userReports).values(data).returning();
    return report;
  }

  async reportUser(reporterId: string, reportedId: string, reason: string, description: string): Promise<UserReport> {
    return this.createUserReport({
      reporterId,
      reportedId,
      reason,
      description: description || "",
    });
  }

  async getUserRelationship(userId: string, targetId: string): Promise<{ isBlocked: boolean; isMuted: boolean; isBlockedByTarget: boolean }> {
    const [isBlockedResult, isMutedResult, isBlockedByTargetResult] = await Promise.all([
      this.isUserBlocked(userId, targetId),
      this.isUserMuted(userId, targetId),
      this.isUserBlocked(targetId, userId),
    ]);
    
    return {
      isBlocked: isBlockedResult,
      isMuted: isMutedResult,
      isBlockedByTarget: isBlockedByTargetResult,
    };
  }

  // VTU (Virtual Top-Up) operations
  async getVtuPlans(network?: string): Promise<VtuPlan[]> {
    if (network) {
      return await db
        .select()
        .from(vtuPlans)
        .where(and(eq(vtuPlans.isActive, true), eq(vtuPlans.network, network as any)))
        .orderBy(vtuPlans.sortOrder);
    }
    return await db
      .select()
      .from(vtuPlans)
      .where(eq(vtuPlans.isActive, true))
      .orderBy(vtuPlans.sortOrder);
  }

  async getVtuPlan(id: string): Promise<VtuPlan | undefined> {
    const [plan] = await db.select().from(vtuPlans).where(eq(vtuPlans.id, id));
    return plan;
  }

  async createVtuTransaction(data: InsertVtuTransaction): Promise<VtuTransaction> {
    const [transaction] = await db.insert(vtuTransactions).values(data).returning();
    return transaction;
  }

  async updateVtuTransaction(id: string, data: Partial<VtuTransaction>): Promise<VtuTransaction> {
    const [updated] = await db
      .update(vtuTransactions)
      .set({ ...data })
      .where(eq(vtuTransactions.id, id))
      .returning();
    return updated;
  }

  async getUserVtuTransactions(userId: string, filters?: { status?: string; network?: string; startDate?: Date; endDate?: Date }): Promise<VtuTransaction[]> {
    const conditions = [eq(vtuTransactions.userId, userId)];
    
    if (filters?.status) {
      conditions.push(eq(vtuTransactions.status, filters.status as any));
    }
    if (filters?.network) {
      conditions.push(eq(vtuTransactions.network, filters.network as any));
    }
    if (filters?.startDate) {
      conditions.push(sql`${vtuTransactions.createdAt} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${vtuTransactions.createdAt} <= ${filters.endDate}`);
    }
    
    return await db
      .select()
      .from(vtuTransactions)
      .where(and(...conditions))
      .orderBy(desc(vtuTransactions.createdAt));
  }

  // VTU Beneficiaries operations
  async getUserBeneficiaries(userId: string): Promise<VtuBeneficiary[]> {
    return await db
      .select()
      .from(vtuBeneficiaries)
      .where(eq(vtuBeneficiaries.userId, userId))
      .orderBy(desc(vtuBeneficiaries.lastUsed), desc(vtuBeneficiaries.usageCount));
  }

  async getBeneficiary(id: string): Promise<VtuBeneficiary | undefined> {
    const [beneficiary] = await db
      .select()
      .from(vtuBeneficiaries)
      .where(eq(vtuBeneficiaries.id, id));
    return beneficiary;
  }

  async createBeneficiary(data: InsertVtuBeneficiary): Promise<VtuBeneficiary> {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await db
        .update(vtuBeneficiaries)
        .set({ isDefault: false })
        .where(eq(vtuBeneficiaries.userId, data.userId));
    }
    
    const [beneficiary] = await db
      .insert(vtuBeneficiaries)
      .values(data)
      .returning();
    return beneficiary;
  }

  async updateBeneficiary(id: string, data: Partial<VtuBeneficiary>): Promise<VtuBeneficiary> {
    const [updated] = await db
      .update(vtuBeneficiaries)
      .set(data)
      .where(eq(vtuBeneficiaries.id, id))
      .returning();
    return updated;
  }

  async deleteBeneficiary(id: string): Promise<void> {
    await db
      .delete(vtuBeneficiaries)
      .where(eq(vtuBeneficiaries.id, id));
  }

  async updateBeneficiaryUsage(id: string): Promise<void> {
    await db
      .update(vtuBeneficiaries)
      .set({ 
        lastUsed: new Date(),
        usageCount: sql`${vtuBeneficiaries.usageCount} + 1`
      })
      .where(eq(vtuBeneficiaries.id, id));
  }

  // User Settings operations
  async getOrCreateUserSettings(userId: string): Promise<UserSettings> {
    const [existing] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    
    if (existing) {
      return existing;
    }
    
    const [settings] = await db
      .insert(userSettings)
      .values({ userId })
      .returning();
    return settings;
  }

  async updateUserSettings(userId: string, data: Partial<UserSettings>): Promise<UserSettings> {
    const settings = await this.getOrCreateUserSettings(userId);
    
    const [updated] = await db
      .update(userSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(userSettings.id, settings.id))
      .returning();
    return updated;
  }

  async requestAccountDeletion(userId: string): Promise<UserSettings> {
    const settings = await this.getOrCreateUserSettings(userId);
    const now = new Date();
    const scheduledFor = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    const [updated] = await db
      .update(userSettings)
      .set({
        deletionRequestedAt: now,
        deletionScheduledFor: scheduledFor,
        deletionCancelledAt: null,
        updatedAt: now,
      })
      .where(eq(userSettings.id, settings.id))
      .returning();
    return updated;
  }

  async cancelAccountDeletion(userId: string): Promise<UserSettings> {
    const settings = await this.getOrCreateUserSettings(userId);
    const now = new Date();
    
    const [updated] = await db
      .update(userSettings)
      .set({
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        deletionCancelledAt: now,
        updatedAt: now,
      })
      .where(eq(userSettings.id, settings.id))
      .returning();
    return updated;
  }

  // Sponsored Ads operations
  async getActiveSponsoredAds(type?: string): Promise<SponsoredAd[]> {
    const now = new Date();
    
    if (type) {
      return await db
        .select()
        .from(sponsoredAds)
        .where(
          and(
            eq(sponsoredAds.status, "active"),
            eq(sponsoredAds.type, type as any),
            or(
              sql`${sponsoredAds.startDate} IS NULL`,
              sql`${sponsoredAds.startDate} <= ${now}`
            ),
            or(
              sql`${sponsoredAds.endDate} IS NULL`,
              sql`${sponsoredAds.endDate} >= ${now}`
            ),
            sql`CAST(${sponsoredAds.spent} AS DECIMAL) < CAST(${sponsoredAds.budget} AS DECIMAL)`
          )
        )
        .orderBy(desc(sponsoredAds.createdAt));
    }
    
    return await db
      .select()
      .from(sponsoredAds)
      .where(
        and(
          eq(sponsoredAds.status, "active"),
          or(
            sql`${sponsoredAds.startDate} IS NULL`,
            sql`${sponsoredAds.startDate} <= ${now}`
          ),
          or(
            sql`${sponsoredAds.endDate} IS NULL`,
            sql`${sponsoredAds.endDate} >= ${now}`
          ),
          sql`CAST(${sponsoredAds.spent} AS DECIMAL) < CAST(${sponsoredAds.budget} AS DECIMAL)`
        )
      )
      .orderBy(desc(sponsoredAds.createdAt));
  }

  async createSponsoredAd(data: InsertSponsoredAd): Promise<SponsoredAd> {
    const [ad] = await db.insert(sponsoredAds).values(data).returning();
    return ad;
  }

  async recordAdImpression(adId: string): Promise<void> {
    await db
      .update(sponsoredAds)
      .set({
        impressions: sql`${sponsoredAds.impressions} + 1`,
        spent: sql`CAST(${sponsoredAds.spent} AS DECIMAL) + CAST(${sponsoredAds.costPerImpression} AS DECIMAL)`,
        updatedAt: new Date(),
      })
      .where(eq(sponsoredAds.id, adId));
  }

  async recordAdClick(adId: string): Promise<void> {
    await db
      .update(sponsoredAds)
      .set({
        clicks: sql`${sponsoredAds.clicks} + 1`,
        spent: sql`CAST(${sponsoredAds.spent} AS DECIMAL) + CAST(${sponsoredAds.costPerClick} AS DECIMAL)`,
        updatedAt: new Date(),
      })
      .where(eq(sponsoredAds.id, adId));
  }

  // Platform Settings operations
  async getAllPlatformSettings(): Promise<PlatformSetting[]> {
    return await db.select().from(platformSettings);
  }

  async getPlatformSetting(key: string): Promise<PlatformSetting | undefined> {
    const [setting] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key));
    return setting;
  }

  async updatePlatformSetting(key: string, value: string, updatedBy?: string): Promise<PlatformSetting> {
    const existing = await this.getPlatformSetting(key);
    
    if (existing) {
      const [updated] = await db
        .update(platformSettings)
        .set({ value, updatedAt: new Date(), updatedBy: updatedBy || null })
        .where(eq(platformSettings.key, key))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(platformSettings)
      .values({ key, value, updatedBy: updatedBy || null })
      .returning();
    return created;
  }

  // KYC Verification operations
  async createKycVerification(userId: string): Promise<KycVerification> {
    const existing = await this.getKycVerification(userId);
    if (existing) {
      return existing;
    }
    
    const [verification] = await db
      .insert(kycVerifications)
      .values({ userId })
      .returning();
    return verification;
  }

  async getKycVerification(userId: string): Promise<KycVerification | undefined> {
    const [verification] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.userId, userId))
      .orderBy(desc(kycVerifications.createdAt));
    return verification;
  }

  async getKycVerificationById(id: string): Promise<KycVerification | undefined> {
    const [verification] = await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.id, id));
    return verification;
  }

  async updateKycVerification(id: string, data: Partial<KycVerification>): Promise<KycVerification> {
    const [updated] = await db
      .update(kycVerifications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(kycVerifications.id, id))
      .returning();
    return updated;
  }

  async getPendingKycVerifications(): Promise<KycVerification[]> {
    return await db
      .select()
      .from(kycVerifications)
      .where(eq(kycVerifications.status, "manual_review"))
      .orderBy(kycVerifications.createdAt);
  }

  async createKycLog(data: {
    kycId: string;
    userId: string;
    action: string;
    result?: string;
    similarityScore?: number;
    reviewedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: any;
  }): Promise<void> {
    await db.insert(kycVerificationLogs).values({
      kycId: data.kycId,
      userId: data.userId,
      action: data.action,
      result: data.result,
      similarityScore: data.similarityScore?.toString(),
      reviewedBy: data.reviewedBy,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      metadata: data.metadata,
    });
  }

  // Scheduled VTU Purchases operations
  async getScheduledPurchases(userId: string): Promise<ScheduledVtuPurchase[]> {
    return await db
      .select()
      .from(scheduledVtuPurchases)
      .where(eq(scheduledVtuPurchases.userId, userId))
      .orderBy(desc(scheduledVtuPurchases.createdAt));
  }

  async getScheduledPurchase(id: string): Promise<ScheduledVtuPurchase | undefined> {
    const [purchase] = await db
      .select()
      .from(scheduledVtuPurchases)
      .where(eq(scheduledVtuPurchases.id, id));
    return purchase;
  }

  async createScheduledPurchase(data: InsertScheduledVtuPurchase): Promise<ScheduledVtuPurchase> {
    const [purchase] = await db
      .insert(scheduledVtuPurchases)
      .values(data)
      .returning();
    return purchase;
  }

  async updateScheduledPurchase(id: string, data: Partial<ScheduledVtuPurchase>): Promise<ScheduledVtuPurchase> {
    const [updated] = await db
      .update(scheduledVtuPurchases)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scheduledVtuPurchases.id, id))
      .returning();
    return updated;
  }

  async deleteScheduledPurchase(id: string): Promise<void> {
    await db.delete(scheduledVtuPurchases).where(eq(scheduledVtuPurchases.id, id));
  }

  // Gift Data operations
  async getGiftsByUser(userId: string): Promise<GiftData[]> {
    return await db
      .select()
      .from(giftData)
      .where(eq(giftData.senderId, userId))
      .orderBy(desc(giftData.createdAt));
  }

  async getGiftByCode(code: string): Promise<GiftData | undefined> {
    const [gift] = await db
      .select()
      .from(giftData)
      .where(eq(giftData.giftCode, code));
    return gift;
  }

  async createGiftData(data: InsertGiftData): Promise<GiftData> {
    const [gift] = await db
      .insert(giftData)
      .values(data)
      .returning();
    return gift;
  }

  async claimGiftData(giftId: string, claimerId: string): Promise<GiftData> {
    const [updated] = await db
      .update(giftData)
      .set({
        status: "claimed",
        recipientUserId: claimerId,
        claimedAt: new Date(),
      })
      .where(eq(giftData.id, giftId))
      .returning();
    return updated;
  }

  // Bill Payment operations
  async createBillPayment(data: InsertBillPayment): Promise<BillPayment> {
    const [payment] = await db
      .insert(billPayments)
      .values(data)
      .returning();
    return payment;
  }

  async updateBillPayment(id: string, data: Partial<BillPayment>): Promise<BillPayment> {
    const [updated] = await db
      .update(billPayments)
      .set(data)
      .where(eq(billPayments.id, id))
      .returning();
    return updated;
  }

  async getUserBillPayments(userId: string): Promise<BillPayment[]> {
    return await db
      .select()
      .from(billPayments)
      .where(eq(billPayments.userId, userId))
      .orderBy(desc(billPayments.createdAt));
  }

  // Story operations
  async createStory(data: { authorId: string; type: "image" | "video" | "text"; mediaUrl?: string; textContent?: string; backgroundColor?: string; fontStyle?: string }): Promise<Story> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const [story] = await db.insert(stories).values({
      ...data,
      expiresAt,
    }).returning();
    return story;
  }

  async getStory(id: string): Promise<(Story & { author: User }) | undefined> {
    const result = await db
      .select()
      .from(stories)
      .innerJoin(users, eq(stories.authorId, users.id))
      .where(eq(stories.id, id));
    
    if (!result.length) return undefined;
    return { ...result[0].stories, author: result[0].users };
  }

  async getActiveStories(userId: string): Promise<(Story & { author: User; hasViewed: boolean })[]> {
    const now = new Date();
    
    const followedUserIds = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, userId));
    
    const followedIds = followedUserIds.map(f => f.followingId);
    followedIds.push(userId);
    
    if (followedIds.length === 0) {
      return [];
    }
    
    const activeStories = await db
      .select()
      .from(stories)
      .innerJoin(users, eq(stories.authorId, users.id))
      .leftJoin(storyViews, and(
        eq(storyViews.storyId, stories.id),
        eq(storyViews.viewerId, userId)
      ))
      .where(and(
        gt(stories.expiresAt, now),
        sql`${stories.authorId} IN (${sql.join(followedIds.map(id => sql`${id}`), sql`, `)})`
      ))
      .orderBy(desc(stories.createdAt));
    
    return activeStories.map(row => ({
      ...row.stories,
      author: row.users,
      hasViewed: row.story_views !== null,
    }));
  }

  async getUserActiveStories(userId: string): Promise<(Story & { author: User })[]> {
    const now = new Date();
    
    const activeStories = await db
      .select()
      .from(stories)
      .innerJoin(users, eq(stories.authorId, users.id))
      .where(and(
        eq(stories.authorId, userId),
        gt(stories.expiresAt, now)
      ))
      .orderBy(desc(stories.createdAt));
    
    return activeStories.map(row => ({
      ...row.stories,
      author: row.users,
    }));
  }

  async deleteStory(id: string): Promise<void> {
    await db.delete(stories).where(eq(stories.id, id));
  }

  async viewStory(storyId: string, viewerId: string): Promise<StoryView> {
    const existing = await db
      .select()
      .from(storyViews)
      .where(and(
        eq(storyViews.storyId, storyId),
        eq(storyViews.viewerId, viewerId)
      ));
    
    if (existing.length > 0) {
      return existing[0];
    }
    
    const [view] = await db.insert(storyViews).values({
      storyId,
      viewerId,
    }).returning();
    
    await this.incrementStoryViews(storyId);
    
    return view;
  }

  async hasViewedStory(storyId: string, viewerId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(storyViews)
      .where(and(
        eq(storyViews.storyId, storyId),
        eq(storyViews.viewerId, viewerId)
      ));
    return result.length > 0;
  }

  async getStoryViews(storyId: string): Promise<(StoryView & { viewer: User })[]> {
    const views = await db
      .select()
      .from(storyViews)
      .innerJoin(users, eq(storyViews.viewerId, users.id))
      .where(eq(storyViews.storyId, storyId))
      .orderBy(desc(storyViews.viewedAt));
    
    return views.map(row => ({
      ...row.story_views,
      viewer: row.users,
    }));
  }

  async reactToStory(storyId: string, reactorId: string, reaction: string): Promise<StoryReaction> {
    const existing = await db
      .select()
      .from(storyReactions)
      .where(and(
        eq(storyReactions.storyId, storyId),
        eq(storyReactions.reactorId, reactorId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db
        .update(storyReactions)
        .set({ reaction })
        .where(eq(storyReactions.id, existing[0].id))
        .returning();
      return updated;
    }
    
    const [reactionRecord] = await db.insert(storyReactions).values({
      storyId,
      reactorId,
      reaction,
    }).returning();
    
    await this.incrementStoryLikes(storyId);
    
    return reactionRecord;
  }

  async getStoryReactions(storyId: string): Promise<(StoryReaction & { reactor: User })[]> {
    const reactions = await db
      .select()
      .from(storyReactions)
      .innerJoin(users, eq(storyReactions.reactorId, users.id))
      .where(eq(storyReactions.storyId, storyId))
      .orderBy(desc(storyReactions.createdAt));
    
    return reactions.map(row => ({
      ...row.story_reactions,
      reactor: row.users,
    }));
  }

  async replyToStory(storyId: string, senderId: string, content: string): Promise<StoryReply> {
    const [reply] = await db.insert(storyReplies).values({
      storyId,
      senderId,
      content,
    }).returning();
    return reply;
  }

  async getStoryReplies(storyId: string): Promise<(StoryReply & { sender: User })[]> {
    const replies = await db
      .select()
      .from(storyReplies)
      .innerJoin(users, eq(storyReplies.senderId, users.id))
      .where(eq(storyReplies.storyId, storyId))
      .orderBy(desc(storyReplies.createdAt));
    
    return replies.map(row => ({
      ...row.story_replies,
      sender: row.users,
    }));
  }

  async getUsersWithActiveStories(currentUserId: string): Promise<{ user: User; storyCount: number; hasUnviewed: boolean; latestStoryAt: Date }[]> {
    const now = new Date();
    
    const followedUserIds = await db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(eq(follows.followerId, currentUserId));
    
    const followedIds = followedUserIds.map(f => f.followingId);
    followedIds.push(currentUserId);
    
    if (followedIds.length === 0) {
      return [];
    }
    
    const usersWithStories = await db
      .select({
        user: users,
        storyCount: sql<number>`count(distinct ${stories.id})::int`,
        unviewedCount: sql<number>`count(distinct case when ${storyViews.id} is null then ${stories.id} end)::int`,
        latestStoryAt: sql<Date>`max(${stories.createdAt})`,
      })
      .from(users)
      .innerJoin(stories, and(
        eq(stories.authorId, users.id),
        gt(stories.expiresAt, now)
      ))
      .leftJoin(storyViews, and(
        eq(storyViews.storyId, stories.id),
        eq(storyViews.viewerId, currentUserId)
      ))
      .where(sql`${users.id} IN (${sql.join(followedIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(users.id)
      .orderBy(sql`max(${stories.createdAt}) desc`);
    
    return usersWithStories.map(row => ({
      user: row.user,
      storyCount: row.storyCount,
      hasUnviewed: row.unviewedCount > 0,
      latestStoryAt: row.latestStoryAt,
    }));
  }

  async incrementStoryViews(storyId: string): Promise<void> {
    await db
      .update(stories)
      .set({ viewsCount: sql`${stories.viewsCount} + 1` })
      .where(eq(stories.id, storyId));
  }

  async incrementStoryLikes(storyId: string): Promise<void> {
    await db
      .update(stories)
      .set({ likesCount: sql`${stories.likesCount} + 1` })
      .where(eq(stories.id, storyId));
  }

  async decrementStoryLikes(storyId: string): Promise<void> {
    await db
      .update(stories)
      .set({ likesCount: sql`GREATEST(${stories.likesCount} - 1, 0)` })
      .where(eq(stories.id, storyId));
  }

  // Confession operations
  async createConfession(data: { authorId?: string; content: string; category?: string; isAnonymous?: boolean }): Promise<Confession> {
    const [confession] = await db.insert(confessions).values({
      authorId: data.authorId || null,
      content: data.content,
      category: data.category || "general",
      isAnonymous: data.isAnonymous ?? true,
      status: "pending",
    }).returning();
    return confession;
  }

  async getConfession(id: string): Promise<(Confession & { author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null }) | undefined> {
    const result = await db
      .select()
      .from(confessions)
      .leftJoin(users, eq(confessions.authorId, users.id))
      .where(eq(confessions.id, id));
    
    if (result.length === 0) return undefined;
    
    const confession = result[0].confessions;
    const author = result[0].users;
    
    if (confession.isAnonymous || !author) {
      return { ...confession, author: null };
    }
    
    return {
      ...confession,
      author: {
        id: author.id,
        firstName: author.firstName,
        lastName: author.lastName,
        profileImageUrl: author.profileImageUrl,
      },
    };
  }

  async getConfessions(options?: { category?: string; status?: string; page?: number; limit?: number }): Promise<{ confessions: Confession[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const offset = (page - 1) * limit;
    
    let conditions = [];
    
    if (options?.category && options.category !== 'all') {
      conditions.push(eq(confessions.category, options.category));
    }
    
    if (options?.status) {
      conditions.push(sql`${confessions.status} = ${options.status}`);
    } else {
      conditions.push(sql`${confessions.status} = 'approved'`);
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(confessions)
      .where(whereClause);
    
    const confessionList = await db
      .select()
      .from(confessions)
      .where(whereClause)
      .orderBy(desc(confessions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return {
      confessions: confessionList,
      total: countResult?.count || 0,
    };
  }

  async getTrendingConfessions(limit: number = 10): Promise<Confession[]> {
    return await db
      .select()
      .from(confessions)
      .where(and(
        sql`${confessions.status} = 'approved'`,
        eq(confessions.isTrending, true)
      ))
      .orderBy(desc(sql`${confessions.likesCount} + ${confessions.commentsCount}`))
      .limit(limit);
  }

  async deleteConfession(id: string): Promise<void> {
    await db.delete(confessions).where(eq(confessions.id, id));
  }

  async approveConfession(id: string, moderatedBy: string): Promise<Confession> {
    const [updated] = await db
      .update(confessions)
      .set({ 
        status: "approved",
        moderatedBy,
        moderatedAt: new Date(),
      })
      .where(eq(confessions.id, id))
      .returning();
    return updated;
  }

  async rejectConfession(id: string, moderatedBy: string): Promise<Confession> {
    const [updated] = await db
      .update(confessions)
      .set({ 
        status: "rejected",
        moderatedBy,
        moderatedAt: new Date(),
      })
      .where(eq(confessions.id, id))
      .returning();
    return updated;
  }

  async flagConfession(id: string): Promise<Confession> {
    const [updated] = await db
      .update(confessions)
      .set({ status: "flagged" })
      .where(eq(confessions.id, id))
      .returning();
    return updated;
  }

  async autoApproveOldConfessions(): Promise<number> {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const result = await db
      .update(confessions)
      .set({ status: "approved" })
      .where(and(
        sql`${confessions.status} = 'pending'`,
        sql`${confessions.createdAt} < ${fiveMinutesAgo}`
      ))
      .returning();
    
    return result.length;
  }

  // Confession vote operations
  async voteConfession(confessionId: string, voterId: string, voteType: 'like' | 'dislike'): Promise<ConfessionVote> {
    const existing = await this.getUserVote(confessionId, voterId);
    
    if (existing) {
      if (existing.voteType === voteType) {
        throw new Error("Already voted with this type");
      }
      
      await db.delete(confessionVotes).where(eq(confessionVotes.id, existing.id));
      
      if (existing.voteType === 'like') {
        await db.update(confessions).set({ 
          likesCount: sql`GREATEST(${confessions.likesCount} - 1, 0)` 
        }).where(eq(confessions.id, confessionId));
      } else {
        await db.update(confessions).set({ 
          dislikesCount: sql`GREATEST(${confessions.dislikesCount} - 1, 0)` 
        }).where(eq(confessions.id, confessionId));
      }
    }
    
    const [vote] = await db.insert(confessionVotes).values({
      confessionId,
      voterId,
      voteType,
    }).returning();
    
    if (voteType === 'like') {
      await db.update(confessions).set({ 
        likesCount: sql`${confessions.likesCount} + 1` 
      }).where(eq(confessions.id, confessionId));
      
      const [confession] = await db.select().from(confessions).where(eq(confessions.id, confessionId));
      if (confession && (confession.likesCount || 0) >= 5) {
        await db.update(confessions).set({ isTrending: true }).where(eq(confessions.id, confessionId));
      }
    } else {
      await db.update(confessions).set({ 
        dislikesCount: sql`${confessions.dislikesCount} + 1` 
      }).where(eq(confessions.id, confessionId));
    }
    
    return vote;
  }

  async removeVote(confessionId: string, voterId: string): Promise<void> {
    const existing = await this.getUserVote(confessionId, voterId);
    
    if (existing) {
      await db.delete(confessionVotes).where(eq(confessionVotes.id, existing.id));
      
      if (existing.voteType === 'like') {
        await db.update(confessions).set({ 
          likesCount: sql`GREATEST(${confessions.likesCount} - 1, 0)` 
        }).where(eq(confessions.id, confessionId));
      } else {
        await db.update(confessions).set({ 
          dislikesCount: sql`GREATEST(${confessions.dislikesCount} - 1, 0)` 
        }).where(eq(confessions.id, confessionId));
      }
    }
  }

  async getUserVote(confessionId: string, voterId: string): Promise<ConfessionVote | undefined> {
    const [vote] = await db
      .select()
      .from(confessionVotes)
      .where(and(
        eq(confessionVotes.confessionId, confessionId),
        eq(confessionVotes.voterId, voterId)
      ));
    return vote;
  }

  // Confession comment operations
  async getConfessionComments(confessionId: string): Promise<(ConfessionComment & { author?: { id: string; firstName: string | null; lastName: string | null; profileImageUrl: string | null } | null })[]> {
    const result = await db
      .select()
      .from(confessionComments)
      .leftJoin(users, eq(confessionComments.authorId, users.id))
      .where(eq(confessionComments.confessionId, confessionId))
      .orderBy(desc(confessionComments.createdAt));
    
    return result.map(row => {
      const comment = row.confession_comments;
      const author = row.users;
      
      if (comment.isAnonymous || !author) {
        return { ...comment, author: null };
      }
      
      return {
        ...comment,
        author: {
          id: author.id,
          firstName: author.firstName,
          lastName: author.lastName,
          profileImageUrl: author.profileImageUrl,
        },
      };
    });
  }

  async createConfessionComment(data: { confessionId: string; authorId?: string; content: string; isAnonymous?: boolean; parentId?: string }): Promise<ConfessionComment> {
    const [comment] = await db.insert(confessionComments).values({
      confessionId: data.confessionId,
      authorId: data.authorId || null,
      content: data.content,
      isAnonymous: data.isAnonymous ?? false,
      parentId: data.parentId || null,
    }).returning();
    
    await db.update(confessions).set({
      commentsCount: sql`${confessions.commentsCount} + 1`
    }).where(eq(confessions.id, data.confessionId));
    
    return comment;
  }

  async deleteConfessionComment(id: string): Promise<void> {
    const [comment] = await db.select().from(confessionComments).where(eq(confessionComments.id, id));
    
    if (comment) {
      await db.delete(confessionComments).where(eq(confessionComments.id, id));
      
      await db.update(confessions).set({
        commentsCount: sql`GREATEST(${confessions.commentsCount} - 1, 0)`
      }).where(eq(confessions.id, comment.confessionId));
    }
  }

  // Confession report operations
  async createConfessionReport(data: { confessionId: string; reporterId: string; reason: string; description?: string }): Promise<any> {
    const [report] = await db.insert(confessionReports).values({
      confessionId: data.confessionId,
      reporterId: data.reporterId,
      reason: data.reason,
      description: data.description || null,
    }).returning();
    
    const [reportsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(confessionReports)
      .where(eq(confessionReports.confessionId, data.confessionId));
    
    if ((reportsCount?.count || 0) >= 3) {
      await this.flagConfession(data.confessionId);
    }
    
    return report;
  }

  async getConfessionReports(confessionId: string): Promise<any[]> {
    return await db
      .select()
      .from(confessionReports)
      .where(eq(confessionReports.confessionId, confessionId))
      .orderBy(desc(confessionReports.createdAt));
  }

  // =====================================================
  // COMMUNITY OPERATIONS
  // =====================================================

  async createCommunity(data: { name: string; slug: string; description?: string; iconUrl?: string; coverUrl?: string; type?: "public" | "private" | "invite_only"; category?: string; rules?: string[]; ownerId: string }): Promise<Community> {
    const [community] = await db.insert(communities).values({
      name: data.name,
      slug: data.slug.toLowerCase(),
      description: data.description || null,
      iconUrl: data.iconUrl || null,
      coverUrl: data.coverUrl || null,
      type: data.type || "public",
      category: data.category || null,
      rules: data.rules || [],
      ownerId: data.ownerId,
      membersCount: 1,
    }).returning();

    await db.insert(communityMembers).values({
      communityId: community.id,
      userId: data.ownerId,
      role: "owner",
    });

    return community;
  }

  async getCommunity(id: string): Promise<(Community & { owner: User }) | undefined> {
    const result = await db
      .select()
      .from(communities)
      .innerJoin(users, eq(communities.ownerId, users.id))
      .where(eq(communities.id, id));

    if (result.length === 0) return undefined;
    return { ...result[0].communities, owner: result[0].users };
  }

  async getCommunityBySlug(slug: string): Promise<(Community & { owner: User }) | undefined> {
    const result = await db
      .select()
      .from(communities)
      .innerJoin(users, eq(communities.ownerId, users.id))
      .where(eq(communities.slug, slug.toLowerCase()));

    if (result.length === 0) return undefined;
    return { ...result[0].communities, owner: result[0].users };
  }

  async getPublicCommunities(): Promise<(Community & { owner: User })[]> {
    const result = await db
      .select()
      .from(communities)
      .innerJoin(users, eq(communities.ownerId, users.id))
      .where(and(
        eq(communities.isActive, true),
        eq(communities.type, "public")
      ))
      .orderBy(desc(communities.membersCount));

    return result.map(row => ({ ...row.communities, owner: row.users }));
  }

  async getUserJoinedCommunities(userId: string): Promise<(Community & { owner: User; membership: CommunityMember })[]> {
    const result = await db
      .select()
      .from(communities)
      .innerJoin(users, eq(communities.ownerId, users.id))
      .innerJoin(communityMembers, eq(communities.id, communityMembers.communityId))
      .where(and(
        eq(communityMembers.userId, userId),
        eq(communityMembers.isBanned, false)
      ))
      .orderBy(desc(communityMembers.joinedAt));

    return result.map(row => ({
      ...row.communities,
      owner: row.users,
      membership: row.community_members,
    }));
  }

  async updateCommunity(id: string, data: Partial<Community>): Promise<Community> {
    const [community] = await db
      .update(communities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(communities.id, id))
      .returning();
    return community;
  }

  async deleteCommunity(id: string): Promise<void> {
    await db.delete(communities).where(eq(communities.id, id));
  }

  // Community member operations
  async joinCommunity(communityId: string, userId: string): Promise<CommunityMember> {
    const [member] = await db.insert(communityMembers).values({
      communityId,
      userId,
      role: "member",
    }).returning();

    await db.update(communities)
      .set({ membersCount: sql`${communities.membersCount} + 1` })
      .where(eq(communities.id, communityId));

    return member;
  }

  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    await db.delete(communityMembers).where(and(
      eq(communityMembers.communityId, communityId),
      eq(communityMembers.userId, userId)
    ));

    await db.update(communities)
      .set({ membersCount: sql`GREATEST(${communities.membersCount} - 1, 0)` })
      .where(eq(communities.id, communityId));
  }

  async getCommunityMember(communityId: string, userId: string): Promise<CommunityMember | undefined> {
    const [member] = await db
      .select()
      .from(communityMembers)
      .where(and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      ));
    return member;
  }

  async getCommunityMembers(communityId: string): Promise<(CommunityMember & { user: User })[]> {
    const result = await db
      .select()
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(communityMembers.joinedAt);

    return result.map(row => ({ ...row.community_members, user: row.users }));
  }

  async updateMemberRole(communityId: string, userId: string, role: "member" | "moderator" | "admin" | "owner"): Promise<CommunityMember> {
    const [member] = await db
      .update(communityMembers)
      .set({ role })
      .where(and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      ))
      .returning();
    return member;
  }

  async banMember(communityId: string, userId: string, reason: string, until?: Date): Promise<CommunityMember> {
    const [member] = await db
      .update(communityMembers)
      .set({ isBanned: true, banReason: reason, bannedUntil: until || null })
      .where(and(
        eq(communityMembers.communityId, communityId),
        eq(communityMembers.userId, userId)
      ))
      .returning();
    return member;
  }

  // Community post operations
  async createCommunityPost(data: { communityId: string; authorId: string; title?: string; content: string; images?: string[] }): Promise<CommunityPost> {
    const [post] = await db.insert(communityPosts).values({
      communityId: data.communityId,
      authorId: data.authorId,
      title: data.title || null,
      content: data.content,
      images: data.images || [],
    }).returning();

    await db.update(communities)
      .set({ postsCount: sql`${communities.postsCount} + 1` })
      .where(eq(communities.id, data.communityId));

    return post;
  }

  async getCommunityPost(id: string): Promise<(CommunityPost & { author: User; community: Community }) | undefined> {
    const result = await db
      .select()
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.authorId, users.id))
      .innerJoin(communities, eq(communityPosts.communityId, communities.id))
      .where(eq(communityPosts.id, id));

    if (result.length === 0) return undefined;
    return { ...result[0].community_posts, author: result[0].users, community: result[0].communities };
  }

  async getCommunityPosts(communityId: string): Promise<(CommunityPost & { author: User; isLiked?: boolean })[]> {
    const result = await db
      .select()
      .from(communityPosts)
      .innerJoin(users, eq(communityPosts.authorId, users.id))
      .where(eq(communityPosts.communityId, communityId))
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt));

    return result.map(row => ({ ...row.community_posts, author: row.users }));
  }

  async updateCommunityPost(id: string, data: Partial<CommunityPost>): Promise<CommunityPost> {
    const [post] = await db
      .update(communityPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(communityPosts.id, id))
      .returning();
    return post;
  }

  async deleteCommunityPost(id: string): Promise<void> {
    const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, id));
    
    if (post) {
      await db.delete(communityPosts).where(eq(communityPosts.id, id));
      await db.update(communities)
        .set({ postsCount: sql`GREATEST(${communities.postsCount} - 1, 0)` })
        .where(eq(communities.id, post.communityId));
    }
  }

  async pinPost(id: string, isPinned: boolean): Promise<CommunityPost> {
    const [post] = await db
      .update(communityPosts)
      .set({ isPinned })
      .where(eq(communityPosts.id, id))
      .returning();
    return post;
  }

  async lockPost(id: string, isLocked: boolean): Promise<CommunityPost> {
    const [post] = await db
      .update(communityPosts)
      .set({ isLocked })
      .where(eq(communityPosts.id, id))
      .returning();
    return post;
  }

  // Community post like operations
  async likeCommunityPost(postId: string, userId: string): Promise<CommunityPostLike> {
    const existing = await this.hasLikedCommunityPost(postId, userId);
    if (existing) {
      throw new Error("Already liked this post");
    }

    const [like] = await db.insert(communityPostLikes).values({
      postId,
      userId,
    }).returning();

    await db.update(communityPosts)
      .set({ likesCount: sql`${communityPosts.likesCount} + 1` })
      .where(eq(communityPosts.id, postId));

    return like;
  }

  async unlikeCommunityPost(postId: string, userId: string): Promise<void> {
    await db.delete(communityPostLikes).where(and(
      eq(communityPostLikes.postId, postId),
      eq(communityPostLikes.userId, userId)
    ));

    await db.update(communityPosts)
      .set({ likesCount: sql`GREATEST(${communityPosts.likesCount} - 1, 0)` })
      .where(eq(communityPosts.id, postId));
  }

  async hasLikedCommunityPost(postId: string, userId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(communityPostLikes)
      .where(and(
        eq(communityPostLikes.postId, postId),
        eq(communityPostLikes.userId, userId)
      ));
    return !!like;
  }

  // Community post comment operations
  async createCommunityPostComment(data: { postId: string; authorId: string; content: string; parentId?: string }): Promise<CommunityPostComment> {
    const [comment] = await db.insert(communityPostComments).values({
      postId: data.postId,
      authorId: data.authorId,
      content: data.content,
      parentId: data.parentId || null,
    }).returning();

    await db.update(communityPosts)
      .set({ commentsCount: sql`${communityPosts.commentsCount} + 1` })
      .where(eq(communityPosts.id, data.postId));

    return comment;
  }

  async getCommunityPostComments(postId: string): Promise<(CommunityPostComment & { author: User })[]> {
    const result = await db
      .select()
      .from(communityPostComments)
      .innerJoin(users, eq(communityPostComments.authorId, users.id))
      .where(eq(communityPostComments.postId, postId))
      .orderBy(communityPostComments.createdAt);

    return result.map(row => ({ ...row.community_post_comments, author: row.users }));
  }

  async deleteCommunityPostComment(id: string): Promise<void> {
    const [comment] = await db.select().from(communityPostComments).where(eq(communityPostComments.id, id));
    
    if (comment) {
      await db.delete(communityPostComments).where(eq(communityPostComments.id, id));
      await db.update(communityPosts)
        .set({ commentsCount: sql`GREATEST(${communityPosts.commentsCount} - 1, 0)` })
        .where(eq(communityPosts.id, comment.postId));
    }
  }
}

export const storage = new DatabaseStorage();
