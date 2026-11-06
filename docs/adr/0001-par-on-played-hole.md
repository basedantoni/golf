# Par lives on the Played Hole, sourced from a hand-checked par file

The scoring-app export has no per-hole par, only each Round's total par (strokes minus score) and per-Round Result counts. Some Holes also play to different pars by tee (Riverside #1 is a par 3 or 4), and most Rounds don't record a tee. We store Par on each Played Hole rather than on the Course, so every Result is judged against the par actually played without modelling tees. A committed par file (Course → Usual Par per Hole, plus tee variants) is the source of truth; seeding picks the variant whose total matches the Round's total par. A one-off solver script proposes Usual Pars by finding the only par assignment consistent with every Round's totals and Result counts; it is a helper for filling the file, not part of seeding.

## Considered Options

- **Par per Hole only**: simplest, but scores tee-variant Holes wrong.
- **Par per Hole per tee**: models reality, but tee is missing for most Rounds, so it would be guessed anyway.
- **Solver at seed time**: no file to maintain, but leaves ambiguous Courses unresolved and hides par behind inference instead of a checkable scorecard.
