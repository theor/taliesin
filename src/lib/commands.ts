import type { InstrumentData } from './instruments';
import type { InstrumentPart, InstrumentPartData, Scale } from './parts.svelte';
import { KEYS, MODE_NAMES } from './scale';
import type { ISequencer } from './sequencer';
import { inputIndex, isSlot, liveSlot, MAX_PATTERNS, withPattern } from './patterns';

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
      /**
       * The pattern slot edited. Absent means the live one, which is only safe when nobody launches a
       * pattern meanwhile (peers may disagree on which one is live until the host's order reaches
       * them): the views always say which slot (`patternEdit`).
       */
      pattern?: number;
    }
  /** Set some fields of one part (effects, filter, steps, notes...). Only the part's own fields, each valid for it. */
  | {
      type: 'setPartFields';
      instrumentId: string;
      partName: string;
      fields: { [key: string]: Json };
      /** For the input part (the notes): the pattern slot edited (absent: the live one). */
      pattern?: number;
    }
  | {
      type: 'setInstrumentFields';
      instrumentId: string;
      fields: { name?: string; volume?: number; state?: number };
    }
  /** Appends the instrument (or moves it to the end if it is already there): the host's order wins. */
  | { type: 'addInstrument'; instrument: InstrumentData & { [key: string]: Json } }
  | { type: 'removeInstrument'; instrumentId: string }
  /**
   * Gives an instrument a part it does not have yet, with the part's default data (the same on every
   * peer, so nothing to resolve first). Only parts its kind allows (`Instrument.addableParts`).
   */
  | { type: 'addPart'; instrumentId: string; partName: string }
  /**
   * Make a pattern slot the one the host plays for everyone (`lib/patterns.ts`). A slot never written
   * starts empty. Absolute: making the live slot live again changes nothing.
   */
  | { type: 'setLivePattern'; instrumentId: string; pattern: number }
  | { type: 'setMasterVolume'; volume: number }
  /** The key the whole song plays in (it ends up in the code: only known keys and modes). */
  | { type: 'setScale'; scaleKey: string; scaleMode: string }
  /** The song's tempo, in whole beats per minute (`MIN_BPM`..`MAX_BPM`; a cycle is one 4-beat bar). */
  | { type: 'setTempo'; bpm: number }
  | { type: 'transport'; action: 'toggle' | 'stop' };

/** Commands that change song data (as opposed to driving the transport). */
export type SongCommand = Exclude<Command, { type: 'transport' }>;
export type Dispatch = (cmd: Command) => void;

/** The part of the app state commands operate on. `tempo` in BPM (absent: `DEFAULT_BPM`). */
export type Song = {
  instrumentsData: InstrumentData[];
  volume: number;
  scale: Scale;
  tempo?: number;
};

export const MIN_BPM = 40;
export const MAX_BPM = 240;
export const DEFAULT_BPM = 120;
/** A cycle is one bar of 4 beats: cycles per second for a tempo. */
export const bpmToCps = (bpm: number) => bpm / 60 / 4;
export const isBpm = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= MIN_BPM && v <= MAX_BPM;

/** What applying a command needs to know about the app. */
export type Env = {
  sequencerFor: (data: InstrumentData) => ISequencer | undefined;
  /** The id of the input part an instrument kind plays from; undefined for a kind this version does not know. */
  instrumentInput: (instrumentName: string) => string | undefined;
  /** The part type stored under a `partName`, which validates its data. */
  partType: (partName: string) => InstrumentPart | undefined;
  /** Whether an instrument kind may be given that part (`Instrument.addableParts`). */
  canAddPart: (instrumentName: string, partName: string) => boolean;
};

const SONG_COMMANDS = new Set<string>([
  'setCells',
  'setPartFields',
  'setInstrumentFields',
  'addInstrument',
  'removeInstrument',
  'addPart',
  'setLivePattern',
  'setMasterVolume',
  'setScale',
  'setTempo'
]);
export const isSongCommand = (cmd: unknown): cmd is SongCommand =>
  typeof cmd === 'object' && cmd !== null && SONG_COMMANDS.has((cmd as Command).type);

const MAX_STEP = 4096;
const MAX_CELLS = 1024;
const MAX_PARTS = 32;
const MAX_STRING = 128;
const MAX_JSON_NODES = 20_000;

const isId = (v: unknown): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_STRING;

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

/**
 * A clean copy of an instrument from untrusted input, or null. Its parts go through their own
 * validation, leniently (a field saved by an older version falls back to its default); parts this
 * version does not know are dropped, as they would generate nothing anyway.
 */
