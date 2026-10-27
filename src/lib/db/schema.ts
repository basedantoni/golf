import {
  int,
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
import { nanoid } from "nanoid";
import {
  createSelectSchema,
  createInsertSchema,
  createUpdateSchema,
} from "drizzle-zod";

export const users = sqliteTable("users", {
  id: text()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text().notNull(),
  age: int().notNull(),
  email: text().notNull().unique(),
});

export const insertUserSchema = createInsertSchema(users);
export const updateUserSchema = createUpdateSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const userIdSchema = selectUserSchema.pick({ id: true });

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// Golf Clubs/Courses
export const clubs = sqliteTable("clubs", {
  id: text().primaryKey(),
  name: text().notNull(),
});

export const insertClubSchema = createInsertSchema(clubs);
export const selectClubSchema = createSelectSchema(clubs);

export type Club = typeof clubs.$inferSelect;
export type NewClub = typeof clubs.$inferInsert;

// Golf Rounds
export const rounds = sqliteTable(
  "rounds",
  {
    id: text().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id),
    timestamp: integer().notNull(),
    score: integer().notNull(),
    strokes: integer().notNull(),
  },
  (table) => ({
    userIdIdx: index("idx_rounds_user_id").on(table.userId),
    clubIdIdx: index("idx_rounds_club_id").on(table.clubId),
    timestampIdx: index("idx_rounds_timestamp").on(table.timestamp),
  }),
);

export const insertRoundSchema = createInsertSchema(rounds);
export const selectRoundSchema = createSelectSchema(rounds);

export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;

// Hole-by-hole strokes for each round
export const roundHoles = sqliteTable(
  "round_holes",
  {
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id),
    holeNumber: integer("hole_number").notNull(),
    strokes: integer().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roundId, table.holeNumber] }),
    roundIdIdx: index("idx_round_holes_round_id").on(table.roundId),
  }),
);

export const insertRoundHoleSchema = createInsertSchema(roundHoles);
export const selectRoundHoleSchema = createSelectSchema(roundHoles);

export type RoundHole = typeof roundHoles.$inferSelect;
export type NewRoundHole = typeof roundHoles.$inferInsert;

// Round Statistics
export const roundStats = sqliteTable("round_stats", {
  roundId: text("round_id")
    .primaryKey()
    .references(() => rounds.id),
  aces: integer().default(0),
  doubleEagleOrBetter: integer("double_eagle_or_better").default(0),
  eagles: integer().default(0),
  birdies: integer().default(0),
  pars: integer().default(0),
  bogeys: integer().default(0),
  doubleBogeyOrWorse: integer("double_bogey_or_worse").default(0),

  // Fairway stats
  fairwayLefts: integer("fairway_lefts").default(0),
  fairwayMiddles: integer("fairway_middles").default(0),
  fairwayRights: integer("fairway_rights").default(0),
  fairwayShorts: integer("fairway_shorts").default(0),
  fairwayLongs: integer("fairway_longs").default(0),
  fairwayHoleCount: integer("fairway_hole_count").default(0),

  // Green in Regulation (GIR) stats
  gir: integer().default(0),
  girLefts: integer("gir_lefts").default(0),
  girRights: integer("gir_rights").default(0),
  girShorts: integer("gir_shorts").default(0),
  girLongs: integer("gir_longs").default(0),
  girNoChances: integer("gir_no_chances").default(0),
  girHoleCount: integer("gir_hole_count").default(0),

  // Putting stats
  putts: integer().default(0),
  puttHoleCount: integer("putt_hole_count").default(0),

  // Stroke gain stats
  strokeGainOverall: integer("stroke_gain_overall").default(100),
  strokeGainTeeToGreen: integer("stroke_gain_tee_to_green").default(100),
});

export const insertRoundStatsSchema = createInsertSchema(roundStats);
export const selectRoundStatsSchema = createSelectSchema(roundStats);

export type RoundStats = typeof roundStats.$inferSelect;
export type NewRoundStats = typeof roundStats.$inferInsert;

// Recommended stats for each round
export const roundRecommendedStats = sqliteTable(
  "round_recommended_stats",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id),
    type: text().notNull(),
    noStats: integer("no_stats", { mode: "boolean" }).default(false),
    value: real(),
  },
  (table) => ({
    roundIdIdx: index("idx_recommended_stats_round_id").on(table.roundId),
  }),
);

export const insertRoundRecommendedStatsSchema = createInsertSchema(
  roundRecommendedStats,
);
export const selectRoundRecommendedStatsSchema = createSelectSchema(
  roundRecommendedStats,
);

export type RoundRecommendedStats = typeof roundRecommendedStats.$inferSelect;
export type NewRoundRecommendedStats =
  typeof roundRecommendedStats.$inferInsert;

// Club relationships
export const userFollowedClubs = sqliteTable(
  "user_followed_clubs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.clubId] }),
  }),
);

export const userPlayedClubs = sqliteTable(
  "user_played_clubs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.clubId] }),
  }),
);

export const userPostedInClubs = sqliteTable(
  "user_posted_in_clubs",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.clubId] }),
  }),
);

export const insertUserFollowedClubSchema =
  createInsertSchema(userFollowedClubs);
export const insertUserPlayedClubSchema = createInsertSchema(userPlayedClubs);
export const insertUserPostedInClubSchema =
  createInsertSchema(userPostedInClubs);

export type UserFollowedClub = typeof userFollowedClubs.$inferSelect;
export type UserPlayedClub = typeof userPlayedClubs.$inferSelect;
export type UserPostedInClub = typeof userPostedInClubs.$inferSelect;
