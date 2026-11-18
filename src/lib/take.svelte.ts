import type { Dispatch } from './commands';
import {
  DEFAULT_QUANTIZE,
  quantizeAbsolute,
  wrapStep,
  type LoopLength,
  type Quantize,
  type StepInput
} from './recorder';

/**
 * What a take does to the notes already in the loop. `replace`: each old note is cleared just before
 * the playhead reaches it. `clearFirst`: the whole loop is cleared as the take starts. `keep`: nothing
 * is cleared, the take adds on top (overdub).
 */
export type OldNotes = 'replace' | 'clearFirst' | 'keep';
export const OLD_NOTES: readonly OldNotes[] = ['replace', 'clearFirst', 'keep'];

/** How a take treats the pattern it records over. Per-device choices, not song state. */
export interface TakeOptions {
  oldNotes: OldNotes;
  /** Keep recording, pass after pass, until stopped (later passes add to the first one); otherwise stop after one loop. */
  loop: boolean;
}
export const DEFAULT_TAKE_OPTIONS: TakeOptions = { oldNotes: 'replace', loop: false };

/** `armed`: waiting for the next measure. `recording`: the take is running. */
export type TakePhase = 'idle' | 'armed' | 'recording';

/** What a cell looks like during or after a take (`Take.cellState`). */
export type CellState =
  /** off */
  | 'off'
  /** on, and not from this take */
  | 'old'
  /** on, recorded by this take */
  | 'new'
  /** was on before the take, cleared by it, and the playhead has not got there yet */
  | 'cleared';

export interface TakeDeps {
  instrumentId: string;
  dispatch: Dispatch;
  /** The song position, in cycles (one cycle per measure), of what the player is hearing right now. */
  now: () => number;
  playing: () => boolean;
  length: () => LoopLength;
  quantize?: () => Quantize;
  /** How many tracks (grid rows) the instrument has. */
  tracks: () => number;
  /** Whether a cell is on in the song now (read live, so only cells that are on get cleared). */
  isOn: (track: number, step: number) => boolean;
  options: () => TakeOptions;
}

const key = (track: number, step: number) => `${track}:${step}`;

/**
 * One recording take over an instrument's loop, driven by the song clock. `arm()` waits for the next
 * measure; the take then lasts one loop, treating the old pattern as `options.oldNotes` says and
 * recording the hits views send it (`hit`, or a `Stroke` over it). Then it stops, or with `loop`
 * keeps adding pass after pass. Everything is dispatched as absolute `setCells`, like any edit. Views
 * call `tick()` often (every frame) while it is not idle; `hit` ticks itself. The loop as it was
 * before the take is kept, so the take can be undone once it is over.
 */
export class Take implements StepInput {
  phase = $state<TakePhase>('idle');
  /** Which pass of the loop is being recorded (0: the first, the one that clears). */
  pass = $state(0);
  /** Bumped on every edit the take makes: views showing `cellState` read it to redraw. */
  changes = $state(0);
  /** The last finished take: how many notes it recorded. Cleared by `arm` and `undo`. */
  result = $state<{ notes: number }>();

  // all in song steps (`quantizeAbsolute`), not wrapped
  private startStep = 0;
  private endStep = 0;
  private loopSteps = 0;
  private stepsPerMeasure = 0;
  /** Steps before this one have been cleared (replace mode). */
  private clearedUpTo = 0;
  private clearedAll = false;
  /** Cells this take recorded (`track:loopStep`): clearing never removes them. */
  private recorded = new Set<string>();
  /** The cells that were on before the take first changed anything (for undo and `cellState`). */
  private before: Set<string> | undefined;

  constructor(private deps: TakeDeps) {}

