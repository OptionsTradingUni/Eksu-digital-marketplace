import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const rewardTransactionTypeEnum = pgEnum("reward_transaction_type", [
  "earned", "redeemed", "expired", "bonus", "referral", "purchase", "activity"
]);

export const rewardPoints = pgTable("reward_points", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  totalPoints: integer("total_points").default(0),
  availablePoints: integer("available_points").default(0),
  lifetimePoints: integer("lifetime_points").default(0),
  tier: varchar("tier", { length: 20 }).default("bronze"),
  tierProgress: integer("tier_progress").default(0),
  nextTierThreshold: integer("next_tier_threshold").default(1000),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reward_points_user").on(table.userId),
  index("idx_reward_points_tier").on(table.tier),
]);

export const rewardTransactions = pgTable("reward_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: rewardTransactionTypeEnum("type").notNull(),
  points: integer("points").notNull(),
  description: text("description"),
  referenceId: varchar("reference_id"),
  referenceType: varchar("reference_type", { length: 50 }),
  metadata: jsonb("metadata"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reward_transactions_user").on(table.userId),
  index("idx_reward_transactions_type").on(table.type),
  index("idx_reward_transactions_created").on(table.createdAt),
]);

export const rewardRedemptionOptions = pgTable("reward_redemption_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  pointsCost: integer("points_cost").notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  valueType: varchar("value_type", { length: 50 }).default("wallet_credit"),
  category: varchar("category", { length: 50 }),
  imageUrl: text("image_url"),
  stock: integer("stock"),
  isActive: boolean("is_active").default(true),
  minTier: varchar("min_tier", { length: 20 }),
  termsAndConditions: text("terms_and_conditions"),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_reward_redemption_options_active").on(table.isActive),
  index("idx_reward_redemption_options_category").on(table.category),
]);

export const insertRewardPointsSchema = createInsertSchema(rewardPoints).omit({
  id: true,
  updatedAt: true,
});

export const insertRewardTransactionSchema = createInsertSchema(rewardTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertRewardRedemptionOptionSchema = createInsertSchema(rewardRedemptionOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const redeemRewardsSchema = z.object({
  optionId: z.string().min(1, "Redemption option is required"),
  quantity: z.number().min(1).default(1),
});

export type RewardPoints = typeof rewardPoints.$inferSelect;
export type InsertRewardPoints = z.infer<typeof insertRewardPointsSchema>;
export type RewardTransaction = typeof rewardTransactions.$inferSelect;
export type InsertRewardTransaction = z.infer<typeof insertRewardTransactionSchema>;
export type RewardRedemptionOption = typeof rewardRedemptionOptions.$inferSelect;
export type InsertRewardRedemptionOption = z.infer<typeof insertRewardRedemptionOptionSchema>;
