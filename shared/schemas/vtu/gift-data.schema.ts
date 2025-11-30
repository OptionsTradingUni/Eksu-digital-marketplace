import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  text,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { vtuNetworkEnum, vtuPlans } from './plans.schema';

export const giftDataStatusEnum = pgEnum("gift_data_status", ["pending", "sent", "claimed", "expired", "cancelled"]);

export const giftData = pgTable("gift_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recipientId: varchar("recipient_id").references(() => users.id, { onDelete: "set null" }),
  recipientPhone: varchar("recipient_phone", { length: 20 }),
  network: vtuNetworkEnum("network").notNull(),
  planId: varchar("plan_id").references(() => vtuPlans.id, { onDelete: "set null" }),
  dataAmount: varchar("data_amount", { length: 50 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  message: text("message"),
  giftCode: varchar("gift_code", { length: 20 }).unique(),
  status: giftDataStatusEnum("status").default("pending"),
  expiresAt: timestamp("expires_at"),
  claimedAt: timestamp("claimed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_gift_data_sender").on(table.senderId),
  index("idx_gift_data_recipient").on(table.recipientId),
  index("idx_gift_data_code").on(table.giftCode),
]);

export const insertGiftDataSchema = createInsertSchema(giftData).omit({
  id: true,
  createdAt: true,
  claimedAt: true,
  giftCode: true,
});

export const sendGiftDataSchema = z.object({
  recipientId: z.string().optional(),
  recipientPhone: z.string().min(11).optional(),
  network: z.enum(["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]),
  planId: z.string().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  message: z.string().max(200).optional(),
});

export const createGiftDataApiSchema = z.object({
  recipientPhone: z.string().min(10).max(15),
  planId: z.string().min(1),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
  message: z.string().max(500).optional(),
});

export type GiftData = typeof giftData.$inferSelect;
export type InsertGiftData = z.infer<typeof insertGiftDataSchema>;
export type CreateGiftDataInput = z.infer<typeof createGiftDataApiSchema>;