function cleanInstrument(i: any, env: Env): InstrumentData | null {
  const valid =
    !!i &&
    isId(i.id) &&
    typeof i.name === 'string' &&
    i.name.length <= MAX_STRING &&
    isId(i.instrumentName) &&
    typeof i.volume === 'number' &&
    i.volume >= 0 &&
    i.volume <= 1 &&
    Number.isInteger(i.state) &&
    i.state >= 0 &&
    i.state <= 2 &&
    Array.isArray(i.parts) &&
    i.parts.length <= MAX_PARTS &&
    jsonLike(i);
  const input = valid ? env.instrumentInput(i.instrumentName) : undefined;
  if (!input) return null;
  const parts: InstrumentPartData[] = [];
  for (const p of i.parts) {
    const type = env.partType(p?.partName);
    if (!type || parts.some((q) => q.partName === type.id)) continue;
    if (type.isInput() && type.id !== input) continue; // an instrument plays from its own input only
    const part = type.normalize(clone(p), false);
    if (part) parts.push(part);
  }
  if (!parts.some((p) => p.partName === input)) return null; // nothing to play: its code would not parse
  const clean: InstrumentData = {
    id: i.id,
    name: i.name,
    instrumentName: i.instrumentName,
    volume: i.volume,
    state: i.state,
    parts
  };
  // the other patterns, leniently: a bad slot is dropped, never the instrument
  if (Array.isArray(i.patterns) && i.patterns.length <= MAX_PATTERNS) {
    const type = env.partType(input)!;
    const live = isSlot(i.livePattern) ? i.livePattern : 0;
    clean.patterns = i.patterns.map((p: unknown, slot: number) =>
      slot !== live && (p as InstrumentPartData | null)?.partName === input
        ? type.normalize(clone(p), false)
        : null
    );
    clean.livePattern = live;
  }
  return clean;
}

/**
 * The instrument with `slot`'s notes to edit (`withPattern`), or undefined for a bad slot. A slot never
 * written gets empty notes, stored by `commit` once the edit has been applied.
 */
function patternTarget(
  data: InstrumentData,
  slot: unknown,
  env: Env
): { data: InstrumentData; commit: () => void } | undefined {
  const none = { data, commit: () => {} };
  if (slot === undefined || slot === liveSlot(data)) return none;
  if (!isSlot(slot)) return undefined;
  const input = env.instrumentInput(data.instrumentName);
  const type = input ? env.partType(input) : undefined;
  if (!input || !type || inputIndex(data, input) < 0) return undefined;
  const stored = data.patterns?.[slot];
  if (stored) return { data: withPattern(data, slot, input, () => stored), commit: () => {} };
  const fresh = type.createData();
  return {
    data: withPattern(data, slot, input, () => fresh),
    commit: () => {
      if (!data.patterns) data.patterns = [];
      const patterns = data.patterns; // read back: in a Svelte $state song, that is the reactive proxy
      while (patterns.length <= slot) patterns.push(null);
      patterns[slot] = fresh;
      data.livePattern = liveSlot(data);
    }
  };
}

function applySetLivePattern(
  song: Song,
  cmd: Extract<Command, { type: 'setLivePattern' }>,
  env: Env
): boolean {
  if (!isId(cmd.instrumentId) || !isSlot(cmd.pattern)) return false;
  const data = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  const input = data && env.instrumentInput(data.instrumentName);
  const type = input ? env.partType(input) : undefined;
  if (!data || !input || !type) return false;
  const live = liveSlot(data);
  if (cmd.pattern === live) return false; // already live: nothing to do (the host echoing it back)
  const at = inputIndex(data, input);
  if (at < 0) return false;
  if (!data.patterns) data.patterns = [];
  const patterns = data.patterns; // read back: in a Svelte $state song, that is the reactive proxy
  while (patterns.length <= Math.max(live, cmd.pattern)) patterns.push(null);
  const next = patterns[cmd.pattern] ?? type.createData();
  patterns[live] = data.parts[at];
  data.parts[at] = next;
  patterns[cmd.pattern] = null;
  data.livePattern = cmd.pattern;
  return true;
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
  const found = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  const seq = found && env.sequencerFor(found);
  if (!found || !seq || cmd.track >= seq.tracks.length) return false;
  const target = patternTarget(found, cmd.pattern, env);
  if (!target) return false;
  for (const { step, on } of cmd.cells) seq.setCell(target.data, cmd.track, step, on);
  target.commit();
  return true;
}

