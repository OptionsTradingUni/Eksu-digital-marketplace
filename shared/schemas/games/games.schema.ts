import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  integer,
  decimal,
  pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from '../auth/users.schema';

export const gameTypeEnum = pgEnum("game_type", ["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price", "aviator", "colour_colour", "spin_wheel", "draughts", "ayo_olopon", "dice_duel"]);
export const gameStatusEnum = pgEnum("game_status", ["waiting", "in_progress", "completed", "cancelled"]);
export const gameModeEnum = pgEnum("game_mode", ["single_player", "multiplayer"]);

export const games = pgTable("games", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: gameTypeEnum("game_type").notNull(),
  player1Id: varchar("player1_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  player2Id: varchar("player2_id").references(() => users.id, { onDelete: "cascade" }),
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }).notNull(),
  status: gameStatusEnum("status").notNull().default("waiting"),
  winnerId: varchar("winner_id").references(() => users.id, { onDelete: "set null" }),
  gameData: jsonb("game_data"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const gameMatches = pgTable("game_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull().default(1),
  player1Score: integer("player1_score").default(0),
  player2Score: integer("player2_score").default(0),
  roundData: jsonb("round_data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertGameSchema = createInsertSchema(games).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});

export const insertGameMatchSchema = createInsertSchema(gameMatches).omit({
  id: true,
  createdAt: true,
});

export const createGameSchema = z.object({
  gameType: z.enum(["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price", "aviator", "colour_colour", "spin_wheel", "draughts", "ayo_olopon", "dice_duel"]),
  stakeAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid stake amount"),
  mode: z.enum(["single_player", "multiplayer"]).optional().default("multiplayer"),
});

export const joinGameSchema = z.object({
  gameId: z.string(),
});

export const completeGameSchema = z.object({
  winnerId: z.string(),
});

export type Game = typeof games.$inferSelect;
export type InsertGame = z.infer<typeof insertGameSchema>;
export type GameMatch = typeof gameMatches.$inferSelect;
export type InsertGameMatch = z.infer<typeof insertGameMatchSchema>;
