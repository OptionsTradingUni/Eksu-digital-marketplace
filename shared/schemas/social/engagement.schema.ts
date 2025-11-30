import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
} from "drizzle-orm/pg-core";
import { users } from '../auth/users.schema';
import { socialPosts } from './posts.schema';

export const feedEngagementScores = pgTable("feed_engagement_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  engagementScore: decimal("engagement_score", { precision: 10, scale: 4 }).default("0.0000"),
  recencyScore: decimal("recency_score", { precision: 10, scale: 4 }).default("0.0000"),
  relevanceScore: decimal("relevance_score", { precision: 10, scale: 4 }).default("0.0000"),
  totalScore: decimal("total_score", { precision: 10, scale: 4 }).default("0.0000"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("feed_engagement_scores_post_idx").on(table.postId),
  index("feed_engagement_scores_total_idx").on(table.totalScore),
]);

export const socialPostViews = pgTable("social_post_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").references(() => users.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at").defaultNow(),
}, (table) => [
  index("social_post_views_post_idx").on(table.postId),
  index("social_post_views_viewer_idx").on(table.viewerId),
]);

export type FeedEngagementScore = typeof feedEngagementScores.$inferSelect;
export type SocialPostView = typeof socialPostViews.$inferSelect;
