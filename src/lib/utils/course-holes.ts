// Per-Hole Results for one Course, from its Played Holes. Terms: GLOSSARY.md.

export type PlayedHole = { holeNumber: number; strokes: number; par: number | null };

export type BestResult = "eagleOrBetter" | "birdie" | "par" | "notYet" | "parUnknown";

export type HoleSummary = {
  hole: number;
  parsPlayed: number[];
  timesPlayed: number;
  eagleOrBetter: number;
  birdies: number;
  parCount: number;
  aces: number;
  best: BestResult;
};

export function summarizeHoles(playedHoles: PlayedHole[], courseHoleCount: number): HoleSummary[] {
  const holes = Array.from({ length: courseHoleCount }, (_, i) => ({
    hole: i + 1,
    parsPlayed: [] as number[],
    timesPlayed: 0,
    eagleOrBetter: 0,
    birdies: 0,
    parCount: 0,
    aces: 0,
  }));

  for (const { holeNumber, strokes, par } of playedHoles) {
    // A 9-hole Course played as 18: Played Holes 10-18 are Holes 1-9 again.
    const hole = holes[(holeNumber - 1) % courseHoleCount];
    if (par !== null && !hole.parsPlayed.includes(par)) hole.parsPlayed.push(par);
    if (!strokes) continue; // no score entered
    hole.timesPlayed++;
    if (par === null) continue;
    if (strokes === 1) hole.aces++;
    const diff = strokes - par;
    if (diff <= -2) hole.eagleOrBetter++;
    else if (diff === -1) hole.birdies++;
    else if (diff === 0) hole.parCount++;
  }

  return holes.map((h) => ({
    ...h,
    parsPlayed: h.parsPlayed.sort((a, b) => a - b),
    best:
      h.parsPlayed.length === 0 ? "parUnknown"
      : h.eagleOrBetter ? "eagleOrBetter"
      : h.birdies ? "birdie"
      : h.parCount ? "par"
      : "notYet",
  }));
}

// "7/9 Holes Par or better · 4 birdied"
export function courseProgress(holes: HoleSummary[]) {
  const atLeast = (results: BestResult[]) => holes.filter((h) => results.includes(h.best)).length;
  return {
    parOrBetter: atLeast(["eagleOrBetter", "birdie", "par"]),
    birdied: atLeast(["eagleOrBetter", "birdie"]),
    total: holes.length,
  };
}
