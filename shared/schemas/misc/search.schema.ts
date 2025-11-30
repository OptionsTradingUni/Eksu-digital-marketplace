import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const searchHistory = pgTable("search_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  query: varchar("query", { length: 200 }).notNull(),
  searchType: varchar("search_type", { length: 50 }).default("products"),
  resultsCount: integer("results_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_search_history_user").on(table.userId),
  index("idx_search_history_query").on(table.query),
]);

export const savedSearches = pgTable("saved_searches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }),
  query: varchar("query", { length: 200 }).notNull(),
  filters: varchar("filters", { length: 500 }),
  notifyOnNew: boolean("notify_on_new").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_saved_searches_user").on(table.userId),
]);

import { boolean } from 'drizzle-orm/pg-core';

export const insertSearchHistorySchema = createInsertSchema(searchHistory).omit({
  id: true,
  createdAt: true,
});

export const insertSavedSearchSchema = createInsertSchema(savedSearches).omit({
  id: true,
  createdAt: true,
});

export const createSavedSearchSchema = insertSavedSearchSchema.extend({
  query: z.string().min(1, "Search query is required"),
});

export type SearchHistory = typeof searchHistory.$inferSelect;
export type InsertSearchHistory = z.infer<typeof insertSearchHistorySchema>;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type InsertSavedSearch = z.infer<typeof insertSavedSearchSchema>;
