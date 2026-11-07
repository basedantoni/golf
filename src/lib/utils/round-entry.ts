// Entering a Round: the input shared by the form and rounds.create, and the
// round_stats row derived from its Played Holes. Terms: GLOSSARY.md.
import { z } from "zod";

const miss = ["left", "right", "short", "long"] as const;

const enteredHole = z
  .object({
    holeNumber: z.number().int().min(1).max(18), // Played Hole; back nine = 10-18
    par: z.number().int().min(3).max(6),
    strokes: z.number().int().min(1).max(15),
    putts: z.number().int().min(0).max(9).nullable(),
    fairway: z.enum(["hit", ...miss]).nullable(),
    gir: z.enum(["hit", ...miss, "noChance"]).nullable(),
  })
  // Par 3s have no fairway, even if one was picked before the Par was edited.
  .transform((h) => (h.par === 3 ? { ...h, fairway: null } : h));

export type EnteredHole = z.output<typeof enteredHole>;

export const createRoundInput = z.object({
  userId: z.string(),
  // An existing Club, or a new one with its Course's hole count
  club: z.union([
    z.object({ id: z.string() }),
    z.object({ name: z.string().trim().min(1), holeCount: z.union([z.literal(9), z.literal(18)]) }),
  ]),
  timestamp: z.number().int(), // epoch ms, like rounds.timestamp
  holes: z.array(enteredHole).refine((holes) => {
    const nums = holes.map((h) => h.holeNumber).sort((a, b) => a - b);
    const start = nums[0];
    const shape = (holes.length === 18 && start === 1) || (holes.length === 9 && (start === 1 || start === 10));
    return shape && nums.every((n, i) => n === start + i);
  }, "Played Holes must be 1-9, 10-18 or 1-18"),
});

export function roundStatsFromHoles(holes: EnteredHole[]) {
  const count = (pred: (h: EnteredHole) => boolean) => holes.filter(pred).length;
  const diff = (h: EnteredHole) => h.strokes - h.par;

  return {
    // The export's buckets: an Ace counts only as an Ace.
    aces: count((h) => h.strokes === 1),
    doubleEagleOrBetter: count((h) => h.strokes > 1 && diff(h) <= -3),
    eagles: count((h) => h.strokes > 1 && diff(h) === -2),
    birdies: count((h) => diff(h) === -1),
    pars: count((h) => diff(h) === 0),
    bogeys: count((h) => diff(h) === 1),
    doubleBogeyOrWorse: count((h) => diff(h) >= 2),

    fairwayMiddles: count((h) => h.fairway === "hit"),
    fairwayLefts: count((h) => h.fairway === "left"),
    fairwayRights: count((h) => h.fairway === "right"),
    fairwayShorts: count((h) => h.fairway === "short"),
    fairwayLongs: count((h) => h.fairway === "long"),
    fairwayHoleCount: count((h) => h.fairway !== null),

    gir: count((h) => h.gir === "hit"),
    girLefts: count((h) => h.gir === "left"),
    girRights: count((h) => h.gir === "right"),
    girShorts: count((h) => h.gir === "short"),
    girLongs: count((h) => h.gir === "long"),
    girNoChances: count((h) => h.gir === "noChance"),
    girHoleCount: count((h) => h.gir !== null),

    putts: holes.reduce((sum, h) => sum + (h.putts ?? 0), 0),
    puttHoleCount: count((h) => h.putts !== null),

    // Explicit, since the columns default to 100.
    strokeGainOverall: null,
    strokeGainTeeToGreen: null,
  };
}
