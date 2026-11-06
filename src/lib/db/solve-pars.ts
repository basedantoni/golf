// One-off helper: proposes Usual Pars per Course for course-pars.json.
// The export has no per-hole par, so try every 3/4/5 layout and keep those that
// match each Round's total par and Result counts. A Hole's par is proposed only
// when every surviving layout agrees; otherwise null (fill from the scorecard).
// Run: pnpm tsx src/lib/db/solve-pars.ts > proposed-pars.json
import { readFileSync } from 'fs';
import { join } from 'path';

type ExportRound = {
  clubId: { id: string };
  score: number;
  strokes: number;
  holeStrokes: number[];
  stats: Record<string, number>;
};

const golfData = JSON.parse(readFileSync(join(process.cwd(), 'data.json'), 'utf-8'));
const names = new Map<string, string>(
  golfData.clubData.playedClubs.map((c: { clubId: string; name: string }) => [c.clubId, c.name]),
);

// Result buckets in the export's stats: eagle-or-better, birdie, par, bogey, double+
const bucket = (diff: number) => (diff <= -2 ? 0 : diff === -1 ? 1 : diff === 0 ? 2 : diff === 1 ? 3 : 4);

const targetCounts = (r: ExportRound) => [
  r.stats.eagles + r.stats.aces + r.stats.doubleEagleOrBetter,
  r.stats.birdies,
  r.stats.pars,
  r.stats.bogeys,
  r.stats.doubleBogeyOrWorse,
];

function* layouts(n: number): Generator<number[]> {
  const pars = Array(n).fill(3);
  while (true) {
    yield [...pars];
    let i = 0;
    while (i < n && pars[i] === 5) pars[i++] = 3;
    if (i === n) return;
    pars[i]++;
  }
}

// Per-Round Result counts over Played Holes [from, to) for a layout of `pars`
// (Played Holes past the layout wrap around, for 9-hole Courses played as 18).
function countsKey(rounds: ExportRound[], pars: number[], from: number, to: number) {
  return rounds
    .map((r) => {
      const c = [0, 0, 0, 0, 0];
      for (let i = from; i < Math.min(to, r.holeStrokes.length); i++) {
        const s = r.holeStrokes[i];
        if (s) c[bucket(s - pars[i % pars.length])]++;
      }
      return c.join(',');
    })
    .join('|');
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// Possible pars per Hole for a group of Rounds sharing hole count and total par,
// or null if no layout fits.
function solveGroup(rounds: ExportRound[], holeCount: number): Set<number>[] | null {
  const totalPar = rounds[0].strokes - rounds[0].score;
  const target = rounds.map((r) => targetCounts(r).join(',')).join('|');
  const possible = Array.from({ length: holeCount }, () => new Set<number>());
  let found = false;

  if (holeCount === 9) {
    for (const pars of layouts(9)) {
      if (sum(pars) * (rounds[0].holeStrokes.length / 9) !== totalPar) continue;
      if (countsKey(rounds, pars, 0, 18) !== target) continue;
      pars.forEach((p, i) => possible[i].add(p));
      found = true;
    }
    return found ? possible : null;
  }

  // 18 holes: meet in the middle on per-Round partial counts, grouped by half sum.
  const half = (from: number) => {
    const byKey = new Map<string, Map<number, number[][]>>();
    for (const pars of layouts(9)) {
      const full = from === 0 ? [...pars, ...Array(9).fill(0)] : [...Array(9).fill(0), ...pars];
      const key = countsKey(rounds, full, from, from + 9);
      const bySum = byKey.get(key) ?? new Map<number, number[][]>();
      bySum.set(sum(pars), [...(bySum.get(sum(pars)) ?? []), pars]);
      byKey.set(key, bySum);
    }
    return byKey;
  };
  const front = half(0);
  const back = half(9);
  const targets = rounds.map(targetCounts);

  for (const [fKey, fBySum] of front) {
    const need = fKey
      .split('|')
      .map((fc, r) => fc.split(',').map((x, b) => targets[r][b] - Number(x)).join(','))
      .join('|');
    const bBySum = back.get(need);
    if (!bBySum) continue;
    for (const [fSum, fLayouts] of fBySum) {
      const bLayouts = bBySum.get(totalPar - fSum);
      if (!bLayouts) continue;
      found = true;
      for (const f of fLayouts) f.forEach((p, i) => possible[i].add(p));
      for (const b of bLayouts) b.forEach((p, i) => possible[i + 9].add(p));
    }
  }
  return found ? possible : null;
}

const byClub = new Map<string, ExportRound[]>();
for (const r of golfData.activityData.rounds as ExportRound[]) {
  byClub.set(r.clubId.id, [...(byClub.get(r.clubId.id) ?? []), r]);
}

const proposed: Record<string, { name: string; pars: (number | null)[]; variants?: Record<string, number[]> }> = {};

for (const [clubId, rounds] of byClub) {
  // A Course with any 9-hole Round is treated as a 9-hole Course (true for all data so far).
  const holeCount = rounds.some((r) => r.holeStrokes.length === 9) ? 9 : 18;
  const groups = new Map<string, ExportRound[]>();
  for (const r of rounds) {
    const key = `${r.holeStrokes.length}:${r.strokes - r.score}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const solved = [...groups.entries()].map(([key, rs]) => ({ key, rounds: rs.length, possible: solveGroup(rs, holeCount) }));
  for (const g of solved) {
    console.error(`${names.get(clubId)} [${g.key}, ${g.rounds} rounds]: ${g.possible ? g.possible.map((s) => [...s].join('/')).join(' ') : 'NO SOLUTION'}`);
  }

  // Merge groups: a Hole with one par in every group gets it; a Hole that is
  // certain in each group but differs between them is a tee variant.
  const pars: (number | null)[] = [];
  const variants: Record<string, number[]> = {};
  for (let i = 0; i < holeCount; i++) {
    const perGroup = solved.filter((g) => g.possible).map((g) => g.possible![i]);
    const certain = perGroup.filter((s) => s.size === 1).map((s) => [...s][0]);
    const distinct = [...new Set(certain)].sort();
    if (certain.length !== perGroup.length || distinct.length === 0) pars.push(null);
    else if (distinct.length === 1) pars.push(distinct[0]);
    else {
      pars.push(Math.max(...distinct));
      variants[String(i + 1)] = distinct;
    }
  }
  proposed[clubId] = { name: names.get(clubId) ?? clubId, pars, ...(Object.keys(variants).length ? { variants } : {}) };
}

console.log(JSON.stringify(proposed, null, 2));
