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

export const confessionStatusEnum = pgEnum("confession_status", ["pending", "approved", "rejected", "flagged"]);

export const confessions = pgTable("confessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  displayName: varchar("display_name", { length: 100 }),
  category: varchar("category", { length: 50 }),
  upvotes: integer("upvotes").default(0),
  downvotes: integer("downvotes").default(0),
  commentsCount: integer("comments_count").default(0),
  viewsCount: integer("views_count").default(0),
  status: confessionStatusEnum("status").default("approved"),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_confessions_author").on(table.authorId),
  index("idx_confessions_status").on(table.status),
  index("idx_confessions_created").on(table.createdAt),
]);

export const confessionVotes = pgTable("confession_votes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  voteType: varchar("vote_type", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_confession_votes_confession").on(table.confessionId),
  index("idx_confession_votes_user").on(table.userId),
]);

export const confessionComments = pgTable("confession_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").references(() => users.id, { onDelete: "set null" }),
  parentId: varchar("parent_id"),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  displayName: varchar("display_name", { length: 100 }),
  likesCount: integer("likes_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_confession_comments_confession").on(table.confessionId),
  index("idx_confession_comments_author").on(table.authorId),
]);

export const confessionReports = pgTable("confession_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").references(() => confessions.id, { onDelete: "cascade" }),
  commentId: varchar("comment_id").references(() => confessionComments.id, { onDelete: "cascade" }),
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: varchar("reason", { length: 100 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 20 }).default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_confession_reports_confession").on(table.confessionId),
  index("idx_confession_reports_status").on(table.status),
]);

export const confessionViews = pgTable("confession_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  confessionId: varchar("confession_id").notNull().references(() => confessions.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").references(() => users.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("idx_confession_views_confession").on(table.confessionId),
]);

export const insertConfessionSchema = createInsertSchema(confessions).omit({
  id: true,
  upvotes: true,
  downvotes: true,
  commentsCount: true,
  viewsCount: true,
  createdAt: true,
});

export const createConfessionSchema = z.object({
  content: z.string().min(10, "Confession must be at least 10 characters").max(2000),
  isAnonymous: z.boolean().optional().default(true),
  displayName: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
});

export type Confession = typeof confessions.$inferSelect;
export type InsertConfession = z.infer<typeof insertConfessionSchema>;
export type ConfessionVote = typeof confessionVotes.$inferSelect;
export type ConfessionComment = typeof confessionComments.$inferSelect;
export type ConfessionReport = typeof confessionReports.$inferSelect;
export type ConfessionView = typeof confessionViews.$inferSelect;
