import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const replyRestrictionEnum = pgEnum("reply_restriction", ["everyone", "verified", "followers", "mentioned"]);

export const socialPosts = pgTable("social_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  videos: text("videos").array().default(sql`ARRAY[]::text[]`),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  repostsCount: integer("reposts_count").default(0),
  sharesCount: integer("shares_count").default(0),
  viewsCount: integer("views_count").default(0),
  replyRestriction: replyRestrictionEnum("reply_restriction").default("everyone"),
  mentionedUserIds: text("mentioned_user_ids").array().default(sql`ARRAY[]::text[]`),
  hashtags: text("hashtags").array().default(sql`ARRAY[]::text[]`),
  isPinned: boolean("is_pinned").default(false),
  isFromSystemAccount: boolean("is_from_system_account").default(false),
  isVisible: boolean("is_visible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_social_posts_author").on(table.authorId),
  index("idx_social_posts_created").on(table.createdAt),
  index("idx_social_posts_system").on(table.isFromSystemAccount),
]);

export const socialPostLikes = pgTable("social_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_social_post_likes_post").on(table.postId),
  index("idx_social_post_likes_user").on(table.userId),
]);

export const socialPostComments = pgTable("social_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  likesCount: integer("likes_count").default(0),
  repliesCount: integer("replies_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_social_post_comments_post").on(table.postId),
  index("idx_social_post_comments_author").on(table.authorId),
  index("idx_social_post_comments_parent").on(table.parentId),
]);

export const socialPostReposts = pgTable("social_post_reposts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalPostId: varchar("original_post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  reposterId: varchar("reposter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  quoteContent: text("quote_content"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_social_post_reposts_original").on(table.originalPostId),
  index("idx_social_post_reposts_user").on(table.reposterId),
]);

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

export const createSocialPostSchema = z.object({
  content: z.string().min(1, "Content is required").max(1000, "Content must be less than 1000 characters"),
  images: z.array(z.string()).max(4).optional(),
  videos: z.array(z.string()).max(1).optional(),
  replyRestriction: z.enum(["everyone", "verified", "followers", "mentioned"]).optional(),
  mentionedUserIds: z.array(z.string()).optional(),
});

export const insertSocialPostCommentSchema = createInsertSchema(socialPostComments).omit({
  id: true,
  likesCount: true,
  repliesCount: true,
  createdAt: true,
  updatedAt: true,
});

export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(500, "Comment must be less than 500 characters"),
  images: z.array(z.string()).max(1).optional(),
  parentId: z.string().optional(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = z.infer<typeof insertSocialPostSchema>;
export type SocialPostLike = typeof socialPostLikes.$inferSelect;
export type SocialPostComment = typeof socialPostComments.$inferSelect;
export type InsertSocialPostComment = z.infer<typeof insertSocialPostCommentSchema>;
export type SocialPostRepost = typeof socialPostReposts.$inferSelect;
export type SocialPostReport = typeof socialPostReports.$inferSelect;
export type InsertSocialPostReport = typeof socialPostReports.$inferInsert;
