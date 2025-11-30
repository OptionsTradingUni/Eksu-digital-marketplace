import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from '../auth/users.schema';

export const archivedConversations = pgTable("archived_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  otherUserId: varchar("other_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  archivedAt: timestamp("archived_at").defaultNow(),
}, (table) => [
  index("archived_conversations_user_idx").on(table.userId),
]);

export const disappearingMessageSettings = pgTable("disappearing_message_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  otherUserId: varchar("other_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  duration: integer("duration").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("disappearing_settings_user_idx").on(table.userId),
]);

export type ArchivedConversation = typeof archivedConversations.$inferSelect;
export type DisappearingMessageSetting = typeof disappearingMessageSettings.$inferSelect;
