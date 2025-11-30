import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  deviceType: varchar("device_type", { length: 50 }),
  deviceName: varchar("device_name", { length: 100 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_push_subscriptions_user").on(table.userId),
  index("idx_push_subscriptions_active").on(table.isActive),
]);

export const pushNotificationHistory = pgTable("push_notification_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: varchar("subscription_id").references(() => pushSubscriptions.id, { onDelete: "set null" }),
  title: varchar("title", { length: 200 }).notNull(),
  body: text("body").notNull(),
  data: jsonb("data"),
  status: varchar("status", { length: 20 }).default("sent"),
  sentAt: timestamp("sent_at").defaultNow(),
  clickedAt: timestamp("clicked_at"),
}, (table) => [
  index("idx_push_history_user").on(table.userId),
  index("idx_push_history_sent").on(table.sentAt),
]);

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushNotificationHistory = typeof pushNotificationHistory.$inferSelect;
