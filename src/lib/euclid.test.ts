import { describe, expect, test } from 'vitest';
import { analyse, euclid, resolveParams } from './euclid';

const show = (cells: boolean[]) => cells.map((c) => (c ? 'x' : '.')).join('');

describe('euclid', () => {
  test('classic rhythms', () => {
    expect(show(euclid(3, 8))).toBe('x..x..x.'); // tresillo
    // the cinquillo, in whichever rotation: it is the same necklace
    expect(analyse([true, false, true, true, false, true, true, false])).toBeDefined();
    expect(show(euclid(5, 8))).toBe('x.x.xx.x');
    expect(show(euclid(4, 16))).toBe('x...x...x...x...');
  });
  test('rotation shifts the pattern later and wraps', () => {
    expect(show(euclid(3, 8, 1))).toBe('.x..x..x');
    expect(show(euclid(3, 8, 8))).toBe(show(euclid(3, 8, 0)));
    expect(show(euclid(3, 8, -1))).toBe('..x..x.x');
  });
  test('always the requested number of pulses', () => {
    for (let steps = 1; steps <= 16; steps++)
      for (let p = 0; p <= steps; p++) expect(euclid(p, steps).filter(Boolean)).toHaveLength(p);
  });
  test('edge cases', () => {
    expect(euclid(0, 4)).toEqual([false, false, false, false]);
    expect(euclid(9, 4)).toEqual([true, true, true, true]); // clamped
    expect(euclid(3, 0)).toEqual([]);
  });
});

describe('analyse', () => {
  test('recovers pulses and rotation', () => {
    const cells = euclid(5, 12, 3);
    const found = analyse(cells)!;
    expect(euclid(found.pulses, 12, found.rotation)).toEqual(cells);
    expect(found.pulses).toBe(5);
  });
  test('a pattern that is not Euclidean is undefined', () => {
    expect(analyse([true, true, false, false, false, false, true, false])).toBeUndefined();
  });
  test('empty and full patterns', () => {
    expect(analyse([false, false, false])).toEqual({ pulses: 0, rotation: 0 });
    expect(analyse([true, true])).toEqual({ pulses: 2, rotation: 0 });
    expect(analyse([])).toBeUndefined();
  });
});

describe('resolveParams', () => {
  test('keeps what was asked while the cells still match it', () => {
    const cells = euclid(4, 8, 1); // symmetric: rotations 1 and 3 are the same pattern
    expect(resolveParams(cells, { pulses: 4, rotation: 3 })).toEqual({
      pulses: 4,
      rotation: 3,
      custom: false
    });
  });
  test('works the parameters out when nothing was asked, or the cells moved on', () => {
    expect(resolveParams(euclid(3, 8, 2))).toMatchObject({ pulses: 3, custom: false });
    const moved = resolveParams(euclid(3, 8, 2), { pulses: 5, rotation: 0 });
    expect(moved).toMatchObject({ pulses: 3, custom: false });
  });
  test('flags a hand-edited pattern as custom', () => {
    const cells = [true, true, false, false, false, false, true, false];
    expect(resolveParams(cells, { pulses: 3, rotation: 2 })).toEqual({
      pulses: 3,
      rotation: 2,
      custom: true
    });
  });
});
