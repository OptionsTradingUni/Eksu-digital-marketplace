import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User roles enum - Users can choose buyer, seller, both, or admin
export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "both", "admin"]);

// User storage table (email/password authentication with marketplace features)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password"), // Hashed password using bcrypt (nullable for migration from OAuth users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username", { length: 30 }).unique(), // @username for mentions and profile URLs
  profileImageUrl: varchar("profile_image_url"),
  coverImageUrl: varchar("cover_image_url"), // Profile cover/banner image
  role: userRoleEnum("role").notNull().default("buyer"),
  // Referral code - unique 8-character alphanumeric code for sharing
  referralCode: varchar("referral_code", { length: 8 }).unique(),
  // Campus-specific fields
  phoneNumber: varchar("phone_number").unique(), // UNIQUE - one account per phone
  location: varchar("location"), // Campus area/hostel
  latitude: decimal("latitude", { precision: 10, scale: 7 }), // GPS coordinates for real-time location
  longitude: decimal("longitude", { precision: 10, scale: 7 }), // GPS coordinates for real-time location
  lastLocationUpdate: timestamp("last_location_update"), // When location was last updated
  bio: text("bio"),
  gender: varchar("gender", { length: 20 }), // Optional: "male", "female", "other", "prefer_not_to_say"
  // System account flags
  isSystemAccount: boolean("is_system_account").default(false), // @EKSUPlug official bot
  systemAccountType: varchar("system_account_type", { length: 20 }), // "official_bot", "support", etc
  // Verification fields
  isVerified: boolean("is_verified").default(false),
  verificationBadges: text("verification_badges").array().default(sql`ARRAY[]::text[]`), // ["email", "phone", "student_id", "nin"]
  ninVerified: boolean("nin_verified").default(false),
  ninVerificationDate: timestamp("nin_verification_date"),
  ninHash: varchar("nin_hash").unique(), // Hashed NIN (NOT the actual NIN - illegal to store)
  ninVnin: varchar("nin_vnin"), // Virtual NIN token from verification provider (Korapay/Dojah)
  ninConfidenceScore: decimal("nin_confidence_score", { precision: 5, scale: 2 }), // Selfie match confidence
  // Social media links
  instagramHandle: varchar("instagram_handle"),
  tiktokHandle: varchar("tiktok_handle"),
  facebookProfile: varchar("facebook_profile"),
  // Trust score
  trustScore: decimal("trust_score", { precision: 3, scale: 1 }).default("5.0"),
  totalRatings: integer("total_ratings").default(0),
  isTrustedSeller: boolean("is_trusted_seller").default(false), // Manually set by admin
  trustedSellerSince: timestamp("trusted_seller_since"),
  // Seller-specific
  totalSales: integer("total_sales").default(0),
  responseTime: integer("response_time"), // Average response time in minutes
  // Seller verification documents (manual admin process)
  studentIdImage: text("student_id_image"), // URL to uploaded student ID photo
  selfieImage: text("selfie_image"), // URL to uploaded selfie for verification
  verificationRequestedAt: timestamp("verification_requested_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  verificationReviewedBy: varchar("verification_reviewed_by"), // Admin user ID who reviewed
  verificationNotes: text("verification_notes"), // Admin notes on verification
  // Account status
  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  emailVerified: boolean("email_verified").default(false),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User photos gallery table
export const userPhotos = pgTable("user_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  imageUrl: varchar("image_url", { length: 500 }).notNull(),
  isProfilePhoto: boolean("is_profile_photo").default(false),
  sortOrder: integer("sort_order").default(0),
  caption: varchar("caption", { length: 200 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_photos_user_idx").on(table.userId),
  index("user_photos_sort_idx").on(table.userId, table.sortOrder),
]);

export const insertUserPhotoSchema = createInsertSchema(userPhotos).omit({
  id: true,
  createdAt: true,
});

export const addUserPhotoSchema = z.object({
  caption: z.string().max(200).optional(),
});

export const reorderPhotosSchema = z.object({
  photoIds: z.array(z.string()).min(1).max(6),
});

export type UserPhoto = typeof userPhotos.$inferSelect;
export type InsertUserPhoto = z.infer<typeof insertUserPhotoSchema>;

// Product categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull().unique(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  icon: varchar("icon"), // Lucide icon name
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Product condition enum
export const productConditionEnum = pgEnum("product_condition", ["new", "like_new", "good", "fair"]);

// Products/Listings
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }), // Original price before discount
  isOnSale: boolean("is_on_sale").default(false), // Whether the product is on sale
  images: text("images").array().notNull().default(sql`ARRAY[]::text[]`), // Array of image URLs
  condition: productConditionEnum("condition").notNull().default("good"),
  location: varchar("location"), // Campus area
  // Status
  isAvailable: boolean("is_available").default(true),
  isSold: boolean("is_sold").default(false),
  isFeatured: boolean("is_featured").default(false),
  isBoosted: boolean("is_boosted").default(false),
  boostedUntil: timestamp("boosted_until"),
  // Moderation
  isApproved: boolean("is_approved").default(true),
  isFlagged: boolean("is_flagged").default(false),
  flagReason: text("flag_reason"),
  // Analytics
  views: integer("views").default(0),
  watchers: integer("watchers").default(0),
  inquiries: integer("inquiries").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Product views tracking for unique view counts
export const productViews = pgTable("product_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull(), // User ID for logged-in users, or hashed IP+session for guests
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("product_views_product_viewer_idx").on(table.productId, table.viewerId),
  index("product_views_product_idx").on(table.productId),
]);

// Cart items table
export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("cart_user_product_idx").on(table.userId, table.productId),
]);

// Messages for real-time chat
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }), // Optional context
  content: text("content").notNull(),
  imageUrl: varchar("image_url", { length: 500 }), // Optional attachment image URL
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reviews and ratings
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewedUserId: varchar("reviewed_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reports for flagging scams/inappropriate content
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportedUserId: varchar("reported_user_id").references(() => users.id, { onDelete: "cascade" }),
  reportedProductId: varchar("reported_product_id").references(() => products.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending"), // pending, reviewed, resolved
  createdAt: timestamp("created_at").defaultNow(),
});

