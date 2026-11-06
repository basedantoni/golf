// Per-Hole Results for one Course, from its Played Holes. Terms: GLOSSARY.md.

export type PlayedHole = { holeNumber: number; strokes: number; par: number | null };

export type BestResult = "eagleOrBetter" | "birdie" | "par" | "notYet" | "parUnknown";

export type HoleSummary = {
  hole: number;
  usualPars: number[];
  timesPlayed: number;
  eagleOrBetter: number;
  birdies: number;
  pars: number;
  aces: number;
  best: BestResult;
};

export function summarizeHoles(playedHoles: PlayedHole[], courseHoleCount: number): HoleSummary[] {
  const holes = Array.from({ length: courseHoleCount }, (_, i) => ({
    hole: i + 1,
    usualPars: [] as number[],
    timesPlayed: 0,
    eagleOrBetter: 0,
    birdies: 0,
    pars: 0,
    aces: 0,
  }));

  for (const { holeNumber, strokes, par } of playedHoles) {
    // A 9-hole Course played as 18: Played Holes 10-18 are Holes 1-9 again.
    const hole = holes[(holeNumber - 1) % courseHoleCount];
    if (par !== null && !hole.usualPars.includes(par)) hole.usualPars.push(par);
    if (!strokes) continue; // no score entered
    hole.timesPlayed++;
    if (par === null) continue;
    if (strokes === 1) hole.aces++;
    const diff = strokes - par;
    if (diff <= -2) hole.eagleOrBetter++;
    else if (diff === -1) hole.birdies++;
    else if (diff === 0) hole.pars++;
  }

  return holes.map((h) => ({
    ...h,
    usualPars: h.usualPars.sort((a, b) => a - b),
    best:
      h.usualPars.length === 0 ? "parUnknown"
      : h.eagleOrBetter ? "eagleOrBetter"
      : h.birdies ? "birdie"
      : h.pars ? "par"
      : "notYet",
  }));
}
