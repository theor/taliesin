import { MAX_BPM, MIN_BPM } from './commands';

/** Whole BPM within the song's range: what a `setTempo` command accepts. */
export const clampBpm = (bpm: number) =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(Number.isFinite(bpm) ? bpm : MIN_BPM)));

/** Taps further apart than this (ms) start counting again. */
const RESET_MS = 2000;
/** Intervals averaged: enough to smooth a shaky hand, few enough to follow a change. */
const MAX_INTERVALS = 4;

/**
 * Tap tempo: tap along with the beat, and from the second tap on it tells the tempo (the mean of the
 * last few intervals). A pause longer than `RESET_MS` starts over. Time is given in, so it is testable.
 */
export class TapTempo {
  private taps: number[] = [];

  /** A tap at `t` (ms): the tempo so far, or undefined on the first tap. */
  tap(t: number): number | undefined {
    const last = this.taps.at(-1);
    if (last === undefined || t - last > RESET_MS || t <= last) this.taps = [];
    this.taps = [...this.taps, t].slice(-(MAX_INTERVALS + 1));
    if (this.taps.length < 2) return undefined;
    const mean = (this.taps.at(-1)! - this.taps[0]) / (this.taps.length - 1);
    return clampBpm(60_000 / mean);
  }
}
