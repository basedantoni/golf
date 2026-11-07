"use client";
// Desktop entry: a paper-style scorecard (Played Holes across, Out/In), for copying a card after the round.

import { cn } from "@/lib/utils";
import { FAIRWAYS, GIRS } from "@/lib/utils/round-entry";
import { holeResult, LABELS, type DraftHole, type HoleResult, type RoundDraft } from "./use-round-draft";

const MARK: Record<(typeof GIRS)[number], string> = {
  hit: "✓",
  left: "←",
  right: "→",
  short: "↓",
  long: "↑",
  noChance: "✕",
};

// Scorecard convention: circles under par, squares over.
const SCORE_MARK: Record<HoleResult, string> = {
  ace: "rounded-full ring-2 ring-amber-500 ring-offset-1",
  eagle: "rounded-full ring-2 ring-amber-500 ring-offset-1",
  birdie: "rounded-full ring-2 ring-emerald-600",
  par: "",
  bogey: "ring-1 ring-foreground/50",
  double: "ring-2 ring-foreground/70",
};

// Clicking a Fairway/GIR cell steps through not logged, then each value.
const cycle = (values: readonly string[], current: string | null) =>
  ["", ...values][(["", ...values].indexOf(current ?? "") + 1) % (values.length + 1)];

const digits = (s: string) => s.replace(/\D/g, "");

const total = (xs: (number | null)[]) =>
  xs.some((x) => x !== null) ? xs.reduce<number>((a, b) => a + (b ?? 0), 0) : "";
const hitRatio = (hs: DraftHole[], field: "fairway" | "gir") =>
  hs.some((h) => h[field]) ? `${hs.filter((h) => h[field] === "hit").length}/${hs.filter((h) => h[field]).length}` : "";

export function Scorecard({ draft }: { draft: RoundDraft }) {
  const out = draft.holes.slice(0, 9);
  const back = draft.holes.slice(9);
  const set = draft.setRow;
  const cellInput = "w-8 bg-transparent text-center outline-none focus:bg-accent";

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full border-collapse text-center text-sm tabular-nums">
          <tbody>
            <CardRow label="Hole" out={out} back={back} header cell={(h) => h.holeNumber} sum={() => ""} />
            <CardRow
              label="Par"
              out={out}
              back={back}
              cell={(h) => (
                <input
                  aria-label={`Hole ${h.holeNumber} par`}
                  inputMode="numeric"
                  className={cn(cellInput, "text-muted-foreground focus:text-foreground")}
                  value={draft.rows[h.holeNumber]?.par ?? h.par ?? ""}
                  onChange={(e) => set(h.holeNumber, { par: digits(e.target.value) })}
                />
              )}
              sum={(hs) => total(hs.map((h) => h.par))}
            />
            <CardRow
              label="Score"
              strong
              out={out}
              back={back}
              cell={(h) => {
                const result = holeResult(h.strokes, h.par);
                return (
                  <input
                    aria-label={`Hole ${h.holeNumber} strokes`}
                    inputMode="numeric"
                    className={cn(cellInput, "size-8 text-base font-semibold", result && SCORE_MARK[result])}
                    value={draft.rows[h.holeNumber]?.strokes ?? ""}
                    onChange={(e) => set(h.holeNumber, { strokes: digits(e.target.value) })}
                  />
                );
              }}
              sum={(hs) => total(hs.map((h) => h.strokes))}
            />
            <CardRow
              label="Putts"
              out={out}
              back={back}
              cell={(h) => (
                <input
                  aria-label={`Hole ${h.holeNumber} putts`}
                  inputMode="numeric"
                  className={cellInput}
                  value={draft.rows[h.holeNumber]?.putts ?? ""}
                  onChange={(e) => set(h.holeNumber, { putts: digits(e.target.value) })}
                />
              )}
              sum={(hs) => total(hs.map((h) => h.putts))}
            />
            <CardRow
              label="Fairway"
              out={out}
              back={back}
              cell={(h) =>
                h.par === 3 ? (
                  <span className="text-muted-foreground">·</span>
                ) : (
                  <CycleCell
                    label={`Hole ${h.holeNumber} fairway`}
                    value={h.fairway}
                    onClick={() => set(h.holeNumber, { fairway: cycle(FAIRWAYS, h.fairway) })}
                  />
                )
              }
              sum={(hs) => hitRatio(hs, "fairway")}
            />
            <CardRow
              label="GIR"
              out={out}
              back={back}
              cell={(h) => (
                <CycleCell
                  label={`Hole ${h.holeNumber} GIR`}
                  value={h.gir}
                  onClick={() => set(h.holeNumber, { gir: cycle(GIRS, h.gir) })}
                />
              )}
              sum={(hs) => hitRatio(hs, "gir")}
            />
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Click a Fairway or GIR cell to cycle: ✓ hit, ← left, → right, ↓ short, ↑ long, ✕ no chance.
      </p>
    </div>
  );
}

function CardRow({
  label,
  out,
  back,
  cell,
  sum,
  header,
  strong,
}: {
  label: string;
  out: DraftHole[];
  back: DraftHole[];
  cell: (h: DraftHole) => React.ReactNode;
  sum: (hs: DraftHole[]) => React.ReactNode;
  header?: boolean;
  strong?: boolean;
}) {
  const td = cn("border px-1 py-1.5", header && "bg-muted font-semibold");
  const totalTd = cn(td, "bg-muted/60 font-semibold", strong && "text-base");
  const cells = (hs: DraftHole[]) =>
    hs.map((h) => (
      <td key={h.holeNumber} className={td}>
        {cell(h)}
      </td>
    ));

  return (
    <tr>
      <th scope="row" className={cn(td, "sticky left-0 bg-card px-3 text-left font-medium")}>
        {label}
      </th>
      {cells(out)}
      <td className={totalTd}>{header ? "Out" : sum(out)}</td>
      {back.length > 0 && (
        <>
          {cells(back)}
          <td className={totalTd}>{header ? "In" : sum(back)}</td>
          <td className={totalTd}>{header ? "Total" : sum([...out, ...back])}</td>
        </>
      )}
    </tr>
  );
}

function CycleCell({ label, value, onClick }: { label: string; value: string | null; onClick: () => void }) {
  const known = value as keyof typeof MARK | null;
  return (
    <button
      type="button"
      aria-label={`${label}: ${known ? LABELS[known] : "not logged"}`}
      onClick={onClick}
      className={cn("size-8 rounded hover:bg-accent", value === "hit" && "font-bold text-emerald-600")}
    >
      {known ? MARK[known] : ""}
    </button>
  );
}
