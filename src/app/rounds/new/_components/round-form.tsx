"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionSelect } from "@/app/stats/_components/option-select";
import { createRoundInput } from "@/lib/utils/round-entry";

const NEW_CLUB = "new";
const FAIRWAYS = [
  ["hit", "Hit"],
  ["left", "Left"],
  ["right", "Right"],
  ["short", "Short"],
  ["long", "Long"],
] as const;
const GIRS = [...FAIRWAYS, ["noChance", "No chance"]] as const;

const inputClass =
  "h-8 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs";

// Form fields for one Played Hole; par is unset until the user edits the prefill.
type Row = { par?: string; strokes?: string; putts?: string; fairway?: string; gir?: string };

const toNumber = (s?: string) => (s ? Number(s) : null);
const toPar = (score: number) => (score === 0 ? "E" : score > 0 ? `+${score}` : `${score}`);

export function RoundForm({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: courses } = useSuspenseQuery(
    trpc.courses.list.queryOptions({ userId }),
  );

  const [clubId, setClubId] = useState(courses[0]?.id ?? NEW_CLUB);
  const [newClub, setNewClub] = useState({ name: "", holeCount: "18" as "9" | "18" });
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [holeCount, setHoleCount] = useState<"9" | "18">("18");
  const [nine, setNine] = useState<"front" | "back">("front");
  const [rows, setRows] = useState<Record<number, Row>>({}); // by Played Hole number
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNew = clubId === NEW_CLUB;
  const { data: usualPars = [] } = useQuery(
    trpc.courses.usualPars.queryOptions({ clubId }, { enabled: !isNew }),
  );

  const create = useMutation(
    trpc.rounds.create.mutationOptions({
      onSuccess: async ({ clubId }) => {
        await Promise.all([
          queryClient.invalidateQueries(trpc.stats.pathFilter()),
          queryClient.invalidateQueries(trpc.courses.pathFilter()),
        ]);
        router.push(`/courses?club=${clubId}`);
      },
    }),
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
  const setRow = (n: number, patch: Row) =>
    setRows((r) => ({ ...r, [n]: { ...r[n], ...patch } }));

  const scored = holes.filter((h) => h.strokes !== null && h.par !== null);
  const strokes = scored.reduce((sum, h) => sum + h.strokes!, 0);
  const par = scored.reduce((sum, h) => sum + h.par!, 0);
  const fullyLogged = holes.every(
    (h) => h.gir && h.putts !== null && (h.par === 3 || h.fairway),
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // The inputs' own constraints catch most mistakes; this is the same check the server runs.
    const parsed = createRoundInput.safeParse({
      userId,
      club: isNew
        ? { name: newClub.name, holeCount: Number(newClub.holeCount) }
        : { id: clubId },
      timestamp: new Date(`${date}T12:00`).getTime(), // local noon, so the day never shifts
      holes,
    });
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(". "));
      return;
    }
    setError(null);
    create.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-1 text-sm">
          <span className="block font-medium">Club</span>
          <Select
            value={clubId}
            onValueChange={(v) => {
              setClubId(v);
              setRows({}); // edited pars belong to the previous Course
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value={NEW_CLUB}>New club…</SelectItem>
            </SelectContent>
          </Select>
        </label>

        {isNew && (
          <>
            <label className="space-y-1 text-sm">
              <span className="block font-medium">Club name</span>
              <input
                required
                className={`${inputClass} h-9 w-56`}
                value={newClub.name}
                onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
              />
            </label>
            <div className="space-y-1 text-sm">
              <span className="block font-medium">Course has</span>
              <OptionSelect
                value={newClub.holeCount}
                onChange={(holeCount) => setNewClub({ ...newClub, holeCount })}
                options={[
                  { label: "9 holes", value: "9" },
                  { label: "18 holes", value: "18" },
                ]}
              />
            </div>
          </>
        )}

        <label className="space-y-1 text-sm">
          <span className="block font-medium">Date</span>
          <input
            type="date"
            required
            max={format(new Date(), "yyyy-MM-dd")}
            className={`${inputClass} h-9`}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>

        <div className="space-y-1 text-sm">
          <span className="block font-medium">Played</span>
          <OptionSelect
            value={holeCount}
            onChange={setHoleCount}
            options={[
              { label: "18 holes", value: "18" },
              { label: "9 holes", value: "9" },
            ]}
          />
        </div>

        {holeCount === "9" && courseHoleCount === 18 && (
          <div className="space-y-1 text-sm">
            <span className="block font-medium">Nine</span>
            <OptionSelect
              value={nine}
              onChange={setNine}
              options={[
                { label: "Front (1–9)", value: "front" },
                { label: "Back (10–18)", value: "back" },
              ]}
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showDetails}
            onChange={(e) => setShowDetails(e.target.checked)}
          />
          Log putts, fairways and greens
        </label>

        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="pr-3 font-medium">Hole</th>
                <th className="pr-3 font-medium">Par</th>
                <th className="pr-3 font-medium">Strokes</th>
                {showDetails && (
                  <>
                    <th className="pr-3 font-medium">Putts</th>
                    <th className="pr-3 font-medium">Fairway</th>
                    <th className="pr-3 font-medium">GIR</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {holes.map((h) => {
                const row = rows[h.holeNumber] ?? {};
                return (
                  <tr key={h.holeNumber}>
                    <td className="pr-3 py-1 font-medium">{h.holeNumber}</td>
                    <td className="pr-3 py-1">
                      <input
                        type="number"
                        required
                        min={3}
                        max={6}
                        aria-label={`Hole ${h.holeNumber} par`}
                        className={`${inputClass} w-16`}
                        value={row.par ?? usualPar(h.holeNumber) ?? ""}
                        onChange={(e) => setRow(h.holeNumber, { par: e.target.value })}
                      />
                    </td>
                    <td className="pr-3 py-1">
                      <input
                        type="number"
                        required
                        min={1}
                        max={15}
                        aria-label={`Hole ${h.holeNumber} strokes`}
                        className={`${inputClass} w-16`}
                        value={row.strokes ?? ""}
                        onChange={(e) => setRow(h.holeNumber, { strokes: e.target.value })}
                      />
                    </td>
                    {showDetails && (
                      <>
                        <td className="pr-3 py-1">
                          <input
                            type="number"
                            min={0}
                            max={9}
                            aria-label={`Hole ${h.holeNumber} putts`}
                            className={`${inputClass} w-16`}
                            value={row.putts ?? ""}
                            onChange={(e) => setRow(h.holeNumber, { putts: e.target.value })}
                          />
                        </td>
                        <td className="pr-3 py-1">
                          {h.par === 3 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <DetailSelect
                              label={`Hole ${h.holeNumber} fairway`}
                              options={FAIRWAYS}
                              value={row.fairway}
                              onChange={(fairway) => setRow(h.holeNumber, { fairway })}
                            />
                          )}
                        </td>
                        <td className="pr-3 py-1">
                          <DetailSelect
                            label={`Hole ${h.holeNumber} GIR`}
                            options={GIRS}
                            value={row.gir}
                            onChange={(gir) => setRow(h.holeNumber, { gir })}
                          />
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-lg font-medium">
        {scored.length ? `${strokes} (${toPar(strokes - par)})` : "No strokes yet"}
      </p>

      {!fullyLogged && (
        <p className="text-sm text-muted-foreground">
          Without putts, fairways and greens on every Hole, this Round shows on
          Courses but stays hidden on Stats while &quot;Fully logged rounds
          only&quot; is on.
        </p>
      )}

      {(error ?? create.error?.message) && (
        <p className="text-sm text-destructive">{error ?? create.error?.message}</p>
      )}

      <Button type="submit" disabled={create.isPending}>
        {create.isPending ? "Saving…" : "Save round"}
      </Button>
    </form>
  );
}

function DetailSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <select
      aria-label={label}
      className={inputClass}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">—</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}
