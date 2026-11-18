import type { Instrument, InstrumentData } from './instruments';
import { getPartType, type Scale } from './parts.svelte';

/**
 * The instrument playing a single note: a copy of its data whose input holds only `track` on the
 * first step. Every other part is kept, so the note sounds as it will in the song (voice, envelope,
 * filter, effects, chords). Undefined when the instrument has no grid or `track` is not one of its rows.
 */
export function previewData(
  instr: Instrument,
  data: InstrumentData,
  track: number
): InstrumentData | undefined {
  const seq = instr.sequencer;
  const input = getPartType(instr.input.id);
  if (!seq || !input || !Number.isInteger(track) || track < 0 || track >= seq.tracks.length) {
    return undefined;
  }
  const copy = JSON.parse(JSON.stringify(data)) as InstrumentData;
  copy.parts = copy.parts.map((p) => (p.partName === input.id ? input.createData() : p));
  return seq.setCell(copy, track, 0, true) ? copy : undefined;
}

/**
 * Strudel code for that one note, and how long its first step lasts in cycles (only notes starting
 * inside it are played). The same pure generation as the song, so it is as safe to evaluate.
 */
export function previewCode(
  instr: Instrument,
  data: InstrumentData,
  scale: Scale,
  track: number
): { code: string; window: number } | undefined {
  const one = previewData(instr, data, track);
  if (!one) return undefined;
  const code = instr.generate(one, scale);
  return code ? { code, window: 1 / instr.getLength(one).stepsPerMeasure } : undefined;
}

/** Plays code once, right now, on this device only (never through the song or the network). */
export interface NotePlayer {
  playOnce(code: string, window: number): unknown;
}

/** Let the player hear the note they just recorded (the song may only play it a loop later). */
export function monitorNote(
  player: NotePlayer,
  instr: Instrument,
  data: InstrumentData,
  scale: Scale,
  track: number
): boolean {
  const preview = previewCode(instr, data, scale, track);
  if (!preview) return false;
  void player.playOnce(preview.code, preview.window);
  return true;
}

// Hearing what you record is a per-device choice (headphones on a shared speaker...), not song state.
const MONITOR_KEY = 'taliesin:monitor';
export function loadMonitor(): boolean {
  try {
    return localStorage.getItem(MONITOR_KEY) !== 'off';
  } catch {
    return true;
  }
}
export function saveMonitor(on: boolean) {
  try {
    localStorage.setItem(MONITOR_KEY, on ? 'on' : 'off');
  } catch {
    // not saving is fine
  }
}
