import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
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

export const communityVisibilityEnum = pgEnum("community_visibility", ["public", "private", "hidden"]);
export const memberRoleEnum = pgEnum("member_role", ["member", "moderator", "admin", "owner"]);
export const memberStatusEnum = pgEnum("member_status", ["pending", "active", "banned"]);

export const communities = pgTable("communities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  iconUrl: text("icon_url"),
  bannerUrl: text("banner_url"),
  visibility: communityVisibilityEnum("visibility").default("public"),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  membersCount: integer("members_count").default(1),
  postsCount: integer("posts_count").default(0),
  rules: jsonb("rules"),
  settings: jsonb("settings"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_communities_owner").on(table.ownerId),
  index("idx_communities_slug").on(table.slug),
  index("idx_communities_visibility").on(table.visibility),
]);

export const communityMembers = pgTable("community_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: memberRoleEnum("role").default("member"),
  status: memberStatusEnum("status").default("active"),
  joinedAt: timestamp("joined_at").defaultNow(),
  bannedUntil: timestamp("banned_until"),
  banReason: text("ban_reason"),
}, (table) => [
  index("idx_community_members_community").on(table.communityId),
  index("idx_community_members_user").on(table.userId),
]);

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  communityId: varchar("community_id").notNull().references(() => communities.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 300 }),
  content: text("content").notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  isPinned: boolean("is_pinned").default(false),
  isApproved: boolean("is_approved").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_community_posts_community").on(table.communityId),
  index("idx_community_posts_author").on(table.authorId),
  index("idx_community_posts_created").on(table.createdAt),
]);

export const communityPostComments = pgTable("community_post_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  likesCount: integer("likes_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_community_post_comments_post").on(table.postId),
  index("idx_community_post_comments_author").on(table.authorId),
]);

export const communityPostLikes = pgTable("community_post_likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => communityPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_community_post_likes_post").on(table.postId),
  index("idx_community_post_likes_user").on(table.userId),
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
  slug: z.string().min(3).max(100).regex(/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"),
  description: z.string().max(500).optional(),
  iconUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  visibility: z.enum(["public", "private", "hidden"]).optional(),
});

export const insertCommunityPostSchema = createInsertSchema(communityPosts).omit({
  id: true,
  likesCount: true,
  commentsCount: true,
  createdAt: true,
  updatedAt: true,
});

export type Community = typeof communities.$inferSelect;
export type InsertCommunity = z.infer<typeof insertCommunitySchema>;
export type CommunityMember = typeof communityMembers.$inferSelect;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = z.infer<typeof insertCommunityPostSchema>;
export type CommunityPostComment = typeof communityPostComments.$inferSelect;
export type CommunityPostLike = typeof communityPostLikes.$inferSelect;
