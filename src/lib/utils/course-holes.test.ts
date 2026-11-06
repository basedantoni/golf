import { describe, it, expect } from 'vitest';
import { summarizeHoles } from './course-holes';

describe('summarizeHoles', () => {
  it('counts a Played Hole 17 birdie toward Hole 8 of a 9-hole Course', () => {
    const holes = summarizeHoles(
      [
        { holeNumber: 8, strokes: 3, par: 3 },
        { holeNumber: 17, strokes: 2, par: 3 },
      ],
      9,
    );
    expect(holes).toHaveLength(9);
    expect(holes[7]).toEqual({
      hole: 8,
      parsPlayed: [3],
      timesPlayed: 2,
      eagleOrBetter: 0,
      birdies: 1,
      pars: 1,
      aces: 0,
      best: 'birdie',
    });
  });

  it('counts an Ace as Eagle or Better and flags it', () => {
    const [hole] = summarizeHoles([{ holeNumber: 1, strokes: 1, par: 3 }], 1);
    expect(hole).toMatchObject({ eagleOrBetter: 1, aces: 1, best: 'eagleOrBetter' });
  });

  it('ignores Played Holes with no strokes entered', () => {
    const [hole] = summarizeHoles([{ holeNumber: 1, strokes: 0, par: 4 }], 1);
    expect(hole).toMatchObject({ timesPlayed: 0, eagleOrBetter: 0, aces: 0, best: 'notYet' });
  });

  it('marks a Hole Par Unknown when no Played Hole has a par, but still counts plays', () => {
    const [hole] = summarizeHoles([{ holeNumber: 1, strokes: 3, par: null }], 1);
    expect(hole).toMatchObject({ parsPlayed: [], timesPlayed: 1, birdies: 0, best: 'parUnknown' });
  });

  it('lists every par a tee-variant Hole has played to', () => {
    const [hole] = summarizeHoles(
      [
        { holeNumber: 1, strokes: 4, par: 4 },
        { holeNumber: 1, strokes: 5, par: 3 },
      ],
      1,
    );
    expect(hole).toMatchObject({ parsPlayed: [3, 4], pars: 1, best: 'par' });
  });
});