  /** Start recording at the next measure. False when it cannot (the song is stopped). */
  arm(): boolean {
    const { stepsPerMeasure, measures } = this.deps.length();
    const now = this.deps.now();
    if (!this.deps.playing() || !(stepsPerMeasure * measures > 0) || !Number.isFinite(now)) {
      return false;
    }
    this.stepsPerMeasure = stepsPerMeasure;
    this.loopSteps = stepsPerMeasure * measures;
    this.startStep = (Math.floor(now) + 1) * stepsPerMeasure;
    this.endStep = this.startStep + this.loopSteps;
    this.clearedUpTo = this.startStep;
    this.clearedAll = false;
    this.recorded.clear();
    this.before = undefined;
    this.result = undefined;
    this.pass = 0;
    this.phase = 'armed';
    this.changes++;
    return true;
  }
  /** End the take now. A take that already changed the loop keeps what it did (and can be undone). */
  stop() {
    if (this.phase === 'idle') return;
    this.phase = 'idle';
    if (this.before) this.result = { notes: this.recordedNotes() };
  }

  /** Whether the last take can be put back: it is over and changed something. */
  get canUndo(): boolean {
    void this.changes; // `before` is not reactive: every change to it bumps `changes`
    return this.phase === 'idle' && this.before !== undefined;
  }
  /**
   * Put the loop back as it was before the take: one command per track turning off what the take
   * added, then one per track turning back on what it cleared (offs first: on a melody, turning a
   * cell off clears its whole step). Edits others made meanwhile to the same cells are undone too.
   */
  undo(): boolean {
    if (!this.canUndo) return false;
    const before = this.before!;
    const offs: { step: number; on: boolean }[][] = [];
    const ons: { step: number; on: boolean }[][] = [];
    for (let track = 0; track < this.deps.tracks(); track++) {
      offs[track] = [];
      ons[track] = [];
      for (let step = 0; step < this.loopSteps; step++) {
        const was = before.has(key(track, step));
        if (was === this.deps.isOn(track, step)) continue;
        (was ? ons : offs)[track].push({ step, on: was });
      }
    }
    for (const list of [offs, ons]) {
      list.forEach((cells, track) => cells.length && this.send(track, cells));
    }
    this.before = undefined;
    this.result = undefined;
    this.recorded.clear();
    this.changes++;
    return true;
  }

  /** How far the take is, 0-1 (0 while armed). */
  progress(): number {
    if (this.phase !== 'recording') return 0;
    const pos = this.deps.now() * this.stepsPerMeasure;
    return Math.min(1, Math.max(0, (pos - this.startStep) / this.loopSteps));
  }
  /** Measures until an armed take starts (fractional). */
  measuresToStart(): number {
    return Math.max(0, this.startStep / this.stepsPerMeasure - this.deps.now());
  }
  /** The loop step the take is at (or would start at, while armed), 1-based for people. */
  currentLoopStep(): number {
    const pos = Math.floor(this.deps.now() * this.stepsPerMeasure);
    return wrapStep(Math.max(pos, this.startStep), this.loopSteps) + 1;
  }
  get totalSteps(): number {
    return this.loopSteps;
  }

  /** Move the take on to the song's current position: start, clear ahead, finish or loop. */
  tick(): TakePhase {
    if (this.phase === 'idle') return 'idle';
    const { stepsPerMeasure, measures } = this.deps.length();
    if (
      !this.deps.playing() ||
      stepsPerMeasure !== this.stepsPerMeasure ||
      stepsPerMeasure * measures !== this.loopSteps
    ) {
      this.stop(); // the song stopped, or the loop changed under the take
      return 'idle';
    }
    const now = this.deps.now();
    if (!Number.isFinite(now)) return this.phase;
    const pos = now * stepsPerMeasure;
    if (this.pass === 0) this.clearAhead(pos);
    while (pos >= this.endStep) {
      if (!this.deps.options().loop) {
        this.stop();
        return 'idle';
      }
      this.startStep = this.endStep;
      this.endStep += this.loopSteps;
      this.pass++;
    }
    if (pos >= this.startStep) this.phase = 'recording';
    return this.phase;
  }

  currentStep(): number | undefined {
    if (this.tick() === 'idle') return undefined;
    const step = quantizeAbsolute(
      this.deps.now(),
      this.stepsPerMeasure,
      this.deps.quantize?.() ?? DEFAULT_QUANTIZE
    );
    // an early hit that rounds into the take's first step counts, one that rounds past its end does not
    if (step === undefined || step < this.startStep || step >= this.endStep) return undefined;
    return wrapStep(step, this.loopSteps);
  }

