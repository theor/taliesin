import { describe, expect, test, vi } from 'vitest';
import { Recorder, quantizeStep, type RecorderDeps } from './recorder';
import type { Command } from './commands';

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

describe('Recorder', () => {
  function make(over: Partial<RecorderDeps> = {}) {
    const dispatch = vi.fn<(c: Command) => void>();
    const recorder = new Recorder({
      instrumentId: 'i1',
      dispatch,
      now: () => 0.5,
      playing: () => true,
      length: () => eight,
      ...over
    });
    return { recorder, dispatch };
  }

  test('a hit sets one cell on at the quantized current step', () => {
    const { recorder, dispatch } = make();
    expect(recorder.hit(3)).toBe(2);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: 'i1',
      track: 3,
      cells: [{ step: 2, on: true }]
    });
  });
  test('reads the clock at the moment of the hit, not before', () => {
    let t = 0;
    const { recorder, dispatch } = make({ now: () => t });
    t = 0.25;
    recorder.hit(0);
    t = 0.75;
    recorder.hit(0);
    expect(dispatch.mock.calls.map(([c]) => (c as any).cells[0].step)).toEqual([1, 3]);
  });
  test('does nothing while the song is stopped', () => {
    const { recorder, dispatch } = make({ playing: () => false });
    expect(recorder.hit(0)).toBeUndefined();
    expect(dispatch).not.toHaveBeenCalled();
  });
  test('uses the quantization it is given', () => {
    const { recorder } = make({ now: () => 0.3, quantize: () => ({ resolution: 4, mode: 'floor' }) });
    expect(recorder.currentStep()).toBe(0); // 1.2 steps -> floor to a multiple of 4
  });
});
