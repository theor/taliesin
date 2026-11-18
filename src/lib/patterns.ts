import type { Command, Dispatch } from './commands';
import type { InstrumentData } from './instruments';
import type { InstrumentPartData } from './parts.svelte';

/**
 * An instrument's patterns: slots A, B, C... each holding its own notes (its input part's data). The
 * live one, which the host plays for everyone, stays in `data.parts`, so everything that reads an
 * instrument's notes (code generation, the views, older peers) sees the live pattern. The others wait in
 * `data.patterns[slot]` (null at the live slot, and at slots that were never written). Steps, chords and
 * the sound are shared by all of an instrument's patterns.
 */
export const MAX_PATTERNS = 8;

export const patternLabel = (slot: number) => String.fromCharCode(65 + slot);

export const isSlot = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) < MAX_PATTERNS;

/** The slot the host plays. */
export const liveSlot = (data: InstrumentData): number =>
  isSlot(data.livePattern) ? data.livePattern : 0;

/** The index of the instrument's input part in `data.parts` (-1 when it has none). */
export function inputIndex(data: InstrumentData, inputId: string): number {
  return data.parts.findIndex((p) => p.partName === inputId);
}

/** Whether a slot holds any notes (the live one counts as filled, so it always shows). */
export function hasNotes(data: InstrumentData, slot: number): boolean {
  if (slot === liveSlot(data)) return true;
  return !isEmptyInput(data.patterns?.[slot] ?? null);
}

/** No note in an input part (a melody of rests, or drum tracks without a hit). */
export function isEmptyInput(part: InstrumentPartData | null): boolean {
  const notes = (part as { notes?: unknown } | null)?.notes;
  if (Array.isArray(notes)) return !notes.some((n) => n !== null && n !== undefined);
  if (notes && typeof notes === 'object')
    return !Object.values(notes).some((track) => Array.isArray(track) && track.some((x) => x == 1));
  return true;
}

/**
 * The instrument as it is with `slot`'s notes: the data itself for the live slot, otherwise a copy of it
 * whose input part is the stored one (shared, not copied: the views read through it), or `empty` for a
 * slot that holds nothing yet. Every other part is the instrument's own.
 */
export function withPattern(
  data: InstrumentData,
  slot: number,
  inputId: string,
  empty: () => InstrumentPartData
): InstrumentData {
  if (slot === liveSlot(data) || !isSlot(slot)) return data;
  const at = inputIndex(data, inputId);
  if (at < 0) return data;
  const parts = [...data.parts];
  parts[at] = data.patterns?.[slot] ?? empty();
  return { ...data, parts };
}

/** Which slots to show: up to the last one in use (live, filled, or open here), never fewer than one. */
export function shownSlots(data: InstrumentData, open?: number): number[] {
  let last = liveSlot(data);
  (data.patterns ?? []).forEach((p, slot) => {
    if (p && !isEmptyInput(p) && slot > last) last = slot;
  });
  if (isSlot(open) && open > last) last = open;
  return Array.from({ length: Math.min(last + 1, MAX_PATTERNS) }, (_, i) => i);
}

/**
 * A dispatch for views editing `slot` of an instrument: their note edits (cells, and the input part's
 * fields) get addressed to that slot. Always explicit, never "whatever is live", since a launch may land
 * between this edit and the host applying it.
 */
export function patternDispatch(
  dispatch: Dispatch,
  instrumentId: string,
  slot: number,
  inputId: string
): Dispatch {
  return (cmd: Command) => {
    if (cmd.type === 'setCells' && cmd.instrumentId === instrumentId)
      return dispatch({ ...cmd, pattern: slot });
    if (
      cmd.type === 'setPartFields' &&
      cmd.instrumentId === instrumentId &&
      cmd.partName === inputId
    )
      return dispatch({ ...cmd, pattern: slot });
    return dispatch(cmd);
  };
}