// Watchlist/Favorites
export const watchlist = pgTable("watchlist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Wallet system for virtual currency
export const wallets = pgTable("wallets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  balance: decimal("balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  escrowBalance: decimal("escrow_balance", { precision: 10, scale: 2 }).default("0.00").notNull(),
  securityDepositLocked: decimal("security_deposit_locked", { precision: 10, scale: 2 }).default("0.00").notNull(), // Locked seller deposit
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction types
export const transactionTypeEnum = pgEnum("transaction_type", [
  "welcome_bonus", "referral_bonus", "login_reward", "deposit", "sale", "purchase", 
  "boost_payment", "featured_payment", "escrow_hold", "escrow_release", "escrow_fee",
  "refund", "withdrawal", "agent_commission", "platform_fee", "security_deposit_lock",
  "security_deposit_unlock", "negotiation_accepted", "payment_fee"
]);

// Wallet transactions
export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  walletId: varchar("wallet_id").notNull().references(() => wallets.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  relatedProductId: varchar("related_product_id").references(() => products.id, { onDelete: "set null" }),
  relatedUserId: varchar("related_user_id").references(() => users.id, { onDelete: "set null" }),
  status: varchar("status", { length: 20 }).default("completed"), // pending, completed, failed, refunded
  createdAt: timestamp("created_at").defaultNow(),
});

// Referral system
export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredUserId: varchar("referred_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }), // Will be randomized ₦2-50 when paid
  bonusPaid: boolean("bonus_paid").default(false),
  referredUserMadePurchase: boolean("referred_user_made_purchase").default(false), // Track if they bought anything
  firstPurchaseId: varchar("first_purchase_id"), // ID of their first purchase
  bonusPaidAt: timestamp("bonus_paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Welcome bonuses tracking
export const welcomeBonuses = pgTable("welcome_bonuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  claimed: boolean("claimed").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Search history for users
export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  query: varchar("query", { length: 200 }).notNull(),
  filters: jsonb("filters"), // Store filter state
  resultCount: integer("result_count"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Saved searches with price alerts
export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: varchar("query", { length: 200 }).notNull(),
  filters: jsonb("filters"),
  maxPrice: decimal("max_price", { precision: 10, scale: 2 }),
  alertEnabled: boolean("alert_enabled").default(true),
  lastAlertSent: timestamp("last_alert_sent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Draft listings
export const draftProducts = pgTable("draft_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(), // Store full product data as JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Scheduled posts
export const scheduledPosts = pgTable("scheduled_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productData: jsonb("product_data").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  published: boolean("published").default(false),
  publishedProductId: varchar("published_product_id").references(() => products.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Voice posts for Nigerian language support
export const voicePosts = pgTable("voice_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audioUrl: text("audio_url"), // Path to audio file
  transcription: text("transcription"), // AI-generated text
  language: varchar("language", { length: 50 }), // pidgin, yoruba, igbo, hausa, english
  productId: varchar("product_id").references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Boost/Featured listing requests
export const boostRequests = pgTable("boost_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 20 }).notNull(), // boost, featured
  duration: integer("duration").notNull(), // hours
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, active, expired, cancelled
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Disputes and resolution center
export const disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence").array().default(sql`ARRAY[]::text[]`), // Photo URLs
  status: varchar("status", { length: 20 }).default("open"), // open, under_review, resolved, closed
  resolution: text("resolution"),
  resolvedBy: varchar("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

// Support tickets
export const supportTickets = pgTable("support_tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ticketNumber: varchar("ticket_number", { length: 20 }), // e.g., EKSU-00124
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }), // account, payment, technical, report, bug, suggestion
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  attachments: text("attachments").array().default(sql`ARRAY[]::text[]`), // Array of image URLs
  status: varchar("status", { length: 20 }).default("open"), // open, pending, in_progress, resolved, closed
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ticket replies - threaded conversation history
export const ticketReplies = pgTable("ticket_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ticketId: varchar("ticket_id").notNull().references(() => supportTickets.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isAdminReply: boolean("is_admin_reply").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("ticket_replies_ticket_idx").on(table.ticketId),
]);

// Login streak rewards
export const loginStreaks = pgTable("login_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastLoginDate: timestamp("last_login_date"),
  totalRewards: decimal("total_rewards", { precision: 10, scale: 2 }).default("0.00"),
  // Security enhancement columns
  lastIpAddress: varchar("last_ip_address"), // Track IP for suspicious activity detection
  dailyClaimHash: varchar("daily_claim_hash"), // Hash for replay attack prevention
  claimCount: integer("claim_count").default(0), // Total claims for abuse detection
  lastClaimAttempt: timestamp("last_claim_attempt"), // For rate limiting tracking
  suspiciousActivityCount: integer("suspicious_activity_count").default(0), // Track potential abuse
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Seller analytics
export const sellerAnalytics = pgTable("seller_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  totalViews: integer("total_views").default(0),
  totalMessages: integer("total_messages").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }).default("0.00"),
  bestPostingHour: integer("best_posting_hour"), // 0-23
  bestPostingDay: integer("best_posting_day"), // 0-6 (Sunday-Saturday)
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Follows - user following system
export const follows = pgTable("follows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_follower").on(table.followerId),
  index("idx_following").on(table.followingId),
]);

// Hostel listings (separate from products)
export const hostels = pgTable("hostels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  location: varchar("location").notNull(), // Campus area
  address: text("address"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(), // Per year
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  amenities: text("amenities").array().default(sql`ARRAY[]::text[]`), // ["wifi", "water", "security", etc]
  distanceFromCampus: decimal("distance_from_campus", { precision: 5, scale: 2 }), // In KM
  isAvailable: boolean("is_available").default(true),
  agentFee: decimal("agent_fee", { precision: 10, scale: 2 }), // Agent commission
  platformCommission: decimal("platform_commission", { precision: 5, scale: 2 }).default("5.00"), // % we take
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Event listings (concerts, parties, campus events)
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(), // concert, party, conference, workshop, etc
  bannerImage: text("banner_image"),
  venue: varchar("venue").notNull(),
  eventDate: timestamp("event_date").notNull(),
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }),
  isFree: boolean("is_free").default(false),
  totalTickets: integer("total_tickets"),
  ticketsSold: integer("tickets_sold").default(0),
  contactInfo: varchar("contact_info"),
  isActive: boolean("is_active").default(true),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Escrow status enum
export const escrowStatusEnum = pgEnum("escrow_status", [
  "pending", "held", "released", "refunded", "disputed"
]);

// Escrow transactions for buyer/seller safety
export const escrowTransactions = pgTable("escrow_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  hostelId: varchar("hostel_id").references(() => hostels.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull(), // 3-6% of amount
  status: escrowStatusEnum("status").notNull().default("pending"),
  holdDuration: integer("hold_duration").default(7), // Days to hold before auto-release
  releasedAt: timestamp("released_at"),
  disputeId: varchar("dispute_id").references(() => disputes.id, { onDelete: "set null" }),
  buyerConfirmed: boolean("buyer_confirmed").default(false),
  sellerConfirmed: boolean("seller_confirmed").default(false),
  autoReleaseDate: timestamp("auto_release_date"), // Calculated from hold_duration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Paystack payment records (legacy - keeping for backward compatibility)
export const paystackPayments = pgTable("paystack_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reference: varchar("reference").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN"),
  status: varchar("status", { length: 20 }).notNull(),
  channel: varchar("channel", { length: 20 }),
  paidAt: timestamp("paid_at"),
  metadata: jsonb("metadata"),
  purpose: varchar("purpose", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Squad payment records (primary payment provider - Habari)
export const squadPayments = pgTable("squad_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionReference: varchar("transaction_reference").notNull().unique(),
  gatewayReference: varchar("gateway_reference"),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  merchantAmount: decimal("merchant_amount", { precision: 10, scale: 2 }),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("0.00"),
  currency: varchar("currency", { length: 3 }).default("NGN"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, success, failed, abandoned
  paymentMethod: varchar("payment_method", { length: 30 }), // transfer, card, ussd, bank
  paymentDescription: text("payment_description"),
  paidAt: timestamp("paid_at"),
  metadata: jsonb("metadata"),
  purpose: varchar("purpose", { length: 50 }), // wallet_deposit, checkout_payment, boost_payment, etc
  customerEmail: varchar("customer_email"),
  customerName: varchar("customer_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Squad transfer records (for payouts to sellers/withdrawals)
export const squadTransfers = pgTable("squad_transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionReference: varchar("transaction_reference").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).default("0.00"),
  destinationBankCode: varchar("destination_bank_code").notNull(),
  destinationAccountNumber: varchar("destination_account_number").notNull(),
  destinationAccountName: varchar("destination_account_name"),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, success, failed
  remark: text("remark"),
  responseMessage: text("response_message"),
  responseCode: varchar("response_code", { length: 10 }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Negotiation status enum
export const negotiationStatusEnum = pgEnum("negotiation_status", [
  "pending", "accepted", "rejected", "countered", "expired", "cancelled"
]);

// Price negotiations between buyers and sellers
export const negotiations = pgTable("negotiations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  originalPrice: decimal("original_price", { precision: 10, scale: 2 }).notNull(), // Price at time of offer
  offerPrice: decimal("offer_price", { precision: 10, scale: 2 }).notNull(), // Buyer's proposed price
  counterOfferPrice: decimal("counter_offer_price", { precision: 10, scale: 2 }), // Seller's counter (if any)
  status: negotiationStatusEnum("status").notNull().default("pending"),
  buyerMessage: text("buyer_message"), // Optional message with offer
  sellerMessage: text("seller_message"), // Optional response message
  // Calculated fee breakdown (populated when offer is made/updated)
  calculatedPlatformFee: decimal("calculated_platform_fee", { precision: 10, scale: 2 }),
  calculatedPaymentFee: decimal("calculated_payment_fee", { precision: 10, scale: 2 }),
  calculatedSellerProfit: decimal("calculated_seller_profit", { precision: 10, scale: 2 }),
  expiresAt: timestamp("expires_at"), // Negotiation expiry (e.g., 24 hours)
  acceptedAt: timestamp("accepted_at"),
  rejectedAt: timestamp("rejected_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_negotiations_product").on(table.productId),
  index("idx_negotiations_buyer").on(table.buyerId),
  index("idx_negotiations_seller").on(table.sellerId),
  index("idx_negotiations_status").on(table.status),
]);

// Withdrawals to bank accounts
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankCode: varchar("bank_code"),
  bankName: varchar("bank_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  accountName: varchar("account_name").notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, completed, failed
  paystackReference: varchar("paystack_reference"), // Legacy
  squadReference: varchar("squad_reference"), // Squad transfer reference
  squadTransferId: varchar("squad_transfer_id").references(() => squadTransfers.id, { onDelete: "set null" }),
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order status enum
export const orderStatusEnum = pgEnum("order_status", [
  "pending",           // Order placed, awaiting payment
  "paid",              // Payment confirmed
  "seller_confirmed",  // Seller acknowledged order
  "preparing",         // Seller preparing item
  "ready_for_pickup",  // Item ready for pickup/delivery
  "shipped",           // Item dispatched
  "out_for_delivery",  // With delivery agent
  "delivered",         // Delivered to buyer
  "buyer_confirmed",   // Buyer confirmed receipt
  "completed",         // Funds released to seller
  "cancelled",         // Order cancelled
  "disputed",          // Under dispute
  "refunded"           // Money refunded
]);

// Delivery method enum
export const deliveryMethodEnum = pgEnum("delivery_method", [
  "pickup",            // Buyer picks up from seller
  "seller_delivery",   // Seller delivers to buyer
  "agent_delivery",    // Third-party delivery agent
  "campus_meetup"      // Meet on campus
]);

// Orders table with comprehensive delivery tracking
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number", { length: 20 }).notNull().unique(),
  
  // Parties involved
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }),
  
  // Pricing breakdown
  itemPrice: decimal("item_price", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  paymentFee: decimal("payment_fee", { precision: 10, scale: 2 }).notNull().default("0.00"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  sellerEarnings: decimal("seller_earnings", { precision: 10, scale: 2 }).notNull(),
  
  // Negotiation reference (if negotiated)
  negotiationId: varchar("negotiation_id").references(() => negotiations.id, { onDelete: "set null" }),
  
  // Order status
  status: orderStatusEnum("status").notNull().default("pending"),
  
  // Delivery details
  deliveryMethod: deliveryMethodEnum("delivery_method").default("campus_meetup"),
  deliveryAddress: text("delivery_address"),
  deliveryLocation: varchar("delivery_location"),
  deliveryNotes: text("delivery_notes"),
  
  // Timeline tracking
  paidAt: timestamp("paid_at"),
  sellerConfirmedAt: timestamp("seller_confirmed_at"),
  preparingAt: timestamp("preparing_at"),
  readyAt: timestamp("ready_at"),
  shippedAt: timestamp("shipped_at"),
  outForDeliveryAt: timestamp("out_for_delivery_at"),
  deliveredAt: timestamp("delivered_at"),
  buyerConfirmedAt: timestamp("buyer_confirmed_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  
  // Cancellation/dispute info
  cancelledBy: varchar("cancelled_by").references(() => users.id, { onDelete: "set null" }),
  cancellationReason: text("cancellation_reason"),
  
  // Payment tracking
  paymentReference: varchar("payment_reference"),
  escrowTransactionId: varchar("escrow_transaction_id").references(() => escrowTransactions.id, { onDelete: "set null" }),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_orders_buyer").on(table.buyerId),
  index("idx_orders_seller").on(table.sellerId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_created").on(table.createdAt),
  index("idx_orders_number").on(table.orderNumber),
]);

// Order status history for tracking all status changes
export const orderStatusHistory = pgTable("order_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  fromStatus: orderStatusEnum("from_status"),
  toStatus: orderStatusEnum("to_status").notNull(),
  changedBy: varchar("changed_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_order_status_history_order").on(table.orderId),
  index("idx_order_status_history_created").on(table.createdAt),
]);

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "message", "sale", "purchase", "review", "follow", "product_update", 
  "announcement", "dispute", "verification_approved", "verification_rejected",
  "escrow_released", "wallet_credit", "boost_expired", "price_alert",
  "negotiation_offer", "negotiation_accepted", "negotiation_rejected", "negotiation_countered",
  "order_placed", "order_confirmed", "order_shipped", "order_delivered", "order_completed", "order_cancelled"
]);

// Notifications for real time updates
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  link: varchar("link"), // Where to navigate when clicked
  isRead: boolean("is_read").default(false),
  relatedUserId: varchar("related_user_id").references(() => users.id, { onDelete: "set null" }),
  relatedProductId: varchar("related_product_id").references(() => products.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_user_notifications").on(table.userId, table.isRead),
]);

// Announcement category enum
export const announcementCategoryEnum = pgEnum("announcement_category", ["update", "feature", "alert"]);

// Announcement priority enum
export const announcementPriorityEnum = pgEnum("announcement_priority", ["low", "normal", "high"]);

// Marketplace announcements (admin-only for Campus Updates)
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  category: announcementCategoryEnum("category").notNull().default("update"),
  priority: announcementPriorityEnum("priority").notNull().default("normal"),
  isPinned: boolean("is_pinned").default(false),
  isPublished: boolean("is_published").default(true),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_announcements_published").on(table.isPublished, table.createdAt),
]);

// Track which users have read which announcements
export const announcementReads = pgTable("announcement_reads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  announcementId: varchar("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => [
  index("idx_announcement_reads_user").on(table.userId, table.announcementId),
]);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  products: many(products),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
  givenReviews: many(reviews, { relationName: "givenReviews" }),
  receivedReviews: many(reviews, { relationName: "receivedReviews" }),
  watchlist: many(watchlist),
  wallet: one(wallets),
  welcomeBonus: one(welcomeBonuses),
  loginStreak: one(loginStreaks),
  sellerAnalytics: one(sellerAnalytics),
  referralsMade: many(referrals, { relationName: "referralsMade" }),
  referralsReceived: many(referrals, { relationName: "referralsReceived" }),
  savedSearches: many(savedSearches),
  draftProducts: many(draftProducts),
  scheduledPosts: many(scheduledPosts),
  voicePosts: many(voicePosts),
  boostRequests: many(boostRequests),
  disputes: many(disputes),
  supportTickets: many(supportTickets),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  seller: one(users, {
    fields: [products.sellerId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  messages: many(messages),
  reviews: many(reviews),
  watchlist: many(watchlist),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sentMessages",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receivedMessages",
  }),
  product: one(products, {
    fields: [messages.productId],
    references: [products.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "givenReviews",
  }),
  reviewedUser: one(users, {
    fields: [reviews.reviewedUserId],
    references: [users.id],
    relationName: "receivedReviews",
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [watchlist.productId],
    references: [products.id],
  }),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  relatedProduct: one(products, {
    fields: [transactions.relatedProductId],
    references: [products.id],
  }),
  relatedUser: one(users, {
    fields: [transactions.relatedUserId],
    references: [users.id],
  }),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referralsMade",
  }),
  referredUser: one(users, {
    fields: [referrals.referredUserId],
    references: [users.id],
    relationName: "referralsReceived",
  }),
}));

export const welcomeBonusesRelations = relations(welcomeBonuses, ({ one }) => ({
  user: one(users, {
    fields: [welcomeBonuses.userId],
    references: [users.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one }) => ({
  user: one(users, {
    fields: [savedSearches.userId],
    references: [users.id],
  }),
}));

export const draftProductsRelations = relations(draftProducts, ({ one }) => ({
  seller: one(users, {
    fields: [draftProducts.sellerId],
    references: [users.id],
  }),
}));

export const scheduledPostsRelations = relations(scheduledPosts, ({ one }) => ({
  seller: one(users, {
    fields: [scheduledPosts.sellerId],
    references: [users.id],
  }),
  publishedProduct: one(products, {
    fields: [scheduledPosts.publishedProductId],
    references: [products.id],
  }),
}));

export const voicePostsRelations = relations(voicePosts, ({ one }) => ({
  user: one(users, {
    fields: [voicePosts.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [voicePosts.productId],
    references: [products.id],
  }),
}));

export const boostRequestsRelations = relations(boostRequests, ({ one }) => ({
  product: one(products, {
    fields: [boostRequests.productId],
    references: [products.id],
  }),
  seller: one(users, {
    fields: [boostRequests.sellerId],
    references: [users.id],
  }),
}));

export const disputesRelations = relations(disputes, ({ one }) => ({
  product: one(products, {
    fields: [disputes.productId],
    references: [products.id],
  }),
  buyer: one(users, {
    fields: [disputes.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [disputes.sellerId],
    references: [users.id],
  }),
}));

export const supportTicketsRelations = relations(supportTickets, ({ one }) => ({
  user: one(users, {
    fields: [supportTickets.userId],
    references: [users.id],
  }),
}));

export const loginStreaksRelations = relations(loginStreaks, ({ one }) => ({
  user: one(users, {
    fields: [loginStreaks.userId],
    references: [users.id],
  }),
}));

export const sellerAnalyticsRelations = relations(sellerAnalytics, ({ one }) => ({
  seller: one(users, {
    fields: [sellerAnalytics.sellerId],
    references: [users.id],
  }),
}));

// Zod schemas for validation
export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  location: true,
  bio: true,
  profileImageUrl: true,
}).partial();

export const insertProductSchema = createInsertSchema(products, {
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be less than 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  categoryId: z.string().min(1, "Please select a category"),
  price: z.string().min(1, "Price is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    "Please enter a valid price"
  ),
  originalPrice: z.string().optional().nullable().refine(
    (val) => !val || (!isNaN(parseFloat(val)) && parseFloat(val) >= 0),
    "Please enter a valid original price"
  ),
  isOnSale: z.boolean().optional().default(false),
  condition: z.enum(["new", "like_new", "good", "fair"]).default("good"),
  location: z.string().optional().nullable(),
  images: z.array(z.string()).optional().default([]),
  isAvailable: z.boolean().optional().default(true),
  isSold: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  isBoosted: z.boolean().optional().default(false),
  boostedUntil: z.date().optional().nullable(),
  inquiries: z.number().optional().default(0),
}).omit({
  id: true,
  sellerId: true,
  createdAt: true,
  updatedAt: true,
  views: true,
  watchers: true,
  isApproved: true,
  isFlagged: true,
  flagReason: true,
});

export const updateProductSchema = insertProductSchema.partial();

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertWatchlistSchema = createInsertSchema(watchlist).omit({
  id: true,
  createdAt: true,
});

// Additional Zod schemas for new features
export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  bonusPaid: true,
});

export const insertWelcomeBonusSchema = createInsertSchema(welcomeBonuses).omit({
  id: true,
  createdAt: true,
  claimed: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
  lastAlertSent: true,
});

export const insertDraftProductSchema = createInsertSchema(draftProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPosts).omit({
  id: true,
  createdAt: true,
  published: true,
  publishedProductId: true,
});

export const insertVoicePostSchema = createInsertSchema(voicePosts).omit({
  id: true,
  createdAt: true,
});

export const insertBoostRequestSchema = createInsertSchema(boostRequests).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  resolvedAt: true,
  status: true,
  resolution: true,
  resolvedBy: true,
});

export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  assignedTo: true,
  response: true,
});

// API-specific validation schemas
// Role update schema - allows switching between buyer or seller only
export const roleUpdateSchema = z.object({
  role: z.enum(['buyer', 'seller']),
});

export const createReferralSchema = z.object({
  referredUserId: z.string().min(1, "Referred user ID is required"),
});

export const createSavedSearchSchema = insertSavedSearchSchema.extend({
  query: z.string().min(1, "Search query is required"),
});

export const saveDraftSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  price: z.string().optional(),
  category: z.string().optional(),
  images: z.array(z.string()).optional(),
  formData: z.record(z.any()).optional(),
});

export const createScheduledPostSchema = insertScheduledPostSchema.extend({
  productData: z.record(z.any()),
});

export const createBoostSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  type: z.enum(['boost', 'featured']),
  duration: z.coerce.number().min(1).max(168), // Max 1 week
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount format. Use numbers only (e.g., 500.00)"),
});

