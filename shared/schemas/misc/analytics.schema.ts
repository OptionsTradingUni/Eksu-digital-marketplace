import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const sellerAnalytics = pgTable("seller_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  totalViews: integer("total_views").default(0),
  uniqueViews: integer("unique_views").default(0),
  totalInquiries: integer("total_inquiries").default(0),
  totalSales: integer("total_sales").default(0),
  revenue: decimal("revenue", { precision: 10, scale: 2 }).default("0.00"),
  newFollowers: integer("new_followers").default(0),
  profileViews: integer("profile_views").default(0),
  topProducts: jsonb("top_products"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_seller_analytics_seller").on(table.sellerId),
  index("idx_seller_analytics_date").on(table.date),
]);

export const loginStreaks = pgTable("login_streaks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  currentStreak: integer("current_streak").default(0),
  longestStreak: integer("longest_streak").default(0),
  lastLoginDate: timestamp("last_login_date"),
  totalLoginDays: integer("total_login_days").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_login_streaks_user").on(table.userId),
]);

export const weeklyLoginRewards = pgTable("weekly_login_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: timestamp("week_start").notNull(),
  daysLoggedIn: integer("days_logged_in").default(0),
  rewardClaimed: boolean("reward_claimed").default(false),
  rewardAmount: decimal("reward_amount", { precision: 10, scale: 2 }).default("0.00"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_weekly_login_rewards_user").on(table.userId),
  index("idx_weekly_login_rewards_week").on(table.weekStart),
]);

export const insertSellerAnalyticsSchema = createInsertSchema(sellerAnalytics).omit({
  id: true,
  createdAt: true,
});

export const insertLoginStreakSchema = createInsertSchema(loginStreaks).omit({
  id: true,
  updatedAt: true,
});

export type SellerAnalytics = typeof sellerAnalytics.$inferSelect;
export type InsertSellerAnalytics = z.infer<typeof insertSellerAnalyticsSchema>;
export type LoginStreak = typeof loginStreaks.$inferSelect;
export type InsertLoginStreak = z.infer<typeof insertLoginStreakSchema>;
export type WeeklyLoginReward = typeof weeklyLoginRewards.$inferSelect;
