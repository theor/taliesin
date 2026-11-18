/** A knob's maths, kept out of the component so it can be tested: dragging, snapping, drawing. */

/** Pixels of drag that sweep the whole range. */
export const KNOB_DRAG_RANGE_PX = 180;
/**
 * On a touch screen the knobs sit in scrolling places (a sideways strip, a long page), so a finger only
 * turns a knob after holding still on it this long; moving further than `KNOB_SLOP_PX` first is a scroll.
 */
export const KNOB_HOLD_MS = 180;
export const KNOB_SLOP_PX = 8;

/** Whether a touch that has moved (dx, dy) since it landed is a scroll rather than a hold. */
export function isScroll(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) > KNOB_SLOP_PX;
}

/** The arc covers 270°, starting bottom-left (135° from 3 o'clock, clockwise). */
export const KNOB_SWEEP_DEG = 270;
export const KNOB_START_DEG = 135;

const decimals = (step: number) => {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
};

/** `value` clamped to [min, max] and snapped to the step grid that starts at `min`. */
export function snap(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const clamped = Math.min(max, Math.max(min, value));
  if (step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  return Number(Math.min(max, snapped).toFixed(Math.max(decimals(step), decimals(min))));
}

/** Where the knob is, 0 (min) to 1 (max). */
export function fraction(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/**
 * The value after dragging by (dx, dy) pixels from where the drag started: up or right turns it up.
 * Fine control by dragging slowly; the whole range in `KNOB_DRAG_RANGE_PX`.
 */
export function dragValue(
  startValue: number,
  dx: number,
  dy: number,
  min: number,
  max: number,
  step: number
): number {
  const delta = ((dx - dy) / KNOB_DRAG_RANGE_PX) * (max - min);
  return snap(startValue + delta, min, max, step);
}

/** The value after a key press, or undefined for keys the knob does not handle. */
export function keyValue(
  key: string,
  value: number,
  min: number,
  max: number,
  step: number
): number | undefined {
  const big = Math.max(step, (max - min) / 10);
  switch (key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return snap(value + step, min, max, step);
    case 'ArrowDown':
    case 'ArrowLeft':
      return snap(value - step, min, max, step);
    case 'PageUp':
      return snap(value + big, min, max, step);
    case 'PageDown':
      return snap(value - big, min, max, step);
    case 'Home':
      return min;
    case 'End':
      return max;
    default:
      return undefined;
  }
}

/** A point on the knob's circle (centre cx, cy; radius r) at fraction `f` of the sweep. */
export function arcPoint(f: number, cx: number, cy: number, r: number): { x: number; y: number } {
  const a = ((KNOB_START_DEG + f * KNOB_SWEEP_DEG) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
