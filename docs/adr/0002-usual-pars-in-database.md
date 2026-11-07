# Usual Pars live in the database; the par file is seed input

Supersedes the "committed par file is the source of truth" part of [ADR 0001](0001-par-on-played-hole.md); Par still lives on the Played Hole.

Entering Rounds in the app (KOI-146) brings Courses the par file has never seen, and their Usual Pars have to persist somewhere the app can write. So a Course's Holes are rows in `course_holes` (Usual Par, tee variants), and the row count is the Course's hole count. `src/lib/db/course-pars.json` stays as the hand-checked seed input, and `pnpm db:seed` copies it into `course_holes`; the app only reads the table. A new Club is created with its hole count (9 or 18) and Par Unknown Holes, and the first Round entered there fills each Usual Par from the Par played. Later Rounds prefill from those, and never overwrite a known Usual Par.

## Considered Options

- **Keep the par file as the source; prefill new Courses from their last Round**: no new table, but a runtime write to a committed file is a footgun, and a new Course's hole count has nowhere to live.
- **Data migration instead of a seed file**: the pars would survive without `course-pars.json`, but `course_holes` references `clubs`, which only the seed creates.

## Consequences

- `pnpm db:reset` drops entered Rounds and the Usual Pars they set, along with everything else.
