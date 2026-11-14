import type { InstrumentData } from './instruments';
import type { ISequencer } from './sequencer';

/**
 * Everything the UI can ask for. Views never mutate state themselves: they `dispatch` one of these.
 *
 * Rules that keep replay and multi-peer sync sane:
 * - Commands are plain JSON (they go over the wire and into logs).
 * - Commands are *absolute* ("cell on") never relative ("toggle cell"), so applying one twice, or in a
 *   different order than it was issued, cannot flip something unexpectedly.
 * - Commands address instruments by `id`, never by array index.
 * - Anything non-deterministic (random results, new ids) is resolved by the caller *before* dispatch.
 */
export type Command =
  | {
      type: 'setCells';
      instrumentId: string;
      track: number;
      cells: { step: number; on: boolean }[];
    }
  | { type: 'transport'; action: 'toggle' | 'stop' };

/** Commands that change instrument data (as opposed to driving the transport). */
export type InstrumentCommand = Extract<Command, { type: 'setCells' }>;
export type Dispatch = (cmd: Command) => void;

export const isInstrumentCommand = (cmd: unknown): cmd is InstrumentCommand =>
  typeof cmd === 'object' && cmd !== null && (cmd as Command).type === 'setCells';

const MAX_STEP = 4096;
const MAX_CELLS = 1024;

function validSetCells(cmd: InstrumentCommand): boolean {
  return (
    typeof cmd.instrumentId === 'string' &&
    Number.isInteger(cmd.track) &&
    cmd.track >= 0 &&
    Array.isArray(cmd.cells) &&
    cmd.cells.length <= MAX_CELLS &&
    cmd.cells.every(
      (c) =>
        c &&
        Number.isInteger(c.step) &&
        c.step >= 0 &&
        c.step < MAX_STEP &&
        typeof c.on === 'boolean'
    )
  );
}

/**
 * Apply an instrument command to `instruments`, mutating in place (so a Svelte `$state` array stays
 * reactive at the granularity of the cell that changed). Anything unknown or malformed is ignored, since
 * commands also arrive from the network.
 * @returns whether the command was applied
 */
export function applyInstrumentCommand(
  instruments: InstrumentData[],
  cmd: InstrumentCommand,
  sequencerFor: (data: InstrumentData) => ISequencer | undefined
): boolean {
  if (!isInstrumentCommand(cmd) || !validSetCells(cmd)) return false;
  const data = instruments.find((i) => i.id === cmd.instrumentId);
  const seq = data && sequencerFor(data);
  if (!data || !seq || cmd.track >= seq.tracks.length) return false;
  for (const { step, on } of cmd.cells) seq.setCell(data, cmd.track, step, on);
  return true;
}
