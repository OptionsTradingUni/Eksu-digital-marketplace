import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const secretMessageLinks = pgTable("secret_message_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  slug: varchar("slug", { length: 50 }).unique().notNull(),
  prompt: text("prompt"),
  isActive: boolean("is_active").default(true),
  allowAnonymous: boolean("allow_anonymous").default(true),
  messagesCount: integer("messages_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_secret_message_links_user").on(table.userId),
  index("idx_secret_message_links_slug").on(table.slug),
]);

export const secretMessages = pgTable("secret_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  linkId: varchar("link_id").notNull().references(() => secretMessageLinks.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isAnonymous: boolean("is_anonymous").default(true),
  isRead: boolean("is_read").default(false),
  isHidden: boolean("is_hidden").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_secret_messages_link").on(table.linkId),
  index("idx_secret_messages_sender").on(table.senderId),
]);

export const insertSecretMessageLinkSchema = createInsertSchema(secretMessageLinks).omit({
  id: true,
  messagesCount: true,
  createdAt: true,
});

export const insertSecretMessageSchema = createInsertSchema(secretMessages).omit({
  id: true,
  isRead: true,
  isHidden: true,
  createdAt: true,
});

export const createSecretLinkSchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/, "Invalid slug format"),
  prompt: z.string().max(500).optional(),
  allowAnonymous: z.boolean().optional().default(true),
});

export const createSecretMessageLinkSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title must be at most 200 characters").optional(),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional(),
});

export const sendSecretMessageSchema = z.object({
  linkSlug: z.string(),
  content: z.string().min(1, "Message cannot be empty").max(2000),
  isAnonymous: z.boolean().optional().default(true),
});

export type SecretMessageLink = typeof secretMessageLinks.$inferSelect;
export type InsertSecretMessageLink = z.infer<typeof insertSecretMessageLinkSchema>;
export type SecretMessage = typeof secretMessages.$inferSelect;
export type InsertSecretMessage = z.infer<typeof insertSecretMessageSchema>;
export type CreateSecretMessageLinkInput = z.infer<typeof createSecretMessageLinkSchema>;
export type SendSecretMessageInput = z.infer<typeof sendSecretMessageSchema>;
