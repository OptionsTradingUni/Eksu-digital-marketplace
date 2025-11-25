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

// User roles enum
export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "both", "admin"]);

// User storage table (email/password authentication with marketplace features)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password"), // Hashed password using bcrypt (nullable for migration from OAuth users)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: userRoleEnum("role").notNull().default("buyer"),
  // Campus-specific fields
  phoneNumber: varchar("phone_number").unique(), // UNIQUE - one account per phone
  location: varchar("location"), // Campus area/hostel
  bio: text("bio"),
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
  // Account status
  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  banReason: text("ban_reason"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

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
  images: text("images").array().notNull().default(sql`ARRAY[]::text[]`), // Array of image URLs
  condition: productConditionEnum("condition").notNull().default("good"),
  location: varchar("location"), // Campus area
  // Status
  isAvailable: boolean("is_available").default(true),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Messages for real-time chat
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productId: varchar("product_id").references(() => products.id, { onDelete: "set null" }), // Optional context
  content: text("content").notNull(),
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
  totalEarned: decimal("total_earned", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Transaction types
export const transactionTypeEnum = pgEnum("transaction_type", [
  "welcome_bonus", "referral_bonus", "login_reward", "deposit", "sale", "purchase", 
  "boost_payment", "featured_payment", "escrow_hold", "escrow_release", "escrow_fee",
  "refund", "withdrawal", "agent_commission", "platform_fee"
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
  subject: varchar("subject", { length: 200 }).notNull(),
  message: text("message").notNull(),
  category: varchar("category", { length: 50 }), // account, payment, technical, report
  status: varchar("status", { length: 20 }).default("open"), // open, in_progress, resolved, closed
  priority: varchar("priority", { length: 20 }).default("medium"), // low, medium, high, urgent
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "set null" }),
  response: text("response"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Login streak rewards
export const loginStreaks = pgTable("login_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastLoginDate: timestamp("last_login_date"),
  totalRewards: decimal("total_rewards", { precision: 10, scale: 2 }).default("0.00"),
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

// Paystack payment records
export const paystackPayments = pgTable("paystack_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reference: varchar("reference").notNull().unique(), // Paystack reference
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("NGN"),
  status: varchar("status", { length: 20 }).notNull(), // success, failed, pending
  channel: varchar("channel", { length: 20 }), // card, bank_transfer, ussd, etc
  paidAt: timestamp("paid_at"),
  metadata: jsonb("metadata"), // Additional Paystack data
  purpose: varchar("purpose", { length: 50 }), // wallet_deposit, withdrawal, boost_payment, etc
  createdAt: timestamp("created_at").defaultNow(),
});

// Withdrawals to bank accounts
export const withdrawals = pgTable("withdrawals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  bankName: varchar("bank_name").notNull(),
  accountNumber: varchar("account_number").notNull(),
  accountName: varchar("account_name").notNull(),
  status: varchar("status", { length: 20 }).default("pending"), // pending, processing, completed, failed
  paystackReference: varchar("paystack_reference"),
  processedAt: timestamp("processed_at"),
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notification types
export const notificationTypeEnum = pgEnum("notification_type", [
  "message", "sale", "purchase", "review", "follow", "product_update", 
  "announcement", "dispute", "verification_approved", "verification_rejected",
  "escrow_released", "wallet_credit", "boost_expired", "price_alert"
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

// Marketplace announcements (only verified accounts can post)
export const announcements = pgTable("announcements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  content: text("content").notNull(),
  type: varchar("type", { length: 50 }).default("general"), // general, update, event, promotion, safety
  isApproved: boolean("is_approved").default(false),
  approvedBy: varchar("approved_by").references(() => users.id, { onDelete: "set null" }),
  isPinned: boolean("is_pinned").default(false),
  views: integer("views").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
});

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

export const insertProductSchema = createInsertSchema(products).omit({
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
export const roleUpdateSchema = z.object({
  role: z.enum(['buyer', 'seller', 'both', 'admin']),
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
export type LoginStreak = typeof loginStreaks.$inferSelect;
export type SellerAnalytics = typeof sellerAnalytics.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type InsertFollow = z.infer<typeof insertFollowSchema>;

// Zod schemas for follows
export const insertFollowSchema = createInsertSchema(follows).omit({
  id: true,
  createdAt: true,
});

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
  approvedAt: true,
  views: true,
  isApproved: true,
  approvedBy: true,
});

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
  bankName: z.string().min(1, "Bank name is required"),
  accountNumber: z.string().min(10, "Invalid account number"),
  accountName: z.string().min(1, "Account name is required"),
});

// Authentication schemas
export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// TypeScript types for auth
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SafeUser = Omit<User, 'password'>; // User without password field

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
