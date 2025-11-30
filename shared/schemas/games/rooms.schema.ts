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
import { gameTypeEnum } from './games.schema';

export const gameRoomStatusEnum = pgEnum("game_room_status", ["waiting", "ready", "playing", "paused", "finished", "abandoned"]);

export const gameRooms = pgTable("game_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameType: gameTypeEnum("game_type").notNull(),
  roomCode: varchar("room_code", { length: 8 }).unique().notNull(),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: gameRoomStatusEnum("status").default("waiting"),
  maxPlayers: integer("max_players").default(4),
  currentPlayers: integer("current_players").default(1),
  stakeAmount: decimal("stake_amount", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isPrivate: boolean("is_private").default(false),
  password: varchar("password", { length: 50 }),
  gameState: jsonb("game_state"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
}, (table) => [
  index("game_rooms_code_idx").on(table.roomCode),
  index("game_rooms_host_idx").on(table.hostId),
  index("game_rooms_status_idx").on(table.status),
]);

export const gameRoomPlayers = pgTable("game_room_players", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  playerNumber: integer("player_number").notNull(),
  isReady: boolean("is_ready").default(false),
  isConnected: boolean("is_connected").default(true),
  score: integer("score").default(0),
  position: integer("position"),
  playerState: jsonb("player_state"),
  joinedAt: timestamp("joined_at").defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("game_room_players_room_idx").on(table.roomId),
  index("game_room_players_user_idx").on(table.userId),
]);

export const gameChatMessages = pgTable("game_chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  type: varchar("type", { length: 20 }).default("text"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("game_chat_messages_room_idx").on(table.roomId),
]);

export const insertGameRoomSchema = createInsertSchema(gameRooms).omit({
  id: true,
  currentPlayers: true,
  createdAt: true,
  startedAt: true,
  finishedAt: true,
});

export const createGameRoomSchema = z.object({
  gameType: z.enum(["ludo", "word_battle", "trivia", "whot", "quick_draw", "speed_typing", "campus_bingo", "truth_or_dare", "guess_the_price", "aviator", "colour_colour", "spin_wheel", "draughts", "ayo_olopon", "dice_duel"]),
  stakeAmount: z.number().min(0).default(0),
  maxPlayers: z.number().min(2).max(10).default(4),
  isPrivate: z.boolean().optional(),
  password: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

export const joinGameRoomSchema = z.object({
  roomCode: z.string().length(8),
  password: z.string().optional(),
});

export type GameRoom = typeof gameRooms.$inferSelect;
export type InsertGameRoom = z.infer<typeof insertGameRoomSchema>;
export type CreateGameRoomInput = z.infer<typeof createGameRoomSchema>;
export type JoinGameRoomInput = z.infer<typeof joinGameRoomSchema>;
export type GameRoomPlayer = typeof gameRoomPlayers.$inferSelect;
export type GameChatMessage = typeof gameChatMessages.$inferSelect;
