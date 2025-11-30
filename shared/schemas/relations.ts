import { relations } from "drizzle-orm";
import {
  users,
  wallets,
  transactions,
  referrals,
  welcomeBonuses,
  products,
  productViews,
  categories,
  reviews,
  watchlist,
  draftProducts,
  boostRequests,
  supportTickets,
  loginStreaks,
  messages,
} from './tables';

export const usersRelations = relations(users, ({ one, many }) => ({
  products: many(products),
  givenReviews: many(reviews, { relationName: "givenReviews" }),
  receivedReviews: many(reviews, { relationName: "receivedReviews" }),
  watchlist: many(watchlist),
  wallet: one(wallets),
  loginStreak: one(loginStreaks),
  welcomeBonus: one(welcomeBonuses),
  referralsMade: many(referrals, { relationName: "referralsMade" }),
  referralsReceived: many(referrals, { relationName: "referralsReceived" }),
  draftProducts: many(draftProducts),
  boostRequests: many(boostRequests),
  supportTickets: many(supportTickets),
  sentMessages: many(messages, { relationName: "sentMessages" }),
  receivedMessages: many(messages, { relationName: "receivedMessages" }),
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
  productMessages: many(messages),
  reviews: many(reviews),
  watchlist: many(watchlist),
  views: many(productViews),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
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
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  referrer: one(users, {
    fields: [referrals.referrerId],
    references: [users.id],
    relationName: "referralsMade",
  }),
  referredUser: one(users, {
    fields: [referrals.referredId],
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

export const draftProductsRelations = relations(draftProducts, ({ one }) => ({
  seller: one(users, {
    fields: [draftProducts.sellerId],
    references: [users.id],
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
