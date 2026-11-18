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
 * The song step a moment falls on, counted from the start of the song (not wrapped round the loop).
 * `cycle` is the song position in cycles, the same quantity the playhead uses: one cycle is one
 * measure, `stepsPerMeasure` steps. Undefined when there is no usable position.
 */
export function quantizeAbsolute(
  cycle: number,
  stepsPerMeasure: number,
  quantize: Quantize = DEFAULT_QUANTIZE
): number | undefined {
  if (!Number.isFinite(cycle) || !(stepsPerMeasure > 0)) return undefined;
  const resolution = Math.max(1, Math.floor(quantize.resolution) || 1);
  const snap = quantize.mode === 'floor' ? Math.floor : Math.round;
  return snap((cycle * stepsPerMeasure) / resolution) * resolution;
}

/** A song step wrapped into the loop's `total` steps. */
export const wrapStep = (step: number, total: number) => ((step % total) + total) % total;

/**
 * The loop step a moment falls on: the whole loop repeats every `measures` cycles. Undefined when
 * there is no usable position (not a number, or an empty loop).
 */
export function quantizeStep(
  cycle: number,
  length: LoopLength,
  quantize: Quantize = DEFAULT_QUANTIZE
): number | undefined {
  const total = length.stepsPerMeasure * length.measures;
  if (!(total > 0)) return undefined;
  const step = quantizeAbsolute(cycle, length.stepsPerMeasure, quantize);
  return step === undefined ? undefined : wrapStep(step, total);
}

/** Where live input goes: the step a hit would land on now, and recording one. */
export interface StepInput {
  /** The loop step a hit made now would land on, or undefined when it would not be recorded. */
  currentStep(): number | undefined;
  /** Record `track` now. Returns the loop step it landed on, or undefined. */
  hit(track: number): number | undefined;
}

/**
 * A continuous gesture (a finger held on a surface) fed to a `StepInput`. The view samples it as often
 * as it likes (every pointer move and every frame, since a finger held still sends no events); a hit
 * is only made when the step or the track changes, so a stroke costs one command per step, not one
 * per sample. Changing track inside a step re-records that step: a melody holds one note per step,
 * so the last pitch wins.
 */
export class Stroke {
  private last: { step: number; track: number } | undefined;
  constructor(private input: StepInput) {}

  /** The finger is on `track` now. Returns the step it is on (recorded or already recorded), or undefined. */
  sample(track: number): number | undefined {
    const step = this.input.currentStep();
    if (step === undefined) return undefined;
    if (this.last?.step === step && this.last.track === track) return step;
    const recorded = this.input.hit(track);
    if (recorded !== undefined) this.last = { step: recorded, track };
    return recorded;
  }
  /** The finger lifted: the next sample starts a new stroke (and records even on the same cell). */
  end() {
    this.last = undefined;
  }
}
