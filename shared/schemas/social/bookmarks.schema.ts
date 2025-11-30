import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from '../auth/users.schema';
import { socialPosts } from './posts.schema';

export const postBookmarks = pgTable("post_bookmarks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  postId: varchar("post_id").notNull().references(() => socialPosts.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("post_bookmarks_post_idx").on(table.postId),
  index("post_bookmarks_user_idx").on(table.userId),
]);

export type PostBookmark = typeof postBookmarks.$inferSelect;
