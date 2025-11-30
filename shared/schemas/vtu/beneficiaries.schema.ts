import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';
import { vtuNetworkEnum } from './plans.schema';

export const vtuBeneficiaries = pgTable("vtu_beneficiaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 20 }).notNull(),
  network: vtuNetworkEnum("network"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_vtu_beneficiaries_user").on(table.userId),
]);

export const insertVtuBeneficiarySchema = createInsertSchema(vtuBeneficiaries).omit({
  id: true,
  createdAt: true,
});

export const addBeneficiarySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phoneNumber: z.string().min(11, "Phone number must be at least 11 digits"),
  network: z.enum(["mtn", "airtel", "glo", "9mobile", "spectranet", "smile"]).optional(),
});

export const createBeneficiarySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  phoneNumber: z.string().min(10, "Valid phone number is required").max(15),
  network: z.enum(["mtn_sme", "glo_cg", "airtel_cg", "9mobile"]),
});

export type VtuBeneficiary = typeof vtuBeneficiaries.$inferSelect;
export type InsertVtuBeneficiary = z.infer<typeof insertVtuBeneficiarySchema>;
export type CreateBeneficiaryInput = z.infer<typeof createBeneficiarySchema>;
