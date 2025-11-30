import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const billServiceTypeEnum = pgEnum("bill_service_type", ["electricity", "cable", "internet"]);
export const billStatusEnum = pgEnum("bill_status", ["pending", "processing", "completed", "failed"]);

export const billPayments = pgTable("bill_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceType: billServiceTypeEnum("service_type").notNull(),
  provider: varchar("provider", { length: 100 }).notNull(),
  accountNumber: varchar("account_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 200 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: billStatusEnum("status").default("pending"),
  transactionRef: varchar("transaction_ref").unique(),
  token: varchar("token"),
  apiResponse: jsonb("api_response"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_bill_payments_user").on(table.userId),
  index("idx_bill_payments_status").on(table.status),
]);

export const insertBillPaymentSchema = createInsertSchema(billPayments).omit({
  id: true,
  createdAt: true,
  completedAt: true,
  token: true,
  apiResponse: true,
});

export const payBillSchema = z.object({
  serviceType: z.enum(["electricity", "cable", "internet"]),
  provider: z.string().min(1, "Provider is required"),
  accountNumber: z.string().min(1, "Account number is required"),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
});

export const validateCustomerSchema = z.object({
  serviceType: z.enum(["dstv", "gotv", "startimes", "showmax", "ekedc", "ikedc", "aedc", "ibedc", "phedc", "eedc"]),
  customerId: z.string().min(1, "Customer ID is required"),
});

export type BillPayment = typeof billPayments.$inferSelect;
export type InsertBillPayment = z.infer<typeof insertBillPaymentSchema>;
export type ValidateCustomerInput = z.infer<typeof validateCustomerSchema>;
