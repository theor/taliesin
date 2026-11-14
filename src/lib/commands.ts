import type { InstrumentData } from './instruments';
import type { ISequencer } from './sequencer';

/**
 * Everything the UI can ask for. Views never mutate state themselves: they `dispatch` one of these.
 *
 * Rules that keep replay and multi-peer sync sane:
 * - Commands are plain JSON (they go over the wire and into logs).
 * - Commands are *absolute* ("cell on", "volume = 0.5") never relative ("toggle", "volume += 0.1"), so
 *   applying one twice cannot flip something unexpectedly.
 * - Commands address instruments by `id`, never by array index.
 * - Anything non-deterministic (random results, new ids) is resolved by the caller *before* dispatch.
 */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export type Command =
  | {
      type: 'setCells';
      instrumentId: string;
      track: number;
      cells: { step: number; on: boolean }[];
    }
  /** Set some fields of one part (effects, filter, steps, notes...). Only fields the part already has. */
  | { type: 'setPartFields'; instrumentId: string; partName: string; fields: { [key: string]: Json } }
  | { type: 'setInstrumentFields'; instrumentId: string; fields: { name?: string; volume?: number } }
  /** Appends the instrument (or moves it to the end if it is already there): the host's order wins. */
  | { type: 'addInstrument'; instrument: InstrumentData & { [key: string]: Json } }
  | { type: 'removeInstrument'; instrumentId: string }
  | { type: 'setMasterVolume'; volume: number }
  | { type: 'transport'; action: 'toggle' | 'stop' };

/** Commands that change song data (as opposed to driving the transport). */
export type SongCommand = Exclude<Command, { type: 'transport' }>;
export type Dispatch = (cmd: Command) => void;

/** The part of the app state commands operate on. */
export type Song = { instrumentsData: InstrumentData[]; volume: number };

/** What applying a command needs to know about the app. */
export type Env = {
  sequencerFor: (data: InstrumentData) => ISequencer | undefined;
  isKnownInstrument: (instrumentName: string) => boolean;
};

const SONG_COMMANDS = new Set<string>([
  'setCells',
  'setPartFields',
  'setInstrumentFields',
  'addInstrument',
  'removeInstrument',
  'setMasterVolume'
]);
export const isSongCommand = (cmd: unknown): cmd is SongCommand =>
  typeof cmd === 'object' && cmd !== null && SONG_COMMANDS.has((cmd as Command).type);

const MAX_STEP = 4096;
const MAX_CELLS = 1024;
const MAX_PARTS = 32;
const MAX_STRING = 128;
const MAX_JSON_NODES = 20_000;

const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= MAX_STRING;

/** JSON-shaped and bounded: commands come from the network. `undefined` (a rest) is tolerated. */
function jsonLike(value: unknown, budget = { n: MAX_JSON_NODES }, depth = 0): boolean {
  if (--budget.n < 0 || depth > 8) return false;
  if (value === undefined || value === null) return true;
  switch (typeof value) {
    case 'boolean':
    case 'string':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      if (Array.isArray(value)) return value.every((v) => jsonLike(v, budget, depth + 1));
      return Object.entries(value as object).every(
        ([k, v]) => k !== '__proto__' && jsonLike(v, budget, depth + 1)
      );
    default:
      return false;
  }
}

/** Detach from the caller: state must never share references with a logged command. */
const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

const kind = (v: unknown) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

function validInstrument(i: any): boolean {
  return (
    !!i &&
    isId(i.id) &&
    typeof i.name === 'string' &&
    i.name.length <= MAX_STRING &&
    isId(i.instrumentName) &&
    typeof i.volume === 'number' &&
    Number.isFinite(i.volume) &&
    Number.isInteger(i.state) &&
    Array.isArray(i.parts) &&
    i.parts.length <= MAX_PARTS &&
    i.parts.every((p: any) => !!p && isId(p.partName)) &&
    jsonLike(i)
  );
}

