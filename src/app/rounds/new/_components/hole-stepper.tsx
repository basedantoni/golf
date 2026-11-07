"use client";
// Mobile entry: one Played Hole at a time, big tap targets, for entering on the course.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { holeResult, LABELS, type HoleResult, type RoundDraft } from "./use-round-draft";

const RESULT_CLASS: Record<HoleResult, string> = {
  ace: "bg-amber-500 text-white",
  eagle: "bg-amber-500 text-white",
  birdie: "bg-emerald-600 text-white",
  par: "bg-sky-600 text-white",
  bogey: "bg-muted text-foreground",
  double: "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
};

// Direction pad: long on top, short at the bottom, misses either side, hit in the middle.
const PAD = [null, "long", null, "left", "hit", "right", null, "short", null] as const;

export function HoleStepper({ draft }: { draft: RoundDraft }) {
  const [index, setIndex] = useState(0);
  const hole = draft.holes[Math.min(index, draft.holes.length - 1)];
  const row = draft.rows[hole.holeNumber] ?? {};
  // Strokes start at Par; the user keeps it with a tap or Next.
  const strokes = hole.strokes ?? hole.par ?? 4;
  const result = holeResult(hole.strokes, hole.par);

  const set = (patch: Parameters<RoundDraft["setRow"]>[1]) => draft.setRow(hole.holeNumber, patch);
  const step = (value: number, by: number, min: number, max: number) =>
    String(Math.max(min, Math.min(max, value + by)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {draft.holes.map((h, i) => {
          const r = holeResult(h.strokes, h.par);
          return (
            <button
              key={h.holeNumber}
              type="button"
              aria-label={`Go to Hole ${h.holeNumber}`}
              onClick={() => setIndex(i)}
              className={cn(
                "size-8 rounded-full border text-xs font-medium",
                r ? RESULT_CLASS[r] : "text-muted-foreground",
                i === index && "ring-2 ring-ring ring-offset-2",
              )}
            >
              {h.strokes ?? h.holeNumber}
            </button>
          );
        })}
      </div>

      <div className="space-y-5 rounded-xl border p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-4xl font-bold">Hole {hole.holeNumber}</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            Par
            <Button type="button" size="sm" variant="ghost" aria-label="Lower par" onClick={() => set({ par: step(hole.par ?? 4, -1, 3, 6) })}>
              −
            </Button>
            <span className="text-xl font-semibold text-foreground">{hole.par ?? "?"}</span>
            <Button type="button" size="sm" variant="ghost" aria-label="Raise par" onClick={() => set({ par: step(hole.par ?? 4, 1, 3, 6) })}>
              +
            </Button>
          </span>
        </div>

        <div className="flex items-center justify-center gap-6">
          <Button type="button" variant="outline" className="size-16 text-3xl" aria-label="One fewer stroke" onClick={() => set({ strokes: step(strokes, -1, 1, 15) })}>
            −
          </Button>
          <button
            type="button"
            aria-label={`Hole ${hole.holeNumber} strokes: ${strokes}${hole.strokes === null ? ", tap to keep" : ""}`}
            onClick={() => set({ strokes: String(strokes) })}
            className={cn(
              "size-24 rounded-full text-5xl font-bold",
              result ? RESULT_CLASS[result] : "border-2 border-dashed text-muted-foreground",
            )}
          >
            {strokes}
          </button>
          <Button type="button" variant="outline" className="size-16 text-3xl" aria-label="One more stroke" onClick={() => set({ strokes: step(strokes, 1, 1, 15) })}>
            +
          </Button>
        </div>
        {hole.strokes === null && (
          <p className="text-center text-xs text-muted-foreground">Starts at par. Tap the number to keep it.</p>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium">Putts</div>
          <div className="flex gap-2">
            {["0", "1", "2", "3", "4"].map((p) => (
              <Button
                key={p}
                type="button"
                variant={row.putts === p ? "default" : "outline"}
                className="flex-1"
                onClick={() => set({ putts: row.putts === p ? "" : p })}
              >
                {p}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {hole.par !== 3 && <Pad label="Fairway" value={row.fairway} onChange={(fairway) => set({ fairway })} />}
          <div className={cn(hole.par === 3 && "col-span-2")}>
            <Pad label="Green" value={row.gir} onChange={(gir) => set({ gir })} />
            <Button
              type="button"
              size="sm"
              variant={row.gir === "noChance" ? "default" : "ghost"}
              className="mt-1 w-full"
              onClick={() => set({ gir: row.gir === "noChance" ? "" : "noChance" })}
            >
              {LABELS.noChance}
            </Button>
          </div>
        </div>

        <div className="flex justify-between">
          <Button type="button" variant="ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            ← Prev
          </Button>
          <Button
            type="button"
            disabled={index >= draft.holes.length - 1}
            onClick={() => {
              if (hole.strokes === null) set({ strokes: String(strokes) });
              setIndex(index + 1);
            }}
          >
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}

function Pad({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="grid grid-cols-3 gap-1">
        {PAD.map((dir, i) =>
          dir ? (
            <button
              key={dir}
              type="button"
              aria-pressed={value === dir}
              aria-label={`${label} ${LABELS[dir]}`}
              onClick={() => onChange(value === dir ? "" : dir)}
              className={cn(
                "h-9 rounded-md border text-xs",
                value === dir ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                dir === "hit" && "font-semibold",
              )}
            >
              {LABELS[dir]}
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
    </div>
  );
}
