/**
 * Pure rules of the sequencer's drag gesture, kept out of the view so they can be tested without a DOM.
 *
 * A stroke starts on one cell and ends on another:
 * - a tap (start and end on the same step) toggles that cell;
 * - a horizontal drag fills the steps it covers;
 * - dragging vertically by N rows while moving sets a stride of N+1, i.e. only every (N+1)th step is
 *   turned on ("erase empty" additionally turns the in-between steps off);
 * - a drag that *starts on a cell that is on* erases: every step it covers is turned off. (Starting on an
 *   empty cell paints, so there is no mode switch.)
 */
export type Cell = { step: number; track: number };
export type CellChange = { step: number; on: boolean };

export const strideOf = (start: Cell, current: Cell) => 1 + Math.abs(current.track - start.track);

/** Steps the stroke would affect so far, with their offset from the start, for the live preview. */
export function previewStroke(
  start: Cell,
  current: Cell,
  eraseEmpty: boolean,
  erase = false
): { step: number; offset: number; on: boolean }[] {
  const stride = erase ? 1 : strideOf(start, current);
  const out = [];
  for (
    let step = Math.min(start.step, current.step);
    step <= Math.max(start.step, current.step);
    step++
  ) {
    const offset = step - start.step;
    if (erase) {
      out.push({ step, offset, on: false });
      continue;
    }
    const on = offset % stride === 0;
    if (on || eraseEmpty) out.push({ step, offset, on });
  }
  return out;
}

/** The changes to apply when the pointer is released. `isOn` reads the current state of the start track. */
export function commitStroke(args: {
  start: Cell;
  last: Cell;
  eraseEmpty: boolean;
  isOn: (step: number) => boolean;
  /** The stroke began on a cell that was on: it erases instead of painting (a plain tap still toggles). */
  erase?: boolean;
}): { track: number; cells: CellChange[] } {
  const { start, last, eraseEmpty, isOn, erase = false } = args;
  const track = start.track;
  if (start.step < 0 || track < 0) return { track, cells: [] }; // released without ever touching a cell
  const stride = strideOf(start, last);
  const isTap = last.step === start.step;
  const cells: CellChange[] = [];
  if (erase && !isTap) {
    for (
      let step = Math.min(start.step, last.step);
      step <= Math.max(start.step, last.step);
      step++
    )
      cells.push({ step, on: false });
    return { track, cells };
  }
  for (
    let step = Math.min(start.step, last.step);
    step <= Math.max(start.step, last.step);
    step++
  ) {
    const on = isTap ? !isOn(step) : Math.abs(step - start.step) % stride === 0;
    if (on || eraseEmpty || isTap) cells.push({ step, on });
  }
  return { track, cells };
}

/**
 * Which step the playhead is on. The song is generated as one cycle per `stepsPerMeasure` steps, then
 * the whole pattern (`stepsPerMeasure * measures` steps) repeats. `undefined` while stopped.
 */
export function playheadStep(
  position: number,
  playing: boolean,
  length: { stepsPerMeasure: number; measures: number }
): number | undefined {
  const total = length.stepsPerMeasure * length.measures;
  if (!playing || !Number.isFinite(position) || position < 0 || total <= 0) return undefined;
  return Math.floor(position * length.stepsPerMeasure) % total;
}
