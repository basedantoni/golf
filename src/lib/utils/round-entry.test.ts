import { describe, it, expect } from 'vitest';
import { roundStatsFromHoles, type EnteredHole } from './round-entry';

const hole = (par: number, strokes: number, detail: Partial<EnteredHole> = {}): EnteredHole => ({
  holeNumber: 1,
  par,
  strokes,
  putts: null,
  fairway: null,
  gir: null,
  ...detail,
});

describe('roundStatsFromHoles', () => {
  it("buckets Results like the export: Ace on its own, then albatross, eagle, birdie, par, bogey, double+", () => {
    const stats = roundStatsFromHoles([
      hole(3, 1), // ace
      hole(5, 2), // albatross
      hole(5, 3), // eagle
      hole(4, 3), // birdie
      hole(4, 4), // par
      hole(4, 4), // par
      hole(4, 5), // bogey
      hole(4, 6), // double
      hole(3, 8), // quintuple
    ]);

    expect(stats).toMatchObject({
      aces: 1,
      doubleEagleOrBetter: 1,
      eagles: 1,
      birdies: 1,
      pars: 2,
      bogeys: 1,
      doubleBogeyOrWorse: 2,
    });
  });

  it('totals logged fairway, GIR and putt detail, counting only Holes where each was logged', () => {
    const stats = roundStatsFromHoles([
      hole(4, 4, { fairway: 'hit', gir: 'hit', putts: 2 }),
      hole(4, 5, { fairway: 'left', gir: 'short', putts: 2 }),
      hole(5, 6, { fairway: 'right', gir: 'noChance', putts: 1 }),
      hole(3, 3, { gir: 'long', putts: 2 }), // par 3: no fairway
      hole(4, 4), // nothing logged
    ]);

    expect(stats).toMatchObject({
      fairwayMiddles: 1,
      fairwayLefts: 1,
      fairwayRights: 1,
      fairwayShorts: 0,
      fairwayLongs: 0,
      fairwayHoleCount: 3,
      gir: 1,
      girShorts: 1,
      girLongs: 1,
      girLefts: 0,
      girRights: 0,
      girNoChances: 1,
      girHoleCount: 4,
      putts: 7,
      puttHoleCount: 4,
    });
  });

  it("leaves strokes gained null: the export computed it, entry can't", () => {
    expect(roundStatsFromHoles([hole(4, 4)])).toMatchObject({
      strokeGainOverall: null,
      strokeGainTeeToGreen: null,
    });
  });
});