export const createDisputeSchema = insertDisputeSchema.extend({
  reason: z.string().min(10, "Please provide details (minimum 10 characters)"),
});

export const createSupportTicketSchema = insertSupportTicketSchema.extend({
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  message: z.string().min(20, "Please provide more details (minimum 20 characters)"),
});

// TypeScript types
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type UpdateProduct = z.infer<typeof updateProductSchema>;
export type Product = typeof products.$inferSelect;
export type ProductView = typeof productViews.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
export type Watchlist = typeof watchlist.$inferSelect;
export type InsertWatchlist = z.infer<typeof insertWatchlistSchema>;

// New feature types
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;
export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type WelcomeBonus = typeof welcomeBonuses.$inferSelect;
export type InsertWelcomeBonus = z.infer<typeof insertWelcomeBonusSchema>;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
export type DraftProduct = typeof draftProducts.$inferSelect;
export type InsertDraftProduct = z.infer<typeof insertDraftProductSchema>;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
export type VoicePost = typeof voicePosts.$inferSelect;
export type InsertVoicePost = z.infer<typeof insertVoicePostSchema>;
export type BoostRequest = typeof boostRequests.$inferSelect;
export type InsertBoostRequest = z.infer<typeof insertBoostRequestSchema>;
export type Dispute = typeof disputes.$inferSelect;
export type InsertDispute = z.infer<typeof insertDisputeSchema>;
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type TicketReply = typeof ticketReplies.$inferSelect;
export type LoginStreak = typeof loginStreaks.$inferSelect;
export type SellerAnalytics = typeof sellerAnalytics.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

// Zod schemas for follows
export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

// Zod schemas for ticket replies
export const insertTicketReplySchema = createInsertSchema(ticketReplies).omit({
  id: true,
  createdAt: true,
});

export const createTicketReplySchema = z.object({
  ticketId: z.string().min(1, "Ticket ID is required"),
  message: z.string().min(5, "Reply must be at least 5 characters"),
});

export type InsertTicketReply = z.infer<typeof insertTicketReplySchema>;
export type CreateTicketReplyInput = z.infer<typeof createTicketReplySchema>;