function applySetCells(song: Song, cmd: Extract<Command, { type: 'setCells' }>, env: Env): boolean {
  if (
    !isId(cmd.instrumentId) ||
    !Number.isInteger(cmd.track) ||
    cmd.track < 0 ||
    !Array.isArray(cmd.cells) ||
    cmd.cells.length > MAX_CELLS ||
    !cmd.cells.every(
      (c) =>
        c &&
        Number.isInteger(c.step) &&
        c.step >= 0 &&
        c.step < MAX_STEP &&
        typeof c.on === 'boolean'
    )
  )
    return false;
  const data = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  const seq = data && env.sequencerFor(data);
  if (!data || !seq || cmd.track >= seq.tracks.length) return false;
  for (const { step, on } of cmd.cells) seq.setCell(data, cmd.track, step, on);
  return true;
}

function applySetPartFields(
  song: Song,
  cmd: Extract<Command, { type: 'setPartFields' }>
): boolean {
  if (!isId(cmd.instrumentId) || !isId(cmd.partName)) return false;
  if (typeof cmd.fields !== 'object' || cmd.fields === null || Array.isArray(cmd.fields)) return false;
  if (!jsonLike(cmd.fields)) return false;
  const part = song.instrumentsData
    .find((i) => i.id === cmd.instrumentId)
    ?.parts.find((p) => p.partName === cmd.partName) as Record<string, unknown> | undefined;
  if (!part) return false;
  const entries = Object.entries(cmd.fields);
  // Only fields the part already has, and never partName; a field keeps its type. Strict: all or nothing.
  for (const [key, value] of entries) {
    if (key === 'partName' || !Object.hasOwn(part, key)) return false;
    const current = part[key];
    if (current !== undefined && current !== null && value !== undefined && value !== null) {
      if (kind(current) !== kind(value)) return false;
    }
  }
  for (const [key, value] of entries) part[key] = clone(value);
  return true;
}

function applySetInstrumentFields(
  song: Song,
  cmd: Extract<Command, { type: 'setInstrumentFields' }>
): boolean {
  const f = cmd.fields;
  if (!isId(cmd.instrumentId) || typeof f !== 'object' || f === null) return false;
  if (Object.keys(f).some((k) => k !== 'name' && k !== 'volume')) return false;
  if (f.name !== undefined && (typeof f.name !== 'string' || f.name.length > MAX_STRING)) return false;
  if (f.volume !== undefined && !(typeof f.volume === 'number' && f.volume >= 0 && f.volume <= 1))
    return false;
  const data = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  if (!data) return false;
  if (f.name !== undefined) data.name = f.name;
  if (f.volume !== undefined) data.volume = f.volume;
  return true;
}

function applyAddInstrument(song: Song, cmd: Extract<Command, { type: 'addInstrument' }>, env: Env) {
  const i = cmd.instrument;
  if (!validInstrument(i) || !env.isKnownInstrument(i.instrumentName)) return false;
  const at = song.instrumentsData.findIndex((x) => x.id === i.id);
  if (at >= 0) song.instrumentsData.splice(at, 1); // re-adding moves it to the end, where the host put it
  song.instrumentsData.push(clone(i) as InstrumentData);
  return true;
}

function applyRemoveInstrument(song: Song, cmd: Extract<Command, { type: 'removeInstrument' }>) {
  if (!isId(cmd.instrumentId)) return false;
  const at = song.instrumentsData.findIndex((i) => i.id === cmd.instrumentId);
  if (at < 0) return false;
  song.instrumentsData.splice(at, 1);
  return true;
}

/**
 * Apply a song command to `song`, mutating in place (so a Svelte `$state` stays reactive at the
 * granularity of what changed). Unknown targets and malformed input are ignored, since commands also
 * arrive from the network.
 * @returns whether the command was applied
 */
export function applySongCommand(song: Song, cmd: SongCommand, env: Env): boolean {
  if (!isSongCommand(cmd)) return false;
  switch (cmd.type) {
    case 'setCells':
      return applySetCells(song, cmd, env);
    case 'setPartFields':
      return applySetPartFields(song, cmd);
    case 'setInstrumentFields':
      return applySetInstrumentFields(song, cmd);
    case 'addInstrument':
      return applyAddInstrument(song, cmd, env);
    case 'removeInstrument':
      return applyRemoveInstrument(song, cmd);
    case 'setMasterVolume':
      if (!(typeof cmd.volume === 'number' && cmd.volume >= 0 && cmd.volume <= 1)) return false;
      song.volume = cmd.volume;
      return true;
  }
}
