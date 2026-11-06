# Golf Stats

Personal golf stats built from an exported scoring-app history: rounds, scores, and per-hole results across the courses played.

## Language

### Courses and holes

**Course**:
A layout of numbered holes, each with a par. Today every club in the data has exactly one course.
_Avoid_: Club (for the thing with holes and par)

**Club**:
The facility that owns one or more Courses. Only a name and an id in the data.
_Avoid_: Course (when meaning the facility)

**Hole**:
A physical hole on a Course, identified by its number on that Course's layout.
_Avoid_: Hole slot, round hole number

**Played Hole**:
One hole as played within a Round, numbered in play order. On a 9-hole Course played as 18, Played Holes 10–18 map back onto Holes 1–9.

**Par**:
The strokes expected on a Played Hole. Belongs to the Played Hole, because some Holes play to different pars from different tees.

**Usual Par**:
A Hole's standard par on the scorecard, used as the Par for its Played Holes unless that Round shows a tee variant.

**Par Unknown**:
The state of a Hole whose Usual Par hasn't been established. Its Played Holes get no Result.

**Round**:
One scored outing at a single Course, of 9 or 18 Played Holes.

### Results

**Result**:
How a Played Hole's strokes compare to its par: Eagle or Better, Birdie, Par, or Over Par.

**Eagle or Better**:
A Result of two or more strokes under par, including albatrosses and aces.
_Avoid_: Eagle (when the group is meant), double eagle

**Ace**:
A hole-in-one. Always also an Eagle or Better, but flagged on its own.
_Avoid_: Hole-in-one

**Best Result**:
The best Result ever recorded on a Hole, counting only Par or better.

**Not Yet**:
The state of a Hole with no Par-or-better Result recorded.
_Avoid_: Unplayed (a Not Yet Hole may have been played many times)