  hit(track: number): number | undefined {
    const step = this.currentStep();
    if (step === undefined) return undefined;
    this.snapshot();
    this.recorded.add(key(track, step));
    this.send(track, [{ step, on: true }]);
    return step;
  }

  /** What a cell shows: from this take, from before it, or cleared and about to be replaced. */
  cellState(track: number, step: number): CellState {
    const on = this.deps.isOn(track, step);
    const k = key(track, step);
    const fromTake = this.recorded.has(k) && (this.phase !== 'idle' || this.result !== undefined);
    if (on) return fromTake ? 'new' : 'old';
    // only the first pass clears: later passes have already replaced those notes
    if (this.phase !== 'idle' && this.pass === 0 && this.before?.has(k) && this.isAhead(step)) {
      return 'cleared';
    }
    return 'off';
  }

  /** Whether the take has yet to reach a loop step (in this pass). */
  private isAhead(step: number): boolean {
    const pos = Math.floor(this.deps.now() * this.stepsPerMeasure);
    const abs = this.startStep + wrapStep(step - this.startStep, this.loopSteps);
    return abs > pos;
  }

  private recordedNotes(): number {
    let n = 0;
    for (const k of this.recorded) {
      const [track, step] = k.split(':').map(Number);
      if (this.deps.isOn(track, step)) n++;
    }
    return n;
  }

  /** Remember the loop as it is, before the take's first change. */
  private snapshot() {
    if (this.before) return;
    this.before = new Set();
    for (let track = 0; track < this.deps.tracks(); track++) {
      for (let step = 0; step < this.loopSteps; step++) {
        if (this.deps.isOn(track, step)) this.before.add(key(track, step));
      }
    }
  }

  private send(track: number, cells: { step: number; on: boolean }[]) {
    this.deps.dispatch({ type: 'setCells', instrumentId: this.deps.instrumentId, track, cells });
    this.changes++;
  }

  /**
   * Clear the old pattern, one step ahead of what is heard so the old note never sounds in the take:
   * everything just before the take starts, or each step as the playhead gets to it.
   */
  private clearAhead(pos: number) {
    const mode = this.deps.options().oldNotes;
    if (mode === 'keep') return;
    const upTo = Math.min(this.endStep, Math.floor(pos) + 2);
    if (upTo <= this.startStep) return; // more than a step before the take
    if (mode === 'clearFirst') {
      if (this.clearedAll) return;
      this.clearedAll = true;
      this.clear(this.startStep, this.endStep);
    } else if (upTo > this.clearedUpTo) {
      this.clear(this.clearedUpTo, upTo);
      this.clearedUpTo = upTo;
    }
  }
  /** Turn off the cells that are on in song steps [from, to), except those this take recorded. */
  private clear(from: number, to: number) {
    for (let track = 0; track < this.deps.tracks(); track++) {
      const cells: { step: number; on: boolean }[] = [];
      for (let s = from; s < to; s++) {
        const step = wrapStep(s, this.loopSteps);
        if (this.deps.isOn(track, step) && !this.recorded.has(key(track, step))) {
          cells.push({ step, on: false });
        }
      }
      if (cells.length) {
        this.snapshot(); // before the first change (earlier tracks had nothing to clear)
        this.send(track, cells);
      }
    }
  }
}

/** How many beats a bar of `stepsPerMeasure` steps is counted in (for the count-in). */
export function beatsPerBar(stepsPerMeasure: number): number {
  return [4, 3, 2].find((b) => stepsPerMeasure % b === 0) ?? 1;
}

const OPTIONS_KEY = 'taliesin:take';
export function loadTakeOptions(): TakeOptions {
  try {
    const saved = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}');
    const oldNotes: OldNotes = OLD_NOTES.includes(saved?.oldNotes)
      ? saved.oldNotes
      : saved?.clearAtStart === true // saved before there were three choices
        ? 'clearFirst'
        : 'replace';
    return { oldNotes, loop: saved?.loop === true };
  } catch {
    return { ...DEFAULT_TAKE_OPTIONS };
  }
}
export function saveTakeOptions(options: TakeOptions) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // not saving is fine
  }
}
