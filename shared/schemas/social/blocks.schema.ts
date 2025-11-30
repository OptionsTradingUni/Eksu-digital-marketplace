import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_blocked_users_blocker").on(table.blockerId),
  index("idx_blocked_users_blocked").on(table.blockedId),
]);

export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_blocks_blocker_idx").on(table.blockerId),
  index("user_blocks_blocked_idx").on(table.blockedId),
]);

export const userMutes = pgTable("user_mutes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  muterId: varchar("muter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mutedId: varchar("muted_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mutePosts: boolean("mute_posts").default(true),
  muteStories: boolean("mute_stories").default(true),
  muteNotifications: boolean("mute_notifications").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_mutes_muter_idx").on(table.muterId),
  index("user_mutes_muted_idx").on(table.mutedId),
]);

import { boolean } from 'drizzle-orm/pg-core';

export const userReportReasonEnum = pgEnum("report_reason", ["spam", "harassment", "scam", "inappropriate", "other"]);
export const userReportStatusEnum = pgEnum("report_status", ["pending", "reviewed", "resolved", "dismissed"]);

export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reportedId: varchar("reported_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: userReportReasonEnum("reason").notNull(),
  description: text("description"),
  status: userReportStatusEnum("status").default("pending"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("user_reports_reporter_idx").on(table.reporterId),
  index("user_reports_reported_idx").on(table.reportedId),
  index("user_reports_status_idx").on(table.status),
]);

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

export const createUserReportSchema = z.object({
  reason: z.enum(["spam", "harassment", "scam", "inappropriate", "other"]),
  description: z.string().optional(),
});

export type BlockedUser = typeof blockedUsers.$inferSelect;
export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = z.infer<typeof insertUserBlockSchema>;
export type UserMute = typeof userMutes.$inferSelect;
export type InsertUserMute = z.infer<typeof insertUserMuteSchema>;
export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = z.infer<typeof insertUserReportSchema>;
export type CreateUserReportInput = z.infer<typeof createUserReportSchema>;