function applySetPartFields(
  song: Song,
  cmd: Extract<Command, { type: 'setPartFields' }>,
  env: Env
): boolean {
  if (!isId(cmd.instrumentId) || !isId(cmd.partName)) return false;
  if (typeof cmd.fields !== 'object' || cmd.fields === null || Array.isArray(cmd.fields))
    return false;
  if (!jsonLike(cmd.fields)) return false;
  const type = env.partType(cmd.partName);
  const found = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  if (!type || !found) return false;
  // a slot only means something for the notes; the other parts are shared by every pattern
  if (cmd.pattern !== undefined && !isSlot(cmd.pattern)) return false;
  const keys = Object.keys(cmd.fields);
  // Only the part's own fields, and the result must be valid for the part (it ends up in code). Strict: all or nothing.
  if (keys.some((key) => !type.hasField(key))) return false;
  const target = type.isInput()
    ? patternTarget(found, cmd.pattern, env)
    : { data: found, commit() {} };
  const part = target?.data.parts.find((p) => p.partName === cmd.partName) as
    | Record<string, unknown>
    | undefined;
  if (!target || !part) return false;
  const next = type.normalize({ ...part, ...clone(cmd.fields) }, true) as Record<
    string,
    unknown
  > | null;
  if (!next) return false;
  for (const key of keys) part[key] = next[key];
  target.commit();
  return true;
}

function applySetInstrumentFields(
  song: Song,
  cmd: Extract<Command, { type: 'setInstrumentFields' }>
): boolean {
  const f = cmd.fields;
  if (!isId(cmd.instrumentId) || typeof f !== 'object' || f === null) return false;
  if (Object.keys(f).some((k) => k !== 'name' && k !== 'volume' && k !== 'state')) return false;
  if (f.name !== undefined && (typeof f.name !== 'string' || f.name.length > MAX_STRING))
    return false;
  if (f.volume !== undefined && !(typeof f.volume === 'number' && f.volume >= 0 && f.volume <= 1))
    return false;
  // 0 playing, 1 muted, 2 solo (TrackState)
  if (f.state !== undefined && !(Number.isInteger(f.state) && f.state >= 0 && f.state <= 2))
    return false;
  const data = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  if (!data) return false;
  if (f.name !== undefined) data.name = f.name;
  if (f.volume !== undefined) data.volume = f.volume;
  if (f.state !== undefined) data.state = f.state;
  return true;
}

function applyAddInstrument(
  song: Song,
  cmd: Extract<Command, { type: 'addInstrument' }>,
  env: Env
) {
  const i = cleanInstrument(cmd.instrument, env);
  if (!i) return false;
  const at = song.instrumentsData.findIndex((x) => x.id === i.id);
  if (at >= 0) song.instrumentsData.splice(at, 1); // re-adding moves it to the end, where the host put it
  song.instrumentsData.push(i);
  return true;
}

function applyRemoveInstrument(song: Song, cmd: Extract<Command, { type: 'removeInstrument' }>) {
  if (!isId(cmd.instrumentId)) return false;
  const at = song.instrumentsData.findIndex((i) => i.id === cmd.instrumentId);
  if (at < 0) return false;
  song.instrumentsData.splice(at, 1);
  return true;
}

function applyAddPart(song: Song, cmd: Extract<Command, { type: 'addPart' }>, env: Env) {
  if (!isId(cmd.instrumentId) || !isId(cmd.partName)) return false;
  const data = song.instrumentsData.find((i) => i.id === cmd.instrumentId);
  const type = env.partType(cmd.partName);
  if (!data || !type || type.isInput()) return false;
  if (!env.canAddPart(data.instrumentName, type.id)) return false;
  // already there (two peers added it at once): the first one wins, the second changes nothing
  if (data.parts.some((p) => p.partName === type.id) || data.parts.length >= MAX_PARTS)
    return false;
  data.parts.push(type.createData());
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
      return applySetPartFields(song, cmd, env);
    case 'setInstrumentFields':
      return applySetInstrumentFields(song, cmd);
    case 'addInstrument':
      return applyAddInstrument(song, cmd, env);
    case 'removeInstrument':
      return applyRemoveInstrument(song, cmd);
    case 'addPart':
      return applyAddPart(song, cmd, env);
    case 'setLivePattern':
      return applySetLivePattern(song, cmd, env);
    case 'setMasterVolume':
      if (!(typeof cmd.volume === 'number' && cmd.volume >= 0 && cmd.volume <= 1)) return false;
      song.volume = cmd.volume;
      return true;
    case 'setScale':
      if (!KEYS.includes(cmd.scaleKey) || !MODE_NAMES.includes(cmd.scaleMode)) return false;
      song.scale = { scaleKey: cmd.scaleKey, scaleMode: cmd.scaleMode };
      return true;
    case 'setTempo':
      if (!isBpm(cmd.bpm)) return false;
      song.tempo = cmd.bpm;
      return true;
  }
}
