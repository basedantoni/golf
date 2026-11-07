"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { formatScore, NEW_CLUB, useRoundDraft, type RoundDraft } from "./use-round-draft";
import { HoleStepper } from "./hole-stepper";
import { Scorecard } from "./scorecard";

const inputClass = "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs";

export function RoundForm({ userId }: { userId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const draft = useRoundDraft(userId);
  const [error, setError] = useState<string | null>(null);

  const createRound = useMutation(
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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const missing = draft.holes.filter((h) => h.strokes === null || h.par === null).map((h) => h.holeNumber);
    if (missing.length) {
      setError(`Enter par and strokes on Hole${missing.length > 1 ? "s" : ""} ${missing.join(", ")}.`);
      return;
    }
    // Same check the server runs.
    const parsed = createRoundInput.safeParse(draft.input);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(". "));
      return;
    }
    setError(null);
    createRound.mutate(parsed.data);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <RoundSetup draft={draft} />

      {/* Both layouts edit the same draft, so resizing keeps what's entered. */}
      <div className="md:hidden">
        <HoleStepper draft={draft} />
      </div>
      <div className="hidden md:block">
        <Scorecard draft={draft} />
      </div>

      <p className="text-lg font-medium">
        {draft.scoredCount
          ? `${draft.strokes} (${formatScore(draft.strokes - draft.par)}) · ${draft.scoredCount}/${draft.holes.length} Holes`
          : "No strokes yet"}
      </p>

      {!draft.fullyLogged && (
        <p className="text-sm text-muted-foreground">
          Without fairways, greens on every Hole and a putt per Hole, this
          Round shows on Courses but stays hidden on Stats while &quot;Fully
          logged rounds only&quot; is on.
        </p>
      )}

      {(error ?? createRound.error?.message) && (
        <p className="text-sm text-destructive">{error ?? createRound.error?.message}</p>
      )}

      <Button type="submit" className="w-full md:w-auto" disabled={createRound.isPending}>
        {createRound.isPending ? "Saving…" : "Save round"}
      </Button>
    </form>
  );
}

function RoundSetup({ draft }: { draft: RoundDraft }) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="space-y-1 text-sm">
        <span className="block font-medium">Club</span>
        <Select value={draft.clubId} onValueChange={draft.setClubId}>
          <SelectTrigger className="w-[280px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {draft.courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value={NEW_CLUB}>New club…</SelectItem>
          </SelectContent>
        </Select>
      </label>

      {draft.isNew && (
        <>
          <label className="space-y-1 text-sm">
            <span className="block font-medium">Club name</span>
            <input
              required
              className={`${inputClass} w-56`}
              value={draft.newClub.name}
              onChange={(e) => draft.setNewClub({ ...draft.newClub, name: e.target.value })}
            />
          </label>
          <div className="space-y-1 text-sm">
            <span className="block font-medium">Course has</span>
            <OptionSelect
              value={draft.newClub.holeCount}
              onChange={(holeCount) => draft.setNewClub({ ...draft.newClub, holeCount })}
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
          className={inputClass}
          value={draft.date}
          onChange={(e) => draft.setDate(e.target.value)}
        />
      </label>

      <div className="space-y-1 text-sm">
        <span className="block font-medium">Played</span>
        <OptionSelect
          value={draft.holeCount}
          onChange={draft.setHoleCount}
          options={[
            { label: "18 holes", value: "18" },
            { label: "9 holes", value: "9" },
          ]}
        />
      </div>

      {draft.holeCount === "9" && draft.courseHoleCount === 18 && (
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Nine</span>
          <OptionSelect
            value={draft.nine}
            onChange={draft.setNine}
            options={[
              { label: "Front (1–9)", value: "front" },
              { label: "Back (10–18)", value: "back" },
            ]}
          />
        </div>
      )}
    </div>
  );
}
