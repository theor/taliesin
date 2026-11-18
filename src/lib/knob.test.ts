import { describe, expect, test } from 'vitest';
import {
  KNOB_DRAG_RANGE_PX,
  arcPoint,
  dragValue,
  fraction,
  isScroll,
  keyValue,
  snap
} from './knob';

describe('knob maths', () => {
  test('snap clamps to the range and rounds to the step, without float noise', () => {
    expect(snap(0.123, 0, 1, 0.05)).toBe(0.1);
    expect(snap(0.3000000004, 0, 1, 0.05)).toBe(0.3);
    expect(snap(-3, 0, 1, 0.05)).toBe(0);
    expect(snap(7, 0, 2, 0.05)).toBe(2);
    expect(snap(NaN, 0.5, 8, 0.5)).toBe(0.5);
    expect(snap(2.2, 0.5, 8, 0.5)).toBe(2);
  });

  test('dragging up or right turns it up; the whole range takes one drag length', () => {
    expect(dragValue(0, 0, -KNOB_DRAG_RANGE_PX, 0, 1, 0.01)).toBe(1);
    expect(dragValue(0.5, KNOB_DRAG_RANGE_PX / 10, 0, 0, 1, 0.01)).toBe(0.6);
    expect(dragValue(0.5, 0, KNOB_DRAG_RANGE_PX, 0, 1, 0.01)).toBe(0);
  });

  test('keys move by a step, page keys by a tenth, home and end jump', () => {
    expect(keyValue('ArrowUp', 1, 0, 16, 0.5)).toBe(1.5);
    expect(keyValue('ArrowLeft', 0, 0, 16, 0.5)).toBe(0);
    expect(keyValue('PageUp', 0, 0, 2, 0.05)).toBe(0.2);
    expect(keyValue('End', 0, 0, 2, 0.05)).toBe(2);
    expect(keyValue('a', 0, 0, 2, 0.05)).toBeUndefined();
  });

  test('the arc starts bottom-left and ends bottom-right', () => {
    expect(fraction(5, 0, 10)).toBe(0.5);
    const start = arcPoint(0, 0, 0, 1);
    const end = arcPoint(1, 0, 0, 1);
    expect(start.x).toBeLessThan(0);
    expect(start.y).toBeGreaterThan(0);
    expect(end.x).toBeGreaterThan(0);
    expect(end.y).toBeGreaterThan(0);
    expect(arcPoint(0.5, 0, 0, 1).y).toBeCloseTo(-1); // straight up in the middle
  });
});

describe('touch: hold or scroll', () => {
  test('a few pixels of jitter is still a hold; more is a scroll', () => {
    expect(isScroll(3, 4)).toBe(false);
    expect(isScroll(0, 20)).toBe(true);
    expect(isScroll(-15, 0)).toBe(true);
  });
});
