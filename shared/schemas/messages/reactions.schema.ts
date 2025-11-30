import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from '../auth/users.schema';
import { messages } from './messages.schema';

export const messageReactions = pgTable("message_reactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 10 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("message_reactions_message_idx").on(table.messageId),
]);

export const messageReadReceipts = pgTable("message_read_receipts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  readerId: varchar("reader_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  readAt: timestamp("read_at").defaultNow(),
}, (table) => [
  index("message_read_receipts_message_idx").on(table.messageId),
]);

export type MessageReaction = typeof messageReactions.$inferSelect;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;
