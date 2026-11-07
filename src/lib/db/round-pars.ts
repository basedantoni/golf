// Usual Pars per Course → Par per Played Hole. See ADR 0001 and 0002.

export type CourseParEntry = {
  name: string;
  // Usual Par per Hole; null = Par Unknown. Length is the Course's hole count.
  pars: (number | null)[];
  // Hole number → other pars that Hole plays to, depending on tee (Usual Par is always tried too).
  variants?: Record<string, number[]>;
};

// Par per Played Hole. A 9-hole Course played as 18 wraps back onto Holes 1-9.
// Tee variants are settled by the combination whose sum is the Round's total par;
// if none matches, every Played Hole is Par Unknown rather than guessed.
export function parsForRound(entry: CourseParEntry, holeCount: number, totalPar: number): (number | null)[] {
  const fold = (pars: (number | null)[]) => Array.from({ length: holeCount }, (_, i) => pars[i % pars.length]);
  const variantHoles = Object.keys(entry.variants ?? {}).map((h) => Number(h) - 1);

  if (entry.pars.includes(null)) {
    // Can't check the total, so a tee-variant Hole stays unknown.
    return fold(entry.pars.map((p, i) => (variantHoles.includes(i) ? null : p)));
  }

  let layouts: number[][] = [entry.pars as number[]];
  for (const hole of variantHoles) {
    const options = new Set([entry.pars[hole] as number, ...entry.variants![hole + 1]]);
    layouts = layouts.flatMap((l) => [...options].map((p) => l.with(hole, p)));
  }
  const match = layouts.map(fold).find((l) => l.reduce((a, b) => a! + b!, 0) === totalPar);
  return match ?? Array(holeCount).fill(null);
}
