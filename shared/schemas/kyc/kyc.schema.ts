import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
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

export const kycStatusEnum = pgEnum("kyc_status", ["pending", "in_review", "approved", "rejected", "expired"]);
export const kycDocumentTypeEnum = pgEnum("kyc_document_type", ["nin", "bvn", "drivers_license", "passport", "student_id"]);

export const kycVerifications = pgTable("kyc_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  documentType: kycDocumentTypeEnum("document_type").notNull(),
  documentNumber: varchar("document_number", { length: 50 }),
  documentNumberHash: varchar("document_number_hash", { length: 100 }),
  documentImage: text("document_image"),
  selfieImage: text("selfie_image"),
  fullName: varchar("full_name", { length: 200 }),
  dateOfBirth: timestamp("date_of_birth"),
  gender: varchar("gender", { length: 20 }),
  address: text("address"),
  status: kycStatusEnum("status").default("pending"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  verificationData: jsonb("verification_data"),
  rejectionReason: text("rejection_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_kyc_verifications_user").on(table.userId),
  index("idx_kyc_verifications_status").on(table.status),
  index("idx_kyc_verifications_type").on(table.documentType),
]);

export const kycVerificationLogs = pgTable("kyc_verification_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  verificationId: varchar("verification_id").notNull().references(() => kycVerifications.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(),
  previousStatus: kycStatusEnum("previous_status"),
  newStatus: kycStatusEnum("new_status"),
  performedBy: varchar("performed_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_kyc_logs_verification").on(table.verificationId),
  index("idx_kyc_logs_action").on(table.action),
]);

export const insertKycVerificationSchema = createInsertSchema(kycVerifications).omit({
  id: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const submitKycSchema = z.object({
  documentType: z.enum(["nin", "bvn", "drivers_license", "passport", "student_id"]),
  documentNumber: z.string().min(1, "Document number is required"),
  documentImage: z.string().optional(),
  selfieImage: z.string().optional(),
});

export const initiateKycSchema = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  consent: z.boolean().refine(val => val === true, "You must agree to the verification terms"),
});

export const reviewKycSchema = z.object({
  kycId: z.string().min(1, "KYC ID is required"),
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export type KycVerification = typeof kycVerifications.$inferSelect;
export type InsertKycVerification = z.infer<typeof insertKycVerificationSchema>;
export type KycVerificationLog = typeof kycVerificationLogs.$inferSelect;
export type InitiateKycInput = z.infer<typeof initiateKycSchema>;
export type ReviewKycInput = z.infer<typeof reviewKycSchema>;
