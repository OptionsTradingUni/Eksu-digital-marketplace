import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
  decimal,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { resellerSites } from './sites.schema';

export const resellerCustomers = pgTable("reseller_customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resellerId: varchar("reseller_id").notNull().references(() => resellerSites.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  email: varchar("email", { length: 200 }),
  totalPurchases: integer("total_purchases").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0.00"),
  lastPurchaseAt: timestamp("last_purchase_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_reseller_customers_reseller").on(table.resellerId),
  index("idx_reseller_customers_phone").on(table.phoneNumber),
]);

export const insertResellerCustomerSchema = createInsertSchema(resellerCustomers).omit({
  id: true,
  createdAt: true,
  totalPurchases: true,
  totalSpent: true,
  lastPurchaseAt: true,
});

export type ResellerCustomer = typeof resellerCustomers.$inferSelect;
export type InsertResellerCustomer = z.infer<typeof insertResellerCustomerSchema>;
