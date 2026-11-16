import type { Dispatch } from './commands';

/** How a moment in time is snapped to the step grid. */
export interface Quantize {
  /** Snap to every Nth step (1 = every step, 2 = every other step...). Whole numbers only. */
  resolution: number;
  /** `nearest`: the closest grid point. `floor`: the grid point just before (never rounds up into the next step). */
  mode: 'nearest' | 'floor';
}
export const DEFAULT_QUANTIZE: Quantize = { resolution: 1, mode: 'nearest' };

export interface LoopLength {
  stepsPerMeasure: number;
  measures: number;
}

/**
 * The step a moment falls on. `cycle` is the song position in cycles, the same quantity the playhead
 * uses: one cycle is `stepsPerMeasure` steps and the whole loop repeats every `measures` cycles.
 * Undefined when there is no usable position (not a number, or an empty loop).
 */
export function quantizeStep(
  cycle: number,
  length: LoopLength,
  quantize: Quantize = DEFAULT_QUANTIZE
): number | undefined {
  const total = length.stepsPerMeasure * length.measures;
  if (!Number.isFinite(cycle) || !(total > 0)) return undefined;
  const resolution = Math.max(1, Math.floor(quantize.resolution) || 1);
  const raw = cycle * length.stepsPerMeasure;
  const snap = quantize.mode === 'floor' ? Math.floor : Math.round;
  const step = snap(raw / resolution) * resolution;
  return ((step % total) + total) % total;
}

export interface RecorderDeps {
  instrumentId: string;
  dispatch: Dispatch;
  /** The song position, in cycles, of what the player is hearing right now (read live, not a stored prop). */
  now: () => number;
  /** Recording only makes sense while the song runs: there is no "current time" otherwise. */
  playing: () => boolean;
  length: () => LoopLength;
  quantize?: () => Quantize;
}

/**
 * Turns live input into steps. Input views call `hit(track)` when the user plays something; the
 * recorder works out which step that is right now and dispatches an absolute `setCells`, like any
 * other edit. Views decide what "a hit" looks like (a pad, a key, a tap); this holds the timing.
 */
export class Recorder {
  constructor(private deps: RecorderDeps) {}

  /** The step a hit made right now would land on, or undefined when not playing. */
  currentStep(): number | undefined {
    if (!this.deps.playing()) return undefined;
    return quantizeStep(this.deps.now(), this.deps.length(), this.deps.quantize?.());
  }

  /** Record one note on `track` at the current time. Returns the step it landed on. */
  hit(track: number): number | undefined {
    const step = this.currentStep();
    if (step === undefined) return undefined;
    this.deps.dispatch({
      type: 'setCells',
      instrumentId: this.deps.instrumentId,
      track,
      cells: [{ step, on: true }]
    });
    return step;
  }
}
