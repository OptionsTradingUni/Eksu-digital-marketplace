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

export const userSettings = pgTable("user_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  emailNotifications: boolean("email_notifications").default(true),
  pushNotifications: boolean("push_notifications").default(true),
  smsNotifications: boolean("sms_notifications").default(false),
  marketingEmails: boolean("marketing_emails").default(false),
  newMessageNotification: boolean("new_message_notification").default(true),
  newFollowerNotification: boolean("new_follower_notification").default(true),
  orderNotification: boolean("order_notification").default(true),
  priceDropNotification: boolean("price_drop_notification").default(true),
  profileVisibility: varchar("profile_visibility", { length: 20 }).default("public"),
  showOnlineStatus: boolean("show_online_status").default(true),
  showLastSeen: boolean("show_last_seen").default(true),
  allowTagging: boolean("allow_tagging").default(true),
  showReadReceipts: boolean("show_read_receipts").default(true),
  language: varchar("language", { length: 10 }).default("en"),
  theme: varchar("theme", { length: 20 }).default("system"),
  currency: varchar("currency", { length: 10 }).default("NGN"),
  preferences: jsonb("preferences"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_user_settings_user").on(table.userId),
]);

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: varchar("key", { length: 100 }).unique().notNull(),
  value: text("value"),
  description: text("description"),
  category: varchar("category", { length: 50 }),
  isPublic: boolean("is_public").default(false),
  updatedBy: varchar("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_platform_settings_key").on(table.key),
  index("idx_platform_settings_category").on(table.category),
]);

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const updateUserSettingsSchema = insertUserSettingsSchema.partial();

export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({
  id: true,
  updatedAt: true,
});

export const requestAccountDeletionSchema = z.object({
  usernameConfirmation: z.string().min(1, "Username confirmation required"),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;
