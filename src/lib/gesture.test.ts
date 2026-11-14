import { describe, expect, test } from 'vitest';
import { commitStroke, previewStroke, strideOf } from './gesture';

const noneOn = () => false;

describe('commitStroke', () => {
  test('tapping an empty cell turns it on', () => {
    const r = commitStroke({
      start: { step: 3, track: 2 },
      last: { step: 3, track: 2 },
      eraseEmpty: false,
      isOn: noneOn
    });
    expect(r).toEqual({ track: 2, cells: [{ step: 3, on: true }] });
  });

  test('tapping a cell that is on turns it off', () => {
    const r = commitStroke({
      start: { step: 3, track: 2 },
      last: { step: 3, track: 2 },
      eraseEmpty: false,
      isOn: (s) => s === 3
    });
    expect(r.cells).toEqual([{ step: 3, on: false }]);
  });

  test('a horizontal drag turns on every step it covers', () => {
    const r = commitStroke({
      start: { step: 1, track: 0 },
      last: { step: 4, track: 0 },
      eraseEmpty: false,
      isOn: noneOn
    });
    expect(r.cells.map((c) => c.step)).toEqual([1, 2, 3, 4]);
    expect(r.cells.every((c) => c.on)).toBe(true);
  });

  test('dragging leftwards covers the same range', () => {
    const r = commitStroke({
      start: { step: 5, track: 0 },
      last: { step: 2, track: 0 },
      eraseEmpty: false,
      isOn: noneOn
    });
    expect(r.cells.map((c) => c.step)).toEqual([2, 3, 4, 5]);
  });

  test('moving one row away sets a stride of 2: every other step', () => {
    const r = commitStroke({
      start: { step: 0, track: 0 },
      last: { step: 6, track: 1 },
      eraseEmpty: false,
      isOn: noneOn
    });
    expect(r.cells).toEqual([0, 2, 4, 6].map((step) => ({ step, on: true })));
  });

  test('stride counts rows in either direction', () => {
    expect(strideOf({ step: 0, track: 3 }, { step: 5, track: 1 })).toBe(3);
    expect(strideOf({ step: 0, track: 1 }, { step: 5, track: 3 })).toBe(3);
  });

  test('"erase empty" also turns the in-between steps off', () => {
    const r = commitStroke({
      start: { step: 0, track: 0 },
      last: { step: 4, track: 1 },
      eraseEmpty: true,
      isOn: noneOn
    });
    expect(r.cells).toEqual([
      { step: 0, on: true },
      { step: 1, on: false },
      { step: 2, on: true },
      { step: 3, on: false },
      { step: 4, on: true }
    ]);
  });

  test('releasing without ever touching a cell changes nothing', () => {
    const r = commitStroke({
      start: { step: -1, track: -1 },
      last: { step: -1, track: -1 },
      eraseEmpty: false,
      isOn: noneOn
    });
    expect(r.cells).toEqual([]);
  });
});

describe('previewStroke', () => {
  test('agrees with what commit will apply', () => {
    const start = { step: 2, track: 0 };
    const last = { step: 8, track: 2 }; // stride 3
    const preview = previewStroke(start, last, false);
    const commit = commitStroke({ start, last, eraseEmpty: false, isOn: noneOn });
    expect(preview.filter((p) => p.on).map((p) => p.step)).toEqual(commit.cells.map((c) => c.step));
    expect(commit.cells.map((c) => c.step)).toEqual([2, 5, 8]);
  });
});
