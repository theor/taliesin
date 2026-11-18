import type { Command } from './commands';
import type { InstrumentData } from './instruments';
import type { ISequencer } from './sequencer';

/**
 * The tombola input, after the OP-1's: balls (some of the instrument's rows: scale degrees, drum sounds)
 * tumble in a spinning drum, and on each step one may hit the wall and play. A draw is one loop of that,
 * written into the pattern as ordinary absolute `setCells`, so it works on every instrument with a grid
 * and everything that reads notes (grid, chords, cards, launcher) sees it. The randomness is resolved
 * here, before dispatch. Which balls and how fast it spins are this device's choices, not song state.
 */
export interface TombolaSettings {
  /** The rows in the drum (indices into the sequencer's tracks). */
  balls: number[];
  /** The odds that a ball hits the wall on a step (0-1). */
  spin: number;
  /** Draw a new loop every time round while the song plays. */
  roll: boolean;
  /** Simulate the drum instead (`tombolaPhysics`): the balls that hit the wall play. */
  physics: boolean;
}

/** The balls a drum starts with: the rows the pattern already uses, or a triad's worth. */
export function defaultBalls(seq: ISequencer, data: InstrumentData, total: number): number[] {
  const used = seq.tracks.flatMap((_, track) =>
    Array.from({ length: total }, (_, step) => step).some((step) => seq.getCell(data, track, step))
      ? [track]
      : []
  );
  if (used.length >= 2) return used;
  return [0, 2, 4].filter((t) => t < seq.tracks.length);
}

/** One loop: the ball (track) that hits on each step, or undefined. */
export function drawTombola(
  balls: readonly number[],
  spin: number,
  total: number,
  rand: () => number = Math.random
): (number | undefined)[] {
  const odds = Number.isFinite(spin) ? Math.min(1, Math.max(0, spin)) : 0;
  return Array.from({ length: Math.max(0, total) }, () => {
    // two numbers per step, whatever happens, so a seeded `rand` gives the same draw at any spin
    const hit = rand();
    const pick = rand();
    return balls.length && hit < odds ? balls[Math.floor(pick * balls.length)] : undefined;
  });
}

/**
 * The commands that make the pattern play `draw`. On a melody the draw is the whole loop (a step without
 * a hit becomes a rest). On drums only the ball rows change: a kick that is not in the drum keeps going.
 * Only cells that change are sent, offs first: on a melody, turning a step off clears it, which would
 * otherwise wipe the note just put there.
 */
export function tombolaCommands(
  seq: ISequencer,
  data: InstrumentData,
  balls: readonly number[],
  draw: readonly (number | undefined)[]
): Command[] {
  const rows = seq.mono ? seq.tracks.map((_, t) => t) : [...new Set(balls)];
  const offs: Command[] = [];
  const ons: Command[] = [];
  for (const track of rows) {
    if (track < 0 || track >= seq.tracks.length) continue;
    const off: { step: number; on: boolean }[] = [];
    const on: { step: number; on: boolean }[] = [];
    draw.forEach((hit, step) => {
      const want = hit === track;
      if (seq.getCell(data, track, step) !== want) (want ? on : off).push({ step, on: want });
    });
    if (off.length) offs.push({ type: 'setCells', instrumentId: data.id, track, cells: off });
    if (on.length) ons.push({ type: 'setCells', instrumentId: data.id, track, cells: on });
  }
  return [...offs, ...ons];
}

const storageKey = (id: string) => `taliesin:tombola:${id}`;

/** This device's tombola for an instrument, if it has one saved. */
export function loadTombola(instrumentId: string): TombolaSettings | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(instrumentId)) ?? 'null');
    if (!raw || !Array.isArray(raw.balls)) return undefined;
    return {
      balls: raw.balls.filter((b: unknown) => Number.isInteger(b) && (b as number) >= 0),
      spin: Number.isFinite(raw.spin) ? Math.min(1, Math.max(0, raw.spin)) : 0.5,
      roll: raw.roll === true,
      physics: raw.physics === true
    };
  } catch {
    return undefined;
  }
}
export function saveTombola(instrumentId: string, settings: TombolaSettings) {
  try {
    localStorage.setItem(storageKey(instrumentId), JSON.stringify(settings));
  } catch {
    // not saving is fine
  }
}

/**
 * When to roll a new loop, keeping spinning: once per loop, as the playhead enters its last step, so the
 * new notes reach the host (and everyone) before the loop comes round. `position` is in cycles (one
 * per measure). Returns the loop to roll for (a counter), or undefined when it is not time.
 */
export function rollDue(
  position: number,
  stepsPerMeasure: number,
  measures: number,
  lastRolled: number | undefined
): number | undefined {
  if (!Number.isFinite(position) || position < 0 || stepsPerMeasure < 1 || measures < 1) return;
  const loop = Math.floor(position / measures);
  const step = Math.floor((position - loop * measures) * stepsPerMeasure);
  if (step < stepsPerMeasure * measures - 1) return;
  return loop === lastRolled ? undefined : loop;
}