// Zod schemas for new tables
export const insertHostelSchema = createInsertSchema(hostels).omit({
  id: true,
  agentId: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  organizerId: true,
  views: true,
  ticketsSold: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEscrowTransactionSchema = createInsertSchema(escrowTransactions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  releasedAt: true,
  status: true,
});

export const insertPaystackPaymentSchema = createInsertSchema(paystackPayments).omit({
  id: true,
  createdAt: true,
});

// Squad insert schemas
export const insertSquadPaymentSchema = createInsertSchema(squadPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSquadTransferSchema = createInsertSchema(squadTransfers).omit({
  id: true,
  createdAt: true,
});

export const insertNegotiationSchema = createInsertSchema(negotiations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  acceptedAt: true,
  rejectedAt: true,
});

export const insertWithdrawalSchema = createInsertSchema(withdrawals).omit({
  id: true,
  createdAt: true,
  status: true,
  processedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  views: true,
});

export const insertAnnouncementReadSchema = createInsertSchema(announcementReads).omit({
  id: true,
  readAt: true,
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().min(10, "Content must be at least 10 characters"),
  category: z.enum(["update", "feature", "alert"]),
  priority: z.enum(["low", "normal", "high"]).optional().default("normal"),
  isPinned: z.boolean().optional().default(false),
  isPublished: z.boolean().optional().default(true),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

// API-specific schemas for new features
export const createHostelSchema = insertHostelSchema.extend({
  title: z.string().min(5, "Title must be at least 5 characters"),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price format"),
});

export const createEventSchema = insertEventSchema.extend({
  title: z.string().min(5, "Title must be at least 5 characters"),
  eventDate: z.coerce.date(),
});

export const createEscrowSchema = z.object({
  sellerId: z.string(),
  productId: z.string().optional(),
  hostelId: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  platformFeePercentage: z.number().min(3).max(6).default(5),
});

export const verifyNINSchema = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  selfieBase64: z.string().min(1, "Selfie image is required"),
});

export const updateSocialMediaSchema = z.object({
  instagramHandle: z.string().optional(),
  tiktokHandle: z.string().optional(),
  facebookProfile: z.string().optional(),
});

export const initiateWithdrawalSchema = insertWithdrawalSchema.extend({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  bankCode: z.string().min(1, "Bank code is required").optional(),
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(10, "Invalid account number"),
  accountName: z.string().min(1, "Account name is required"),
});

// Negotiation API schemas
export const createNegotiationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  offerPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid offer price"),
  message: z.string().max(500).optional(),
});

export const respondToNegotiationSchema = z.object({
  negotiationId: z.string().min(1, "Negotiation ID is required"),
  action: z.enum(["accept", "reject", "counter"]),
  counterOfferPrice: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid counter offer price").optional(),
  message: z.string().max(500).optional(),
});

// Squad payment initialization schema
export const initiateSquadPaymentSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  purpose: z.enum(["wallet_deposit", "boost_payment", "featured_payment", "escrow_payment", "checkout_payment"]),
  paymentDescription: z.string().max(200).optional(),
  paymentChannel: z.enum(["transfer", "card", "ussd"]).optional(),
});

// Seller verification request schema
export const requestVerificationSchema = z.object({
  studentIdImage: z.string().min(1, "Student ID image is required"),
  selfieImage: z.string().min(1, "Selfie image is required"),
});

// Admin verification review schema
export const reviewVerificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  approved: z.boolean(),
  notes: z.string().max(500).optional(),
});

// Squad types
export type SquadPayment = typeof squadPayments.$inferSelect;
export type InsertSquadPayment = z.infer<typeof insertSquadPaymentSchema>;
export type SquadTransfer = typeof squadTransfers.$inferSelect;
export type InsertSquadTransfer = z.infer<typeof insertSquadTransferSchema>;

// Negotiation types
export type Negotiation = typeof negotiations.$inferSelect;
export type InsertNegotiation = z.infer<typeof insertNegotiationSchema>;

// Game type and status enums
export const gameTypeEnum = pgEnum("game_type", ["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price"]);
export const gameStatusEnum = pgEnum("game_status", ["waiting", "in_progress", "completed", "cancelled"]);
export const gameModeEnum = pgEnum("game_mode", ["single_player", "multiplayer"]);

// Game leaderboard/scores table
export const gameScores = pgTable("game_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  gameType: gameTypeEnum("game_type").notNull(),
  totalScore: integer("total_score").default(0).notNull(),
  gamesPlayed: integer("games_played").default(0).notNull(),
  gamesWon: integer("games_won").default(0).notNull(),
  highScore: integer("high_score").default(0),
  totalEarnings: decimal("total_earnings", { precision: 10, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_game_scores_user").on(table.userId),
  index("idx_game_scores_type").on(table.gameType),
  index("idx_game_scores_total").on(table.totalScore),
]);

// Trivia questions table
export const triviaQuestions = pgTable("trivia_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  question: text("question").notNull(),
  options: text("options").array().notNull(),
  correctAnswer: integer("correct_answer").notNull(),
  category: varchar("category", { length: 100 }),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Word lists for word battle
export const wordLists = pgTable("word_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: varchar("word", { length: 50 }).notNull().unique(),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  category: varchar("category", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
});

// Speed typing texts
export const typingTexts = pgTable("typing_texts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  text: text("text").notNull(),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  wordCount: integer("word_count").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Price guess products for Guess the Price game
export const priceGuessProducts = pgTable("price_guess_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  imageUrl: text("image_url"),
  actualPrice: decimal("actual_price", { precision: 10, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }),
  difficulty: varchar("difficulty", { length: 20 }).default("medium"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Games/Lobbies table
export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: gameTypeEnum("game_type").notNull(),
  player1Id: varchar("player1_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  player2Id: varchar("player2_id").references(() => users.id, { onDelete: "cascade" }),
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }).notNull(),
  status: gameStatusEnum("status").notNull().default("waiting"),
  winnerId: varchar("winner_id").references(() => users.id, { onDelete: "set null" }),
  gameData: jsonb("game_data"), // Store game-specific state
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

// Game matches for tracking individual rounds/matches within a game
export const gameMatches = pgTable("game_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull().default(1),
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  roundData: jsonb("round_data"), // Store round-specific data
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for games
export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertGameMatchSchema = createInsertSchema(gameMatches).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for games
export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GameMatch = typeof gameMatches.$inferSelect;
export type InsertGameMatch = z.infer<typeof insertGameMatchSchema>;

// Insert schemas for game content tables
export const insertGameScoreSchema = createInsertSchema(gameScores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTriviaQuestionSchema = createInsertSchema(triviaQuestions).omit({
  id: true,
  createdAt: true,
});

export const insertTypingTextSchema = createInsertSchema(typingTexts).omit({
  id: true,
  createdAt: true,
});

export const insertPriceGuessProductSchema = createInsertSchema(priceGuessProducts).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for game content tables
export type GameScore = typeof gameScores.$inferSelect;
export type InsertGameScore = z.infer<typeof insertGameScoreSchema>;
export type TriviaQuestion = typeof triviaQuestions.$inferSelect;
export type InsertTriviaQuestion = z.infer<typeof insertTriviaQuestionSchema>;
export type TypingText = typeof typingTexts.$inferSelect;
export type InsertTypingText = z.infer<typeof insertTypingTextSchema>;
export type PriceGuessProduct = typeof priceGuessProducts.$inferSelect;
export type InsertPriceGuessProduct = z.infer<typeof insertPriceGuessProductSchema>;

// API schemas for games
export const createGameSchema = z.object({
  gameType: z.enum(["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price"]),
  stakeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid stake amount"),
  mode: z.enum(["single_player", "multiplayer"]).optional().default("multiplayer"),
});

export const joinGameSchema = z.object({
  gameId: z.string(),
});

export const completeGameSchema = z.object({
  winnerId: z.string(),
});

// Reply restriction enum - who can reply to posts (Twitter/X style)
export const replyRestrictionEnum = pgEnum("reply_restriction", ["everyone", "verified", "followers", "mentioned"]);

// Social feed posts ("The Plug")
export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  videos: text("videos").array().default(sql`ARRAY[]::text[]`),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  repostsCount: integer("reposts_count").default(0),
  sharesCount: integer("shares_count").default(0), // Share/copy link count
  viewsCount: integer("views_count").default(0), // Post impressions
  replyRestriction: replyRestrictionEnum("reply_restriction").default("everyone"), // Who can reply
  mentionedUserIds: text("mentioned_user_ids").array().default(sql`ARRAY[]::text[]`), // Users mentioned in post
  hashtags: text("hashtags").array().default(sql`ARRAY[]::text[]`), // Extracted hashtags
  isPinned: boolean("is_pinned").default(false), // Pinned to profile
  isFromSystemAccount: boolean("is_from_system_account").default(false), // Posted by @EKSUPlug
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_social_posts_author").on(table.authorId),
  index("idx_social_posts_created").on(table.createdAt),
  index("idx_social_posts_system").on(table.isFromSystemAccount),
]);

// Social post likes
export const socialPostLikes = pgTable("social_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_post_likes_post").on(table.postId),
  index("idx_post_likes_user").on(table.userId),
]);

// Social post comments
export const socialPostComments = pgTable("social_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_post_comments_post").on(table.postId),
]);

// Social post reposts (Twitter-like repost/retweet functionality)
export const socialPostReposts = pgTable("social_post_reposts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalPostId: varchar("original_post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  reposterId: varchar("reposter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quoteContent: text("quote_content"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reposts_original_post").on(table.originalPostId),
  index("idx_reposts_reposter").on(table.reposterId),
]);

// Social post reports
export const socialPostReports = pgTable("social_post_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_post_reports_post").on(table.postId),
  index("idx_post_reports_reporter").on(table.reporterId),
]);

export type SocialPostReport = typeof socialPostReports.$inferSelect;
export type InsertSocialPostReport = typeof socialPostReports.$inferInsert;

// Blocked users table - for user blocking functionality
export const blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"), // Optional reason for blocking
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_blocked_blocker").on(table.blockerId),
  index("idx_blocked_blocked").on(table.blockedId),
]);

// Post bookmarks (saved posts)
export const postBookmarks = pgTable("post_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_bookmarks_user").on(table.userId),
  index("idx_bookmarks_post").on(table.postId),
]);

