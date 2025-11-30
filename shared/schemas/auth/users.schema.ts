import { sql } from "drizzle-orm";
import {
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

export const userRoleEnum = pgEnum("user_role", ["buyer", "seller", "both", "admin"]);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull().unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  username: varchar("username", { length: 30 }).unique(),
  profileImageUrl: varchar("profile_image_url"),
  coverImageUrl: varchar("cover_image_url"),
  role: userRoleEnum("role").notNull().default("buyer"),
  referralCode: varchar("referral_code", { length: 8 }).unique(),
  phoneNumber: varchar("phone_number").unique(),
  location: varchar("location"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  lastLocationUpdate: timestamp("last_location_update"),
  bio: text("bio"),
  gender: varchar("gender", { length: 20 }),
  isSystemAccount: boolean("is_system_account").default(false),
  systemAccountType: varchar("system_account_type", { length: 20 }),
  isVerified: boolean("is_verified").default(false),
  verificationBadges: text("verification_badges").array().default(sql`ARRAY[]::text[]`),
  ninVerified: boolean("nin_verified").default(false),
  ninVerificationDate: timestamp("nin_verification_date"),
  ninHash: varchar("nin_hash").unique(),
  ninVnin: varchar("nin_vnin"),
  ninConfidenceScore: decimal("nin_confidence_score", { precision: 5, scale: 2 }),
  instagramHandle: varchar("instagram_handle"),
  tiktokHandle: varchar("tiktok_handle"),
  facebookProfile: varchar("facebook_profile"),
  trustScore: decimal("trust_score", { precision: 3, scale: 1 }).default("5.0"),
  totalRatings: integer("total_ratings").default(0),
  isTrustedSeller: boolean("is_trusted_seller").default(false),
  trustedSellerSince: timestamp("trusted_seller_since"),
  totalSales: integer("total_sales").default(0),
  responseTime: integer("response_time"),
  studentIdImage: text("student_id_image"),
  selfieImage: text("selfie_image"),
  verificationRequestedAt: timestamp("verification_requested_at"),
  verificationReviewedAt: timestamp("verification_reviewed_at"),
  verificationReviewedBy: varchar("verification_reviewed_by"),
  verificationNotes: text("verification_notes"),
  isActive: boolean("is_active").default(true),
  isBanned: boolean("is_banned").default(false),
  emailVerified: boolean("email_verified").default(false),
  banReason: text("ban_reason"),
  transactionPin: varchar("transaction_pin", { length: 100 }),
  transactionPinSet: boolean("transaction_pin_set").default(false),
  pinAttempts: integer("pin_attempts").default(0),
  pinLockUntil: timestamp("pin_lock_until"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
});

export const updateUserProfileSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  location: true,
  bio: true,
  profileImageUrl: true,
  gender: true,
  instagramHandle: true,
  tiktokHandle: true,
}).partial();

export const roleUpdateSchema = z.object({
  role: z.enum(['buyer', 'seller']),
});

export const verifyNINSchema = z.object({
  nin: z.string().length(11, "NIN must be exactly 11 digits"),
  selfieBase64: z.string().min(1, "Selfie image is required"),
});

export const updateSocialMediaSchema = z.object({
  instagramHandle: z.string().optional(),
  tiktokHandle: z.string().optional(),
  facebookProfile: z.string().optional(),
});

export const requestVerificationSchema = z.object({
  studentIdImage: z.string().min(1, "Student ID image is required"),
  selfieImage: z.string().min(1, "Selfie image is required"),
});

export const reviewVerificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  approved: z.boolean(),
  notes: z.string().max(500).optional(),
});

export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, 'password'>;

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores")
    .transform(val => val.toLowerCase()),
  phoneNumber: z.string().optional(),
  role: z.enum(["buyer", "seller", "both"]).optional().default("buyer"),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const setupPinSchema = z.object({
  pin: z.string()
    .min(4, "PIN must be at least 4 digits")
    .max(6, "PIN must be at most 6 digits")
    .regex(/^\d+$/, "PIN must contain only numbers"),
  confirmPin: z.string()
    .min(4, "Confirm PIN must be at least 4 digits")
    .max(6, "Confirm PIN must be at most 6 digits")
    .regex(/^\d+$/, "Confirm PIN must contain only numbers"),
}).refine((data) => data.pin === data.confirmPin, {
  message: "PINs do not match",
  path: ["confirmPin"],
});

export const changePinSchema = z.object({
  currentPin: z.string()
    .min(4, "Current PIN must be at least 4 digits")
    .max(6, "Current PIN must be at most 6 digits")
    .regex(/^\d+$/, "Current PIN must contain only numbers"),
  newPin: z.string()
    .min(4, "New PIN must be at least 4 digits")
    .max(6, "New PIN must be at most 6 digits")
    .regex(/^\d+$/, "New PIN must contain only numbers"),
  confirmNewPin: z.string()
    .min(4, "Confirm PIN must be at least 4 digits")
    .max(6, "Confirm PIN must be at most 6 digits")
    .regex(/^\d+$/, "Confirm PIN must contain only numbers"),
}).refine((data) => data.newPin === data.confirmNewPin, {
  message: "New PINs do not match",
  path: ["confirmNewPin"],
});

export const verifyPinSchema = z.object({
  pin: z.string()
    .min(4, "PIN must be at least 4 digits")
    .max(6, "PIN must be at most 6 digits")
    .regex(/^\d+$/, "PIN must contain only numbers"),
});

export const resetPinRequestSchema = z.object({});

export const resetPinConfirmSchema = z.object({
  code: z.string().length(6, "Reset code must be 6 digits"),
  newPin: z.string()
    .min(4, "New PIN must be at least 4 digits")
    .max(6, "New PIN must be at most 6 digits")
    .regex(/^\d+$/, "New PIN must contain only numbers"),
  confirmNewPin: z.string()
    .min(4, "Confirm PIN must be at least 4 digits")
    .max(6, "Confirm PIN must be at most 6 digits")
    .regex(/^\d+$/, "Confirm PIN must contain only numbers"),
}).refine((data) => data.newPin === data.confirmNewPin, {
  message: "New PINs do not match",
  path: ["confirmNewPin"],
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SetupPinInput = z.infer<typeof setupPinSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
export type ResetPinConfirmInput = z.infer<typeof resetPinConfirmSchema>;
