import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const vtuNetworkEnum = pgEnum("vtu_network", ["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]);

export const vtuPlans = pgTable("vtu_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  network: vtuNetworkEnum("network").notNull(),
  planName: varchar("plan_name", { length: 100 }).notNull(),
  dataAmount: varchar("data_amount", { length: 50 }),
  validity: varchar("validity", { length: 50 }),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 10, scale: 2 }),
  planCode: varchar("plan_code", { length: 50 }),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
}, (table) => [
  index("idx_vtu_plans_network").on(table.network),
]);

export const insertVtuPlanSchema = createInsertSchema(vtuPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type VtuPlan = typeof vtuPlans.$inferSelect;
export type InsertVtuPlan = z.infer<typeof insertVtuPlanSchema>;
