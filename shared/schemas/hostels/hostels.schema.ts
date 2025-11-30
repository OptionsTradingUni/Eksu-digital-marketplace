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

export const hostelStatusEnum = pgEnum("hostel_status", ["available", "booked", "maintenance"]);
export const hostelTypeEnum = pgEnum("hostel_type", ["single", "shared", "self_contain", "apartment"]);
export const eventTypeEnum = pgEnum("event_type", ["party", "conference", "workshop", "concert", "other"]);
export const eventStatusEnum = pgEnum("event_status", ["upcoming", "ongoing", "completed", "cancelled"]);

export const hostels = pgTable("hostels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  type: hostelTypeEnum("type").notNull(),
  location: varchar("location", { length: 500 }).notNull(),
  address: text("address"),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  priceType: varchar("price_type", { length: 20 }).default("yearly"),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  amenities: text("amenities").array().default(sql`ARRAY[]::text[]`),
  rules: text("rules").array().default(sql`ARRAY[]::text[]`),
  roomsAvailable: integer("rooms_available").default(1),
  totalRooms: integer("total_rooms").default(1),
  status: hostelStatusEnum("status").default("available"),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("0.0"),
  totalReviews: integer("total_reviews").default(0),
  contactPhone: varchar("contact_phone", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  viewsCount: integer("views_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_hostels_owner").on(table.ownerId),
  index("idx_hostels_location").on(table.location),
  index("idx_hostels_type").on(table.type),
  index("idx_hostels_status").on(table.status),
]);

export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizerId: varchar("organizer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  type: eventTypeEnum("type").notNull(),
  location: varchar("location", { length: 500 }).notNull(),
  venue: varchar("venue", { length: 300 }),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  images: text("images").array().default(sql`ARRAY[]::text[]`),
  ticketPrice: decimal("ticket_price", { precision: 10, scale: 2 }).default("0.00"),
  isFree: boolean("is_free").default(true),
  maxAttendees: integer("max_attendees"),
  currentAttendees: integer("current_attendees").default(0),
  status: eventStatusEnum("status").default("upcoming"),
  isVerified: boolean("is_verified").default(false),
  isFeatured: boolean("is_featured").default(false),
  contactPhone: varchar("contact_phone", { length: 20 }),
  contactEmail: varchar("contact_email", { length: 200 }),
  externalUrl: varchar("external_url", { length: 500 }),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  viewsCount: integer("views_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_events_organizer").on(table.organizerId),
  index("idx_events_start_date").on(table.startDate),
  index("idx_events_type").on(table.type),
  index("idx_events_status").on(table.status),
]);

export const insertHostelSchema = createInsertSchema(hostels).omit({
  id: true,
  rating: true,
  totalReviews: true,
  viewsCount: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  currentAttendees: true,
  viewsCount: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
});

export const createHostelSchema = z.object({
  name: z.string().min(5, "Name must be at least 5 characters").max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["single", "shared", "self_contain", "apartment"]),
  location: z.string().min(5, "Location is required"),
  address: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid price"),
  priceType: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  images: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  rules: z.array(z.string()).optional(),
  roomsAvailable: z.number().min(1).optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().max(2000).optional(),
  type: z.enum(["party", "conference", "workshop", "concert", "other"]),
  location: z.string().min(5, "Location is required"),
  venue: z.string().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()).optional(),
  images: z.array(z.string()).optional(),
  ticketPrice: z.string().optional(),
  isFree: z.boolean().optional(),
  maxAttendees: z.number().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  externalUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

export type Hostel = typeof hostels.$inferSelect;
export type InsertHostel = z.infer<typeof insertHostelSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
