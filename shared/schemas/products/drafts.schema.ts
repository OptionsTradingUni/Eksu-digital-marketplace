import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { products } from './products.schema';

export const draftProducts = pgTable("draft_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const scheduledPosts = pgTable("scheduled_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  productData: jsonb("product_data").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  published: boolean("published").default(false),
  publishedProductId: varchar("published_product_id").references(() => products.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_scheduled_posts_seller").on(table.sellerId),
  index("idx_scheduled_posts_time").on(table.scheduledFor),
]);

export const voicePosts = pgTable("voice_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sellerId: varchar("seller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  audioUrl: varchar("audio_url").notNull(),
  transcription: jsonb("transcription"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDraftProductSchema = createInsertSchema(draftProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertScheduledPostSchema = createInsertSchema(scheduledPosts).omit({
  id: true,
  createdAt: true,
  published: true,
  publishedProductId: true,
});

export const insertVoicePostSchema = createInsertSchema(voicePosts).omit({
  id: true,
  createdAt: true,
});

export const saveDraftSchema = z.object({
  data: z.record(z.any()),
});

export const createScheduledPostSchema = z.object({
  productData: z.record(z.any()),
  scheduledFor: z.string().datetime(),
});

export type DraftProduct = typeof draftProducts.$inferSelect;
export type InsertDraftProduct = z.infer<typeof insertDraftProductSchema>;
export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = z.infer<typeof insertScheduledPostSchema>;
export type VoicePost = typeof voicePosts.$inferSelect;
export type InsertVoicePost = z.infer<typeof insertVoicePostSchema>;
