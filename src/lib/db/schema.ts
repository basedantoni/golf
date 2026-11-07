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
const selectUserSchema = createSelectSchema(users);
export const userIdSchema = selectUserSchema.pick({ id: true });

// Golf Clubs/Courses
export const clubs = sqliteTable("clubs", {
  id: text()
    .primaryKey()
    .$defaultFn(() => nanoid()),
  name: text().notNull(),
});

// A Course's Holes; row count is its hole count. Usual Par null = Par Unknown. See ADR 0002.
export const courseHoles = sqliteTable(
  "course_holes",
  {
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id),
    holeNumber: integer("hole_number").notNull(),
    par: integer(),
    // Other pars this Hole plays to, depending on tee (Usual Par is always tried too)
    variantPars: text("variant_pars", { mode: "json" }).$type<number[]>(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clubId, table.holeNumber] }),
  }),
);

// Golf Rounds
export const rounds = sqliteTable(
  "rounds",
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => nanoid()),
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

// Hole-by-hole strokes for each round
export const roundHoles = sqliteTable(
  "round_holes",
  {
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id),
    holeNumber: integer("hole_number").notNull(),
    strokes: integer().notNull(),
    // Par as played that day (tee variants differ); null = Par Unknown. See ADR 0001.
    par: integer(),
    // Optional detail, null = not logged. No fairway on par 3s.
    putts: integer(),
    fairway: text({ enum: ["hit", "left", "right", "short", "long"] }),
    gir: text({ enum: ["hit", "left", "right", "short", "long", "noChance"] }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roundId, table.holeNumber] }),
    roundIdIdx: index("idx_round_holes_round_id").on(table.roundId),
  }),
);

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

