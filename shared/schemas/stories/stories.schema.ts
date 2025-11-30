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

export const storyTypeEnum = pgEnum("story_type", ["image", "video", "text"]);

export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: storyTypeEnum("type").notNull().default("image"),
  mediaUrl: text("media_url"),
  thumbnailUrl: text("thumbnail_url"),
  textContent: text("text_content"),
  backgroundColor: varchar("background_color", { length: 20 }),
  fontStyle: varchar("font_style", { length: 50 }),
  duration: integer("duration").default(5),
  viewsCount: integer("views_count").default(0),
  expiresAt: timestamp("expires_at").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stories_author").on(table.authorId),
  index("idx_stories_expires").on(table.expiresAt),
  index("idx_stories_active").on(table.isActive),
]);

export const storyViews = pgTable("story_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("idx_story_views_story").on(table.storyId),
  index("idx_story_views_viewer").on(table.viewerId),
]);

export const storyReactions = pgTable("story_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_story_reactions_story").on(table.storyId),
]);

export const storyReplies = pgTable("story_replies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_story_replies_story").on(table.storyId),
  index("idx_story_replies_sender").on(table.senderId),
]);

export const insertStorySchema = createInsertSchema(stories).omit({
  id: true,
  viewsCount: true,
  createdAt: true,
});

export const createStorySchema = z.object({
  type: z.enum(["image", "video", "text"]),
  mediaUrl: z.string().optional(),
  textContent: z.string().max(500).optional(),
  backgroundColor: z.string().optional(),
  fontStyle: z.string().optional(),
  duration: z.number().min(3).max(30).optional().default(5),
});

export type Story = typeof stories.$inferSelect;
export type InsertStory = z.infer<typeof insertStorySchema>;
export type StoryView = typeof storyViews.$inferSelect;
export type StoryReaction = typeof storyReactions.$inferSelect;
export type StoryReply = typeof storyReplies.$inferSelect;