// Feed algorithm engagement scores
export const feedEngagementScores = pgTable("feed_engagement_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  engagementScore: decimal("engagement_score", { precision: 10, scale: 4 }).default("0"), // Calculated score
  velocityScore: decimal("velocity_score", { precision: 10, scale: 4 }).default("0"), // Recent engagement rate
  recencyBonus: decimal("recency_bonus", { precision: 10, scale: 4 }).default("0"), // Time decay factor
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => [
  index("idx_engagement_post").on(table.postId),
  index("idx_engagement_score").on(table.engagementScore),
]);

// Social post views tracking for unique view counts (1 view per user per 24 hours)
export const socialPostViews = pgTable("social_post_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull(), // User ID for logged-in users, or hashed IP+session for guests
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("social_post_views_post_viewer_idx").on(table.postId, table.viewerId),
  index("social_post_views_post_idx").on(table.postId),
]);

export type SocialPostView = typeof socialPostViews.$inferSelect;

// Insert schemas for social posts
export const insertSocialPostSchema = createInsertSchema(socialPosts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  repostsCount: true,
  sharesCount: true,
  viewsCount: true,
  createdAt: true,
  updatedAt: true,
});

// Insert schemas for blocked users
export const insertBlockedUserSchema = createInsertSchema(blockedUsers).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for post bookmarks
export const insertPostBookmarkSchema = createInsertSchema(postBookmarks).omit({
  id: true,
  createdAt: true,
});

export const insertSocialPostCommentSchema = createInsertSchema(socialPostComments).omit({
  id: true,
  createdAt: true,
});

export const insertSocialPostRepostSchema = createInsertSchema(socialPostReposts).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for social posts
export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPostLike = typeof socialPostLikes.$inferSelect;
export type SocialPostComment = typeof socialPostComments.$inferSelect;
export type InsertSocialPostComment = z.infer<typeof insertSocialPostCommentSchema>;
export type SocialPostRepost = typeof socialPostReposts.$inferSelect;
export type InsertSocialPostRepost = z.infer<typeof insertSocialPostRepostSchema>;
export type BlockedUser = typeof blockedUsers.$inferSelect;
export type InsertBlockedUser = z.infer<typeof insertBlockedUserSchema>;
export type PostBookmark = typeof postBookmarks.$inferSelect;
export type InsertPostBookmark = z.infer<typeof insertPostBookmarkSchema>;
export type FeedEngagementScore = typeof feedEngagementScores.$inferSelect;

// Password reset tokens table
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schema for password reset tokens
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
});

// TypeScript types for password reset tokens
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

// Authentication schemas
// Note: "both" role is deprecated - users must choose buyer OR seller only
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .transform(val => val.toLowerCase()),
  phoneNumber: z.string().optional(),
  role: z.enum(["buyer", "seller", "both"]).optional().default("buyer"),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// TypeScript types for auth
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SafeUser = Omit<User, 'password'>; // User without password field

// Cart item schema and types
export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

// TypeScript types for new tables
export type Hostel = typeof hostels.$inferSelect;
export type InsertHostel = z.infer<typeof insertHostelSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EscrowTransaction = typeof escrowTransactions.$inferSelect;
export type InsertEscrowTransaction = z.infer<typeof insertEscrowTransactionSchema>;
export type PaystackPayment = typeof paystackPayments.$inferSelect;
export type InsertPaystackPayment = z.infer<typeof insertPaystackPaymentSchema>;
export type Withdrawal = typeof withdrawals.$inferSelect;
export type InsertWithdrawal = z.infer<typeof insertWithdrawalSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type InsertAnnouncementRead = z.infer<typeof insertAnnouncementReadSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;

// Order insert schemas
export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  paidAt: true,
  sellerConfirmedAt: true,
  preparingAt: true,
  readyAt: true,
  shippedAt: true,
  outForDeliveryAt: true,
  deliveredAt: true,
  buyerConfirmedAt: true,
  completedAt: true,
  cancelledAt: true,
});

export const insertOrderStatusHistorySchema = createInsertSchema(orderStatusHistory).omit({
  id: true,
  createdAt: true,
});

// Order API schemas
export const createOrderSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  deliveryMethod: z.enum(["pickup", "seller_delivery", "agent_delivery", "campus_meetup"]).optional().default("campus_meetup"),
  deliveryAddress: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryNotes: z.string().optional(),
  negotiationId: z.string().optional(),
});

export const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  status: z.enum([
    "pending", "paid", "seller_confirmed", "preparing", "ready_for_pickup",
    "shipped", "out_for_delivery", "delivered", "buyer_confirmed", "completed",
    "cancelled", "disputed", "refunded"
  ]),
  notes: z.string().optional(),
});

// Order TypeScript types
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderStatusHistory = typeof orderStatusHistory.$inferSelect;
export type InsertOrderStatusHistory = z.infer<typeof insertOrderStatusHistorySchema>;
export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

// User blocks - prevents all interaction
export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("user_blocks_blocker_idx").on(table.blockerId)]);

// User mutes - hides content, user can still message
export const userMutes = pgTable("user_mutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  muterId: varchar("muter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mutedId: varchar("muted_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("user_mutes_muter_idx").on(table.muterId)]);

// User reports - for admin review
export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportedId: varchar("reported_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  description: text("description"),
  status: varchar("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas for user blocks, mutes, reports
export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({
  id: true,
  createdAt: true,
});

export const insertUserMuteSchema = createInsertSchema(userMutes).omit({
  id: true,
  createdAt: true,
});

export const insertUserReportSchema = createInsertSchema(userReports).omit({
  id: true,
  createdAt: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
});

// API schema for creating user reports
export const createUserReportSchema = z.object({
  reason: z.enum(["spam", "harassment", "scam", "inappropriate", "other"]),
  description: z.string().optional(),
});

// TypeScript types for user blocks, mutes, reports
export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type UserMute = typeof userMutes.$inferSelect;
export type InsertUserMute = z.infer<typeof insertUserMuteSchema>;
export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;
export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;

// ===========================================
// VTU (Virtual Top-Up) DATA SALES SYSTEM
// ===========================================

// VTU Network enum (MTN SME, GLO CG, Airtel CG)
export const vtuNetworkEnum = pgEnum("vtu_network", ["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]);

// VTU Transaction status
export const vtuStatusEnum = pgEnum("vtu_status", ["pending", "processing", "success", "failed", "refunded"]);

// VTU Service type
export const vtuServiceTypeEnum = pgEnum("vtu_service_type", ["data", "airtime"]);

// VTU Data Plans - stores available data plans from SMEDATA.NG
export const vtuPlans = pgTable("vtu_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  network: vtuNetworkEnum("network").notNull(),
  planName: varchar("plan_name", { length: 100 }).notNull(),
  dataAmount: varchar("data_amount", { length: 50 }).notNull(), // e.g., "1GB", "2GB", "5GB"
  validity: varchar("validity", { length: 50 }).notNull(), // e.g., "30 days", "7 days"
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(), // Price from SMEDATA.NG
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }).notNull(), // Price we sell at
  planCode: varchar("plan_code", { length: 50 }).notNull(), // SMEDATA.NG plan code
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("vtu_plans_network_idx").on(table.network),
  index("vtu_plans_active_idx").on(table.isActive),
]);

// VTU Transactions - tracks all data purchases
export const vtuTransactions = pgTable("vtu_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  planId: varchar("plan_id").notNull().references(() => vtuPlans.id, { onDelete: "restrict" }),
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(), // Recipient phone number
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Amount charged to user
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }).notNull(), // Our cost from SMEDATA.NG
  profit: decimal("profit", { precision: 10, scale: 2 }).notNull(), // Profit on this transaction
  status: vtuStatusEnum("status").notNull().default("pending"),
  smedataReference: varchar("smedata_reference", { length: 100 }), // SMEDATA.NG transaction reference
  smedataResponse: jsonb("smedata_response"), // Full API response for debugging
  errorMessage: text("error_message"),
  walletTransactionId: varchar("wallet_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("vtu_transactions_user_idx").on(table.userId),
  index("vtu_transactions_status_idx").on(table.status),
  index("vtu_transactions_created_idx").on(table.createdAt),
]);

// VTU Insert schemas
export const insertVtuPlanSchema = createInsertSchema(vtuPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVtuTransactionSchema = createInsertSchema(vtuTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// VTU API schemas
export const purchaseVtuSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required").max(15),
});

// Airtime purchase schema
export const purchaseAirtimeSchema = z.object({
  phoneNumber: z.string().min(10, "Valid phone number is required").max(15),
  amount: z.number().min(50, "Minimum airtime is 50 Naira").max(50000, "Maximum airtime is 50,000 Naira"),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
});

// ===========================================
// VTU BENEFICIARIES - Saved phone numbers
// ===========================================

export const vtuBeneficiaries = pgTable("vtu_beneficiaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull(),
  network: vtuNetworkEnum("network").notNull(),
  isDefault: boolean("is_default").default(false),
  lastUsed: timestamp("last_used"),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("vtu_beneficiaries_user_idx").on(table.userId),
]);

export const insertVtuBeneficiarySchema = createInsertSchema(vtuBeneficiaries).omit({
  id: true,
  createdAt: true,
  lastUsed: true,
  usageCount: true,
});

export const createBeneficiarySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phoneNumber: z.string().min(10, "Valid phone number is required").max(15),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
  isDefault: z.boolean().optional(),
});

// VTU TypeScript types
export type VtuPlan = typeof vtuPlans.$inferSelect;
export type InsertVtuPlan = z.infer<typeof insertVtuPlanSchema>;
export type VtuTransaction = typeof vtuTransactions.$inferSelect;
export type InsertVtuTransaction = z.infer<typeof insertVtuTransactionSchema>;
export type PurchaseVtuInput = z.infer<typeof purchaseVtuSchema>;
export type PurchaseAirtimeInput = z.infer<typeof purchaseAirtimeSchema>;
export type VtuBeneficiary = typeof vtuBeneficiaries.$inferSelect;
export type InsertVtuBeneficiary = z.infer<typeof insertVtuBeneficiarySchema>;
export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;

// ===========================================
// SCHEDULED VTU PURCHASES
// ===========================================

export const scheduledPurchaseFrequencyEnum = pgEnum("scheduled_purchase_frequency", ["daily", "weekly", "monthly"]);
export const scheduledPurchaseStatusEnum = pgEnum("scheduled_purchase_status", ["active", "paused", "cancelled"]);

