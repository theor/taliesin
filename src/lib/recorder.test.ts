import { describe, expect, test } from 'vitest';
import { Stroke, quantizeAbsolute, quantizeStep } from './recorder';

const eight = { stepsPerMeasure: 4, measures: 2 }; // 8 steps, 4 per cycle

describe('quantizeStep', () => {
  test('rounds to the nearest step', () => {
    expect(quantizeStep(0, eight)).toBe(0);
    expect(quantizeStep(0.1, eight)).toBe(0); // 0.4 steps
    expect(quantizeStep(0.15, eight)).toBe(1); // 0.6 steps
    expect(quantizeStep(0.5, eight)).toBe(2);
  });
  test('floor never rounds up into the next step', () => {
    expect(quantizeStep(0.24, eight, { resolution: 1, mode: 'floor' })).toBe(0); // 0.96 steps
    expect(quantizeStep(0.26, eight, { resolution: 1, mode: 'floor' })).toBe(1);
  });
  test('wraps round the loop, including just before the end', () => {
    expect(quantizeStep(2, eight)).toBe(0); // a full loop later
    expect(quantizeStep(1.95, eight)).toBe(0); // 7.8 steps rounds up past the end: wraps to 0
    expect(quantizeStep(3.3, eight)).toBe(5); // 13.2 steps -> 13 -> 5
  });
  test('a coarser grid snaps to every Nth step', () => {
    const q = { resolution: 2, mode: 'nearest' as const };
    expect([0, 0.2, 0.3, 0.6, 0.9].map((c) => quantizeStep(c, eight, q))).toEqual([0, 0, 2, 2, 4]);
    expect(quantizeStep(1.9, eight, q)).toBe(0); // 7.6 steps -> 8 -> wraps
  });
  test('a position before the start (output latency just after play) wraps backwards', () => {
    expect(quantizeStep(-0.25, eight)).toBe(7);
  });
  test('no usable position gives nothing', () => {
    expect(quantizeStep(NaN, eight)).toBeUndefined();
    expect(quantizeStep(Infinity, eight)).toBeUndefined();
    expect(quantizeStep(1, { stepsPerMeasure: 0, measures: 1 })).toBeUndefined();
  });
});

describe('quantizeAbsolute', () => {
  test('counts steps from the start of the song, never wrapping', () => {
    expect(quantizeAbsolute(3.3, 4)).toBe(13);
    expect(quantizeAbsolute(3.3, 4, { resolution: 1, mode: 'floor' })).toBe(13);
    expect(quantizeAbsolute(3.24, 4, { resolution: 1, mode: 'floor' })).toBe(12);
    expect(quantizeAbsolute(NaN, 4)).toBeUndefined();
  });
});

describe('Stroke', () => {
  /** A fake input: the step is whatever the test says; hits are recorded. */
  function make() {
    let step: number | undefined = 0;
    const hits: [number, number][] = [];
    const stroke = new Stroke({
      currentStep: () => step,
      hit: (track) => {
        if (step !== undefined) hits.push([track, step]);
        return step;
      }
    });
    return { stroke, hits, at: (s: number | undefined) => (step = s) };
  }

  test('samples on the same step and track hit once', () => {
    const { stroke, hits } = make();
    stroke.sample(3);
    stroke.sample(3);
    expect(hits).toEqual([[3, 0]]);
  });
  test('a new track inside the step hits again', () => {
    const { stroke, hits } = make();
    stroke.sample(3);
    stroke.sample(5);
    expect(hits).toEqual([
      [3, 0],
      [5, 0]
    ]);
  });
  test('holding a track across steps hits each step', () => {
    const { stroke, hits, at } = make();
    for (const s of [0, 0, 1, 1, 2]) {
      at(s);
      stroke.sample(2);
    }
    expect(hits).toEqual([
      [2, 0],
      [2, 1],
      [2, 2]
    ]);
  });
  test('after end, the same cell hits again', () => {
    const { stroke, hits } = make();
    stroke.sample(2);
    stroke.end();
    stroke.sample(2);
    expect(hits).toEqual([
      [2, 0],
      [2, 0]
    ]);
  });
  test('nothing while there is no step', () => {
    const { stroke, hits, at } = make();
    at(undefined);
    expect(stroke.sample(2)).toBeUndefined();
    expect(hits).toEqual([]);
  });
});
