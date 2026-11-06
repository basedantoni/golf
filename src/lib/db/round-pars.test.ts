import { describe, it, expect } from 'vitest';
import { parsForRound } from './round-pars';

const hancock = { name: 'Hancock', pars: [4, 4, 4, 4, 3, 5, 4, 3, 4] };
// Par 36 with Hole 1 at its Usual Par 4; plays as a 3 from some tees (par 35).
const riverside = { name: 'Riverside', pars: [4, 4, 3, 4, 5, 4, 4, 3, 5], variants: { '1': [3, 4] } };

describe('parsForRound', () => {
  it('maps Played Holes 10-18 back onto Holes 1-9 of a 9-hole Course', () => {
    expect(parsForRound(hancock, 18, 70)).toEqual([
      4, 4, 4, 4, 3, 5, 4, 3, 4,
      4, 4, 4, 4, 3, 5, 4, 3, 4,
    ]);
  });

  it('picks the tee variant whose total matches the Round total par', () => {
    expect(parsForRound(riverside, 9, 35)).toEqual([3, 4, 3, 4, 5, 4, 4, 3, 5]);
    expect(parsForRound(riverside, 9, 36)).toEqual([4, 4, 3, 4, 5, 4, 4, 3, 5]);
  });

  it('leaves every Played Hole Par Unknown when no layout matches the Round total par', () => {
    expect(parsForRound(hancock, 9, 36)).toEqual(Array(9).fill(null));
  });

  it('keeps known Usual Pars on a partly known Course, but not an unverifiable tee variant', () => {
    const partial = { name: 'Partial', pars: [4, null, 3], variants: { '1': [3, 4] } };
    expect(parsForRound(partial, 3, 11)).toEqual([null, null, 3]);
  });
});
