"use client";

import { Suspense, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { BestResult, HoleSummary } from "@/lib/utils/course-holes";

const BEST_RESULT: Record<BestResult, { label: string; className: string }> = {
  eagleOrBetter: { label: "Eagle or Better", className: "bg-amber-500 text-white" },
  birdie: { label: "Birdie", className: "bg-emerald-600 text-white" },
  par: { label: "Par", className: "bg-sky-600 text-white" },
  notYet: { label: "Not yet", className: "bg-muted text-muted-foreground" },
  parUnknown: { label: "?", className: "bg-muted text-muted-foreground" },
};

interface CourseHolesProps {
  userId: string;
}

export function CourseHoles({ userId }: CourseHolesProps) {
  const trpc = useTRPC();
  const { data: courses } = useSuspenseQuery(
    trpc.courses.list.queryOptions({ userId }),
  );
  const [clubId, setClubId] = useState(courses[0]?.id ?? "");

  if (courses.length === 0) {
    return <div className="text-muted-foreground">No rounds played yet.</div>;
  }

  return (
    <div className="space-y-6">
      <Select value={clubId} onValueChange={setClubId}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select a course" />
        </SelectTrigger>
        <SelectContent>
          {courses.map((course) => (
            <SelectItem key={course.id} value={course.id}>
              {course.name} ({course.rounds})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Suspense
        fallback={<div className="text-muted-foreground">Loading holes...</div>}
      >
        <HoleGrid userId={userId} clubId={clubId} />
      </Suspense>
    </div>
  );
}

function HoleGrid({ userId, clubId }: { userId: string; clubId: string }) {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.courses.holeResults.queryOptions({ userId, clubId }),
  );
  const { parOrBetter, birdied, total } = data.progress;

  return (
    <div className="space-y-4">
      <p className="text-lg font-medium">
        {data.name}: {parOrBetter}/{total} Holes Par or better · {birdied}{" "}
        birdied
      </p>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-9">
        {data.holes.map((hole) => (
          <HoleCell key={hole.hole} hole={hole} />
        ))}
      </div>
    </div>
  );
}

function HoleCell({ hole }: { hole: HoleSummary }) {
  const best = BEST_RESULT[hole.best];
  const parLabel = hole.parsPlayed.length ? hole.parsPlayed.join("/") : "?";

  return (
    <Card
      className={cn(
        "py-3",
        hole.best === "notYet" && "opacity-50",
        hole.best === "parUnknown" && "opacity-40 grayscale",
      )}
    >
      <CardContent className="space-y-2 px-3 text-center">
        <div className="flex items-baseline justify-between">
          <span className="text-xl font-bold">{hole.hole}</span>
          <span className="text-xs text-muted-foreground">Par {parLabel}</span>
        </div>
        <div className="flex flex-wrap justify-center gap-1">
          <Badge className={best.className}>{best.label}</Badge>
          {hole.aces > 0 && <Badge variant="outline">Ace ×{hole.aces}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground">
          E ×{hole.eagleOrBetter} · B ×{hole.birdies} · P ×{hole.pars}
        </div>
        <div className="text-xs text-muted-foreground">
          Played {hole.timesPlayed}
        </div>
      </CardContent>
    </Card>
  );
}
