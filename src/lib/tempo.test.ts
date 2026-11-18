import { describe, expect, test } from 'vitest';
import { clampBpm, TapTempo } from './tempo';

describe('clampBpm', () => {
  test('whole beats within the range', () => {
    expect(clampBpm(119.6)).toBe(120);
    expect(clampBpm(5)).toBe(40);
    expect(clampBpm(999)).toBe(240);
    expect(clampBpm(NaN)).toBe(40);
  });
});

describe('TapTempo', () => {
  test('the first tap says nothing; then the tempo of the taps', () => {
    const tap = new TapTempo();
    expect(tap.tap(1000)).toBeUndefined();
    expect(tap.tap(1500)).toBe(120);
    expect(tap.tap(2000)).toBe(120);
  });

  test('averages a shaky hand', () => {
    const tap = new TapTempo();
    [0, 480, 1010, 1490].forEach((t) => tap.tap(t));
    expect(tap.tap(2000)).toBe(120);
  });

  test('follows a change: only the last few intervals count', () => {
    const tap = new TapTempo();
    for (let t = 0; t <= 2000; t += 500) tap.tap(t); // 120
    let bpm: number | undefined;
    for (let t = 2600; t <= 2600 + 600 * 4; t += 600) bpm = tap.tap(t); // then 100
    expect(bpm).toBe(100);
  });

  test('a long pause starts over', () => {
    const tap = new TapTempo();
    tap.tap(0);
    tap.tap(500);
    expect(tap.tap(5000)).toBeUndefined();
    expect(tap.tap(5750)).toBe(80);
  });
});
