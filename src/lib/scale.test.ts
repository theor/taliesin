import { describe, expect, test } from 'vitest';
import { triadQuality } from './scale';

describe('triadQuality', () => {
  test('major scale: I ii iii IV V vi vii°', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => triadQuality('major', d))).toEqual([
      '', 'm', 'm', '', '', 'm', 'dim'
    ]);
  });
  test('natural minor: i ii° III iv v VI VII', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => triadQuality('minor', d))).toEqual([
      'm', 'dim', '', 'm', 'm', '', ''
    ]);
  });
  test('degrees above the octave repeat', () => {
    expect(triadQuality('major', 7)).toBe(triadQuality('major', 0));
    expect(triadQuality('major', 11)).toBe(triadQuality('major', 4));
  });
  test('unknown mode or bad degree falls back to minor', () => {
    expect(triadQuality('nope', 0)).toBe('m');
    expect(triadQuality('major', -1)).toBe('m');
  });
});
