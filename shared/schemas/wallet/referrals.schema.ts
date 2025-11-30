import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const referrals = pgTable("referrals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  referredId: varchar("referred_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bonusAmount: decimal("bonus_amount", { precision: 10, scale: 2 }).default("100.00"),
  bonusPaid: boolean("bonus_paid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_referrals_referrer").on(table.referrerId),
]);

export const welcomeBonuses = pgTable("welcome_bonuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).default("50.00"),
  claimed: boolean("claimed").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_welcome_bonuses_user").on(table.userId),
]);

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  bonusPaid: true,
});

export const insertWelcomeBonusSchema = createInsertSchema(welcomeBonuses).omit({
  id: true,
  createdAt: true,
  claimed: true,
});

export const createReferralSchema = z.object({
  referredUserId: z.string().min(1, "Referred user ID is required"),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type WelcomeBonus = typeof welcomeBonuses.$inferSelect;
export type InsertWelcomeBonus = z.infer<typeof insertWelcomeBonusSchema>;