export const scheduledVtuPurchases = pgTable("scheduled_vtu_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceType: vtuServiceTypeEnum("service_type").notNull().default("data"),
  planId: varchar("plan_id").references(() => vtuPlans.id),
  network: vtuNetworkEnum("network").notNull(),
  phoneNumber: varchar("phone_number", { length: 15 }).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }),
  frequency: scheduledPurchaseFrequencyEnum("frequency").notNull(),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  timeOfDay: varchar("time_of_day", { length: 5 }).default("09:00"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),
  runCount: integer("run_count").default(0),
  status: scheduledPurchaseStatusEnum("status").default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("scheduled_vtu_user_idx").on(table.userId),
  index("scheduled_vtu_next_run_idx").on(table.nextRunAt),
]);

export const insertScheduledVtuPurchaseSchema = createInsertSchema(scheduledVtuPurchases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  runCount: true,
  lastRunAt: true,
});

export const createScheduledPurchaseApiSchema = z.object({
  serviceType: z.enum(["data", "airtime"]),
  planId: z.string().optional(),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
  phoneNumber: z.string().min(10).max(15),
  amount: z.number().optional(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(28).optional(),
  timeOfDay: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export type ScheduledVtuPurchase = typeof scheduledVtuPurchases.$inferSelect;
export type InsertScheduledVtuPurchase = z.infer<typeof insertScheduledVtuPurchaseSchema>;
export type CreateScheduledPurchaseInput = z.infer<typeof createScheduledPurchaseApiSchema>;

// ===========================================
// GIFT DATA FEATURE
// ===========================================

export const giftDataStatusEnum = pgEnum("gift_data_status", ["pending", "accepted", "claimed", "expired", "cancelled"]);

export const giftData = pgTable("gift_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientPhone: varchar("recipient_phone", { length: 15 }).notNull(),
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  planId: varchar("plan_id").notNull().references(() => vtuPlans.id),
  network: vtuNetworkEnum("network").notNull(),
  message: text("message"),
  giftCode: varchar("gift_code", { length: 10 }).unique(),
  status: giftDataStatusEnum("status").default("pending"),
  expiresAt: timestamp("expires_at"),
  claimedAt: timestamp("claimed_at"),
  transactionId: varchar("transaction_id").references(() => vtuTransactions.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("gift_data_sender_idx").on(table.senderId),
  index("gift_data_recipient_idx").on(table.recipientPhone),
  index("gift_data_code_idx").on(table.giftCode),
]);

export const insertGiftDataSchema = createInsertSchema(giftData).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
  transactionId: true,
});

export const createGiftDataApiSchema = z.object({
  recipientPhone: z.string().min(10).max(15),
  planId: z.string().min(1),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
  message: z.string().max(200).optional(),
});

export type GiftData = typeof giftData.$inferSelect;
export type InsertGiftData = z.infer<typeof insertGiftDataSchema>;
export type CreateGiftDataInput = z.infer<typeof createGiftDataApiSchema>;

// ===========================================
// USER SETTINGS SYSTEM
// ===========================================

// User settings for preferences
export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  // Location settings
  locationVisible: boolean("location_visible").default(true),
  showDistanceFromCampus: boolean("show_distance_from_campus").default(true),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  // Notification settings
  pushNotifications: boolean("push_notifications").default(true),
  emailNotifications: boolean("email_notifications").default(true),
  messageNotifications: boolean("message_notifications").default(true),
  orderNotifications: boolean("order_notifications").default(true),
  promotionalNotifications: boolean("promotional_notifications").default(false),
  // Chat settings
  showTypingStatus: boolean("show_typing_status").default(true),
  showReadReceipts: boolean("show_read_receipts").default(true),
  showOnlineStatus: boolean("show_online_status").default(true),
  // Account settings
  deletionRequestedAt: timestamp("deletion_requested_at"),
  deletionScheduledFor: timestamp("deletion_scheduled_for"), // 30 days after request
  deletionCancelledAt: timestamp("deletion_cancelled_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User settings insert schema
export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSettingsSchema = z.object({
  locationVisible: z.boolean().optional(),
  showDistanceFromCampus: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  pushNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  messageNotifications: z.boolean().optional(),
  orderNotifications: z.boolean().optional(),
  promotionalNotifications: z.boolean().optional(),
  showTypingStatus: z.boolean().optional(),
  showReadReceipts: z.boolean().optional(),
  showOnlineStatus: z.boolean().optional(),
});

export const requestAccountDeletionSchema = z.object({
  usernameConfirmation: z.string().min(1, "Username confirmation required"),
});

// User settings types
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UpdateUserSettingsInput = z.infer<typeof updateUserSettingsSchema>;
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;

// ===========================================
// SPONSORED ADS / MONETIZATION SYSTEM
// ===========================================

// Sponsored ad types
export const sponsoredAdTypeEnum = pgEnum("sponsored_ad_type", ["marketplace", "plug", "banner"]);
export const sponsoredAdStatusEnum = pgEnum("sponsored_ad_status", ["pending", "active", "paused", "completed", "rejected"]);

// Sponsored ads table
export const sponsoredAds = pgTable("sponsored_ads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  advertiserId: varchar("advertiser_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: sponsoredAdTypeEnum("type").notNull().default("marketplace"),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  linkUrl: text("link_url"),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }), // Optional: promote a specific product
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0.00"),
  costPerImpression: decimal("cost_per_impression", { precision: 10, scale: 4 }).default("0.0050"), // ~₦5 per 1000 views
  costPerClick: decimal("cost_per_click", { precision: 10, scale: 2 }).default("1.00"), // ₦1 per click
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  status: sponsoredAdStatusEnum("status").notNull().default("pending"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  targetCategories: text("target_categories").array().default(sql`ARRAY[]::text[]`), // Category targeting
  targetLocations: text("target_locations").array().default(sql`ARRAY[]::text[]`), // Location targeting
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("sponsored_ads_status_idx").on(table.status),
  index("sponsored_ads_advertiser_idx").on(table.advertiserId),
]);

// Platform settings for admin controls
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
});

// Sponsored ads insert schema
export const insertSponsoredAdSchema = createInsertSchema(sponsoredAds).omit({
  id: true,
  impressions: true,
  clicks: true,
  spent: true,
  createdAt: true,
  updatedAt: true,
});

export const createSponsoredAdSchema = z.object({
  type: z.enum(["marketplace", "plug", "banner"]).optional().default("marketplace"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  linkUrl: z.string().optional(),
  productId: z.string().optional(),
  budget: z.number().min(500, "Minimum budget is ₦500"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  targetCategories: z.array(z.string()).optional(),
  targetLocations: z.array(z.string()).optional(),
});

// Sponsored ads types
export type SponsoredAd = typeof sponsoredAds.$inferSelect;
export type InsertSponsoredAd = z.infer<typeof insertSponsoredAdSchema>;
export type CreateSponsoredAdInput = z.infer<typeof createSponsoredAdSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;

// ===========================================
// KYC VERIFICATION SYSTEM
// ===========================================

// KYC status enum
export const kycStatusEnum = pgEnum("kyc_status", ["pending_payment", "pending_verification", "manual_review", "approved", "rejected", "refunded"]);

// KYC verifications table
export const kycVerifications = pgTable("kyc_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: kycStatusEnum("status").notNull().default("pending_payment"),
  // Payment info
  paymentReference: varchar("payment_reference"),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).default("200.00"), // ₦200 fee
  paymentStatus: varchar("payment_status", { length: 20 }).default("pending"),
  paidAt: timestamp("paid_at"),
  // NIN verification data
  nin: varchar("nin", { length: 11 }), // Stored temporarily, deleted after verification
  ninFirstName: varchar("nin_first_name"),
  ninLastName: varchar("nin_last_name"),
  ninDateOfBirth: varchar("nin_date_of_birth"),
  ninPhotoUrl: text("nin_photo_url"), // Temporary, deleted after verification
  // Selfie verification
  selfieUrl: text("selfie_url"), // Temporary, deleted after verification
  // Verification results
  similarityScore: decimal("similarity_score", { precision: 5, scale: 2 }), // 0-100%
  smedataResponse: jsonb("smedata_response"), // Full API response
  // Consent
  consentGiven: boolean("consent_given").default(false),
  consentTimestamp: timestamp("consent_timestamp"),
  // Review info
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  rejectionReason: text("rejection_reason"),
  // Cleanup tracking
  imagesDeletedAt: timestamp("images_deleted_at"), // When selfie/NIN photo were deleted
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("kyc_verifications_user_idx").on(table.userId),
  index("kyc_verifications_status_idx").on(table.status),
]);

// KYC verification logs for audit trail (1 year retention)
export const kycVerificationLogs = pgTable("kyc_verification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  kycId: varchar("kyc_id").notNull().references(() => kycVerifications.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(), // payment_initiated, verification_started, auto_approved, manual_review, approved, rejected, refunded
  result: varchar("result", { length: 50 }),
  similarityScore: decimal("similarity_score", { precision: 5, scale: 2 }),
  reviewedBy: varchar("reviewed_by"),
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

// KYC insert schemas
export const insertKycVerificationSchema = createInsertSchema(kycVerifications).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const initiateKycSchema = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"), // YYYY-MM-DD format
  consent: z.boolean().refine(val => val === true, "You must agree to the verification terms"),
});

export const uploadKycSelfieSchema = z.object({
  kycId: z.string().min(1, "KYC ID is required"),
});

