"use client";
// The Round being entered, shared by the mobile stepper and the desktop scorecard. Terms: GLOSSARY.md.

import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import type { GIRS } from "@/lib/utils/round-entry";

export const NEW_CLUB = "new";

// Form fields for one Played Hole; par is unset until the user edits the prefill.
export type Row = { par?: string; strokes?: string; putts?: string; fairway?: string; gir?: string };

export const LABELS: Record<(typeof GIRS)[number], string> = {
  hit: "Hit",
  left: "Left",
  right: "Right",
  short: "Short",
  long: "Long",
  noChance: "No chance",
};

export const formatScore = (score: number) => (score === 0 ? "E" : score > 0 ? `+${score}` : `${score}`);

// Result of one Played Hole, in round_stats' buckets, for colouring the entry.
export type HoleResult = "ace" | "eagle" | "birdie" | "par" | "bogey" | "double";
export function holeResult(strokes: number | null, par: number | null): HoleResult | null {
  if (strokes === null || par === null) return null;
  if (strokes === 1) return "ace";
  const diff = strokes - par;
  return diff <= -2 ? "eagle" : diff === -1 ? "birdie" : diff === 0 ? "par" : diff === 1 ? "bogey" : "double";
}

const toNumber = (s?: string) => (s ? Number(s) : null);

export function useRoundDraft(userId: string) {
  const trpc = useTRPC();
  const { data: courses } = useSuspenseQuery(trpc.courses.list.queryOptions({ userId }));

  const [clubId, setClub] = useState(courses[0]?.id ?? NEW_CLUB);
  const [newClub, setNewClub] = useState({ name: "", holeCount: "18" as "9" | "18" });
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [holeCount, setHoleCount] = useState<"9" | "18">("18");
  const [nine, setNine] = useState<"front" | "back">("front");
  const [rows, setRows] = useState<Record<number, Row>>({}); // by Played Hole number

  const isNew = clubId === NEW_CLUB;
  const { data: usualPars = [] } = useQuery(
    trpc.courses.usualPars.queryOptions({ clubId }, { enabled: !isNew }),
  );

  // Only an 18-hole Course has a back nine; a 9-hole Course played as 18 wraps (Played Holes 10-18).
  const courseHoleCount = isNew ? Number(newClub.holeCount) : usualPars.length;
  const start = holeCount === "9" && nine === "back" && courseHoleCount === 18 ? 10 : 1;
  const played = Array.from({ length: Number(holeCount) }, (_, i) => start + i);
  const usualPar = (n: number) => usualPars[(n - 1) % usualPars.length] ?? null;

  const holes = played.map((n) => {
    const row = rows[n] ?? {};
    return {
      holeNumber: n,
      par: row.par !== undefined ? toNumber(row.par) : usualPar(n),
      strokes: toNumber(row.strokes),
      putts: toNumber(row.putts),
      fairway: row.fairway || null,
      gir: row.gir || null,
    };
  });

  const scored = holes.filter((h) => h.strokes !== null && h.par !== null);
  const strokes = scored.reduce((sum, h) => sum + h.strokes!, 0);
  const par = scored.reduce((sum, h) => sum + h.par!, 0);
  // Same test as /stats' "Fully logged rounds only" filter
  const fullyLogged =
    holes.every((h) => h.gir) &&
    holes.some((h) => h.fairway && h.par !== 3) &&
    holes.reduce((sum, h) => sum + (h.putts ?? 0), 0) >= holes.length;

  return {
    courses,
    clubId,
    setClubId: (id: string) => {
      setClub(id);
      setRows({}); // edited pars belong to the previous Course
    },
    isNew,
    newClub,
    setNewClub,
    date,
    setDate,
    holeCount,
    setHoleCount,
    nine,
    setNine,
    courseHoleCount,
    holes,
    rows,
    setRow: (n: number, patch: Row) => setRows((r) => ({ ...r, [n]: { ...r[n], ...patch } })),
    strokes,
    par,
    scoredCount: scored.length,
    fullyLogged,
    // What rounds.create gets; the form validates it with createRoundInput first.
    input: {
      userId,
      club: isNew ? { name: newClub.name, holeCount: Number(newClub.holeCount) } : { id: clubId },
      timestamp: new Date(`${date}T12:00`).getTime(), // local noon, so the day never shifts
      holes,
    },
  };
}

export type RoundDraft = ReturnType<typeof useRoundDraft>;
export type DraftHole = RoundDraft["holes"][number];