export const reviewKycSchema = z.object({
  kycId: z.string().min(1, "KYC ID is required"),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

// KYC types
export type KycVerification = typeof kycVerifications.$inferSelect;
export type InsertKycVerification = z.infer<typeof insertKycVerificationSchema>;
export type InitiateKycInput = z.infer<typeof initiateKycSchema>;
export type ReviewKycInput = z.infer<typeof reviewKycSchema>;
export type KycVerificationLog = typeof kycVerificationLogs.$inferSelect;

// ===========================================
// BILL PAYMENTS SYSTEM (Cable TV & Electricity)
// ===========================================

// Bill service type enum - Cable TV and Electricity providers
export const billServiceTypeEnum = pgEnum("bill_service_type", [
  "dstv", "gotv", "startimes", "showmax",  // Cable TV
  "ekedc", "ikedc", "aedc", "ibedc", "phedc", "eedc"  // Electricity
]);

// Bill payments table
export const billPayments = pgTable("bill_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceType: billServiceTypeEnum("service_type").notNull(),
  billType: varchar("bill_type", { length: 20 }).notNull(), // 'cable' or 'electricity'
  customerId: varchar("customer_id", { length: 50 }).notNull(), // Decoder/Meter number
  customerName: varchar("customer_name", { length: 100 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  packageName: varchar("package_name", { length: 100 }),
  status: vtuStatusEnum("status").notNull().default("pending"),
  reference: varchar("reference", { length: 100 }),
  token: varchar("token", { length: 100 }), // For electricity prepaid tokens
  apiResponse: jsonb("api_response"),
  errorMessage: text("error_message"),
  walletTransactionId: varchar("wallet_transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("bill_payments_user_idx").on(table.userId),
  index("bill_payments_status_idx").on(table.status),
  index("bill_payments_created_idx").on(table.createdAt),
]);

// Bill payment insert schema
export const insertBillPaymentSchema = createInsertSchema(billPayments).omit({
  id: true,
  createdAt: true,
});

// Bill payment API schemas
export const payBillSchema = z.object({
  serviceType: z.enum(["dstv", "gotv", "startimes", "showmax", "ekedc", "ikedc", "aedc", "ibedc", "phedc", "eedc"]),
  billType: z.enum(["cable", "electricity"]),
  customerId: z.string().min(1, "Customer ID is required"),
  amount: z.number().positive("Amount must be positive"),
  packageCode: z.string().optional(),
  packageName: z.string().optional(),
});

export const validateCustomerSchema = z.object({
  serviceType: z.enum(["dstv", "gotv", "startimes", "showmax", "ekedc", "ikedc", "aedc", "ibedc", "phedc", "eedc"]),
  customerId: z.string().min(1, "Customer ID is required"),
});

// Bill payment types
export type BillPayment = typeof billPayments.$inferSelect;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type PayBillInput = z.infer<typeof payBillSchema>;
export type ValidateCustomerInput = z.infer<typeof validateCustomerSchema>;

// ===========================================
// STORIES SYSTEM (Instagram-like, 24h expiry)
// ===========================================

export const storyTypeEnum = pgEnum("story_type", ["image", "video", "text"]);

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: storyTypeEnum("type").notNull().default("image"),
  mediaUrl: text("media_url"),
  textContent: text("text_content"),
  backgroundColor: varchar("background_color", { length: 20 }).default("#16a34a"),
  fontStyle: varchar("font_style", { length: 50 }).default("sans-serif"),
  viewsCount: integer("views_count").default(0),
  likesCount: integer("likes_count").default(0),
  expiresAt: timestamp("expires_at").notNull(),
  isHighlight: boolean("is_highlight").default(false),
  highlightName: varchar("highlight_name", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("stories_author_idx").on(table.authorId),
  index("stories_expires_idx").on(table.expiresAt),
  index("stories_highlight_idx").on(table.isHighlight),
]);

export const storyViews = pgTable("story_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("story_views_story_idx").on(table.storyId),
  index("story_views_viewer_idx").on(table.viewerId),
]);

export const storyReactions = pgTable("story_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  reactorId: varchar("reactor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reaction: varchar("reaction", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("story_reactions_story_idx").on(table.storyId),
]);

export const storyReplies = pgTable("story_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("story_replies_story_idx").on(table.storyId),
]);

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  viewsCount: true,
  likesCount: true,
  createdAt: true,
});

export const createStorySchema = z.object({
  type: z.enum(["image", "video", "text"]),
  mediaUrl: z.string().optional(),
  textContent: z.string().max(500).optional(),
  backgroundColor: z.string().optional(),
  fontStyle: z.string().optional(),
});

export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type CreateStoryInput = z.infer<typeof createStorySchema>;
export type StoryView = typeof storyViews.$inferSelect;
export type StoryReaction = typeof storyReactions.$inferSelect;
export type StoryReply = typeof storyReplies.$inferSelect;

// ===========================================
// CONFESSIONS SYSTEM (Anonymous Board)
// ===========================================

export const confessionStatusEnum = pgEnum("confession_status", ["pending", "approved", "rejected", "flagged"]);

export const confessions = pgTable("confessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  category: varchar("category", { length: 50 }).default("general"),
  isAnonymous: boolean("is_anonymous").default(true),
  status: confessionStatusEnum("status").default("pending"),
  likesCount: integer("likes_count").default(0),
  dislikesCount: integer("dislikes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  viewsCount: integer("views_count").default(0),
  isTrending: boolean("is_trending").default(false),
  moderatedBy: varchar("moderated_by").references(() => users.id, { onDelete: "set null" }),
  moderatedAt: timestamp("moderated_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("confessions_status_idx").on(table.status),
  index("confessions_trending_idx").on(table.isTrending),
  index("confessions_created_idx").on(table.createdAt),
]);

export const confessionVotes = pgTable("confession_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  voterId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voteType: varchar("vote_type", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("confession_votes_confession_idx").on(table.confessionId),
  index("confession_votes_voter_idx").on(table.voterId),
]);

export const confessionComments = pgTable("confession_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(false),
  parentId: varchar("parent_id"),
  likesCount: integer("likes_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("confession_comments_confession_idx").on(table.confessionId),
]);

export const confessionReports = pgTable("confession_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Confession views tracking for unique view counts (1 view per user per 24 hours)
export const confessionViews = pgTable("confession_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull(), // User ID for logged-in users, or hashed IP+session for guests
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("confession_views_confession_viewer_idx").on(table.confessionId, table.viewerId),
  index("confession_views_confession_idx").on(table.confessionId),
]);

export type ConfessionView = typeof confessionViews.$inferSelect;

export const insertConfessionSchema = createInsertSchema(confessions).omit({
  id: true,
  likesCount: true,
  dislikesCount: true,
  commentsCount: true,
  viewsCount: true,
  isTrending: true,
  moderatedBy: true,
  moderatedAt: true,
  createdAt: true,
});

export const createConfessionSchema = z.object({
  content: z.string().min(10, "Confession must be at least 10 characters").max(2000),
  category: z.enum(["general", "love", "academics", "drama", "advice", "funny", "secrets"]).optional(),
  isAnonymous: z.boolean().optional().default(true),
});

export type Confession = typeof confessions.$inferSelect;
export type InsertConfession = z.infer<typeof insertConfessionSchema>;
export type CreateConfessionInput = z.infer<typeof createConfessionSchema>;
export type ConfessionVote = typeof confessionVotes.$inferSelect;
export type ConfessionComment = typeof confessionComments.$inferSelect;

// ===========================================
// COMMUNITY SYSTEM (Groups & Discussions)
// ===========================================

export const communityTypeEnum = pgEnum("community_type", ["public", "private", "invite_only"]);
export const communityMemberRoleEnum = pgEnum("community_member_role", ["member", "moderator", "admin", "owner"]);

export const communities = pgTable("communities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  coverUrl: text("cover_url"),
  type: communityTypeEnum("type").default("public"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 50 }),
  membersCount: integer("members_count").default(1),
  postsCount: integer("posts_count").default(0),
  isVerified: boolean("is_verified").default(false),
  isActive: boolean("is_active").default(true),
  rules: text("rules").array().default(sql`ARRAY[]::text[]`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("communities_slug_idx").on(table.slug),
  index("communities_owner_idx").on(table.ownerId),
  index("communities_type_idx").on(table.type),
]);

export const communityMembers = pgTable("community_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: communityMemberRoleEnum("role").default("member"),
  isBanned: boolean("is_banned").default(false),
  bannedUntil: timestamp("banned_until"),
  banReason: text("ban_reason"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("community_members_community_idx").on(table.communityId),
  index("community_members_user_idx").on(table.userId),
]);

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }),
  content: text("content").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  isPinned: boolean("is_pinned").default(false),
  isLocked: boolean("is_locked").default(false),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("community_posts_community_idx").on(table.communityId),
  index("community_posts_author_idx").on(table.authorId),
  index("community_posts_pinned_idx").on(table.isPinned),
]);

export const communityPostComments = pgTable("community_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  parentId: varchar("parent_id"),
  likesCount: integer("likes_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("community_post_comments_post_idx").on(table.postId),
]);

export const communityPostLikes = pgTable("community_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("community_post_likes_post_idx").on(table.postId),
  index("community_post_likes_user_idx").on(table.userId),
]);

export const insertCommunitySchema = createInsertSchema(communities).omit({
  id: true,
  membersCount: true,
  postsCount: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export const createCommunitySchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(100),
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().max(1000).optional(),
  type: z.enum(["public", "private", "invite_only"]).optional(),
  category: z.string().optional(),
  rules: z.array(z.string()).optional(),
});

export const createCommunityPostSchema = z.object({
  communityId: z.string().min(1),
  title: z.string().max(300).optional(),
  content: z.string().min(1, "Content is required").max(10000),
  images: z.array(z.string()).optional(),
});

export const createCommunityPostCommentSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1, "Comment is required").max(2000),
  parentId: z.string().optional(),
});

export type Community = typeof communities.$inferSelect;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type CreateCommunityPostInput = z.infer<typeof createCommunityPostSchema>;
export type CommunityPostComment = typeof communityPostComments.$inferSelect;
export type CreateCommunityPostCommentInput = z.infer<typeof createCommunityPostCommentSchema>;
export type CommunityPostLike = typeof communityPostLikes.$inferSelect;

// ===========================================
// WEB PUSH NOTIFICATIONS SYSTEM
// ===========================================

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  lastUsed: timestamp("last_used").defaultNow(),
}, (table) => [
  index("push_subscriptions_user_idx").on(table.userId),
  index("push_subscriptions_active_idx").on(table.isActive),
]);

export const pushNotificationHistory = pgTable("push_notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => pushSubscriptions.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  icon: text("icon"),
  url: text("url"),
  data: jsonb("data"),
  status: varchar("status", { length: 20 }).default("sent"),
  sentAt: timestamp("sent_at").defaultNow(),
  clickedAt: timestamp("clicked_at"),
}, (table) => [
  index("push_history_user_idx").on(table.userId),
  index("push_history_sent_idx").on(table.sentAt),
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  isActive: true,
  createdAt: true,
  lastUsed: true,
});

export const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type SubscribePushInput = z.infer<typeof subscribePushSchema>;
export type PushNotificationHistory = typeof pushNotificationHistory.$inferSelect;

// ===========================================
// ENHANCED MESSAGING FEATURES
// ===========================================

export const messageStatusEnum = pgEnum("message_status", ["sent", "delivered", "read"]);

export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reaction: varchar("reaction", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("message_reactions_message_idx").on(table.messageId),
]);

export const archivedConversations = pgTable("archived_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  otherUserId: varchar("other_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  archivedAt: timestamp("archived_at").defaultNow(),
}, (table) => [
  index("archived_conversations_user_idx").on(table.userId),
]);

export const disappearingMessageSettings = pgTable("disappearing_message_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  otherUserId: varchar("other_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  duration: integer("duration").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("disappearing_settings_user_idx").on(table.userId),
]);

export const messageReadReceipts = pgTable("message_read_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  readerId: varchar("reader_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => [
  index("message_read_receipts_message_idx").on(table.messageId),
]);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type ArchivedConversation = typeof archivedConversations.$inferSelect;
export type DisappearingMessageSetting = typeof disappearingMessageSettings.$inferSelect;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;

// ===========================================
// WEEKLY LOGIN REWARDS (₦20 per week streak)
// ===========================================

export const weeklyLoginRewards = pgTable("weekly_login_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekNumber: integer("week_number").notNull(),
  year: integer("year").notNull(),
  daysLoggedIn: integer("days_logged_in").default(0),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0.00"),
  rewardClaimed: boolean("reward_claimed").default(false),
  claimedAt: timestamp("claimed_at"),
  lastLoginDate: timestamp("last_login_date"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("weekly_login_rewards_user_idx").on(table.userId),
  index("weekly_login_rewards_week_idx").on(table.weekNumber, table.year),
]);

export type WeeklyLoginReward = typeof weeklyLoginRewards.$inferSelect;

// ===========================================
// MULTIPLAYER GAME ROOMS (Real-time WebSocket)
// ===========================================

export const gameRoomStatusEnum = pgEnum("game_room_status", ["waiting", "ready", "playing", "paused", "finished", "abandoned"]);

export const gameRooms = pgTable("game_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: gameTypeEnum("game_type").notNull(),
  roomCode: varchar("room_code", { length: 8 }).unique().notNull(),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: gameRoomStatusEnum("status").default("waiting"),
  maxPlayers: integer("max_players").default(4),
  currentPlayers: integer("current_players").default(1),
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isPrivate: boolean("is_private").default(false),
  password: varchar("password", { length: 50 }),
  gameState: jsonb("game_state"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("game_rooms_code_idx").on(table.roomCode),
  index("game_rooms_host_idx").on(table.hostId),
  index("game_rooms_status_idx").on(table.status),
]);

export const gameRoomPlayers = pgTable("game_room_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  playerNumber: integer("player_number").notNull(),
  isReady: boolean("is_ready").default(false),
  isConnected: boolean("is_connected").default(true),
  score: integer("score").default(0),
  position: integer("position"),
  playerState: jsonb("player_state"),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("game_room_players_room_idx").on(table.roomId),
  index("game_room_players_user_idx").on(table.userId),
]);

export const gameChatMessages = pgTable("game_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: varchar("type", { length: 20 }).default("text"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("game_chat_messages_room_idx").on(table.roomId),
]);

export const insertGameRoomSchema = createInsertSchema(gameRooms).omit({
  id: true,
  currentPlayers: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
});

export const createGameRoomSchema = z.object({
  gameType: z.enum(["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price"]),
  stakeAmount: z.number().min(0).default(0),
  maxPlayers: z.number().min(2).max(10).default(4),
  isPrivate: z.boolean().optional(),
  password: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

export const joinGameRoomSchema = z.object({
  roomCode: z.string().length(8),
  password: z.string().optional(),
});

export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = z.infer<typeof insertGameRoomSchema>;
export type CreateGameRoomInput = z.infer<typeof createGameRoomSchema>;
export type JoinGameRoomInput = z.infer<typeof joinGameRoomSchema>;
export type GameRoomPlayer = typeof gameRoomPlayers.$inferSelect;
export type GameChatMessage = typeof gameChatMessages.$inferSelect;

// ===========================================
// PRO CHATBOT CONVERSATIONS
// ===========================================

export const chatbotConversations = pgTable("chatbot_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }),
  isActive: boolean("is_active").default(true),
  messageCount: integer("message_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("chatbot_conversations_user_idx").on(table.userId),
]);

export const chatbotMessages = pgTable("chatbot_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => chatbotConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("chatbot_messages_conversation_idx").on(table.conversationId),
]);

export const createChatbotMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1, "Message is required").max(4000),
});

export type ChatbotConversation = typeof chatbotConversations.$inferSelect;
export type ChatbotMessage = typeof chatbotMessages.$inferSelect;
export type CreateChatbotMessageInput = z.infer<typeof createChatbotMessageSchema>;

// ===========================================
// SECRET MESSAGE LINKS (Anonymous Messages)
// ===========================================

export const secretMessageLinks = pgTable("secret_message_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  linkCode: varchar("link_code", { length: 12 }).unique().notNull(),
  title: text("title").notNull().default("Send me an anonymous message"),
  backgroundColor: varchar("background_color", { length: 20 }).default("#6b21a8"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("secret_message_links_user_idx").on(table.userId),
  index("secret_message_links_code_idx").on(table.linkCode),
]);

export const secretMessages = pgTable("secret_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  linkId: varchar("link_id").notNull().references(() => secretMessageLinks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("secret_messages_link_idx").on(table.linkId),
  index("secret_messages_read_idx").on(table.isRead),
]);

export const insertSecretMessageLinkSchema = createInsertSchema(secretMessageLinks).omit({
  id: true,
  userId: true,
  linkCode: true,
  createdAt: true,
});

export const createSecretMessageLinkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters").optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

export const insertSecretMessageSchema = createInsertSchema(secretMessages).omit({
  id: true,
  isRead: true,
  createdAt: true,
});

export const sendSecretMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(2000, "Message must be at most 2000 characters"),
});

export type SecretMessageLink = typeof secretMessageLinks.$inferSelect;
export type InsertSecretMessageLink = z.infer<typeof insertSecretMessageLinkSchema>;
export type CreateSecretMessageLinkInput = z.infer<typeof createSecretMessageLinkSchema>;
export type SecretMessage = typeof secretMessages.$inferSelect;
export type InsertSecretMessage = z.infer<typeof insertSecretMessageSchema>;
export type SendSecretMessageInput = z.infer<typeof sendSecretMessageSchema>;

// ===========================================
// STUDY MATERIALS (Past Questions, Handouts, Notes)
// ===========================================

export const materialTypeEnum = pgEnum("material_type", [
  "past_question",
  "handout",
  "summary",
  "textbook",
  "lab_report",
  "project",
  "lecture_note"
]);

export const academicLevelEnum = pgEnum("academic_level", ["100L", "200L", "300L", "400L", "500L", "postgraduate"]);

export const studyMaterials = pgTable("study_materials", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  uploaderId: varchar("uploader_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  materialType: materialTypeEnum("material_type").notNull(),
  courseCode: varchar("course_code", { length: 20 }).notNull(),
  courseName: varchar("course_name", { length: 200 }),
  faculty: varchar("faculty", { length: 100 }),
  department: varchar("department", { length: 100 }),
  level: academicLevelEnum("level").notNull(),
  semester: varchar("semester", { length: 20 }),
  academicYear: varchar("academic_year", { length: 20 }),
  fileUrl: text("file_url").notNull(),
  previewUrl: text("preview_url"),
  thumbnailUrl: text("thumbnail_url"),
  fileSize: integer("file_size"),
  pageCount: integer("page_count"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isFree: boolean("is_free").default(true),
  downloads: integer("downloads").default(0),
  views: integer("views").default(0),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  ratingCount: integer("rating_count").default(0),
  isApproved: boolean("is_approved").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("study_materials_uploader_idx").on(table.uploaderId),
  index("study_materials_course_idx").on(table.courseCode),
  index("study_materials_level_idx").on(table.level),
  index("study_materials_type_idx").on(table.materialType),
  index("study_materials_faculty_idx").on(table.faculty),
]);

export const studyMaterialPurchases = pgTable("study_material_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("study_material_purchases_material_idx").on(table.materialId),
  index("study_material_purchases_buyer_idx").on(table.buyerId),
]);

export const studyMaterialRatings = pgTable("study_material_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  materialId: varchar("material_id").notNull().references(() => studyMaterials.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  review: text("review"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("study_material_ratings_material_idx").on(table.materialId),
  index("study_material_ratings_user_idx").on(table.userId),
]);

export const insertStudyMaterialSchema = createInsertSchema(studyMaterials).omit({
  id: true,
  downloads: true,
  views: true,
  rating: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
});

export const createStudyMaterialSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(2000).optional(),
  materialType: z.enum(["past_question", "handout", "summary", "textbook", "lab_report", "project", "lecture_note"]),
  courseCode: z.string().min(2).max(20),
  courseName: z.string().max(200).optional(),
  faculty: z.string().max(100).optional(),
  department: z.string().max(100).optional(),
  level: z.enum(["100L", "200L", "300L", "400L", "500L", "postgraduate"]),
  semester: z.string().max(20).optional(),
  academicYear: z.string().max(20).optional(),
  price: z.number().min(0).default(0),
  isFree: z.boolean().default(true),
});

export type StudyMaterial = typeof studyMaterials.$inferSelect;
export type InsertStudyMaterial = z.infer<typeof insertStudyMaterialSchema>;
export type CreateStudyMaterialInput = z.infer<typeof createStudyMaterialSchema>;
export type StudyMaterialPurchase = typeof studyMaterialPurchases.$inferSelect;
export type StudyMaterialRating = typeof studyMaterialRatings.$inferSelect;

// ===========================================
// EMAIL VERIFICATION TOKENS
// ===========================================

export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("email_verification_user_idx").on(table.userId),
  index("email_verification_token_idx").on(table.token),
]);

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
