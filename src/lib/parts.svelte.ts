import { triadQuality } from './scale';
import type { InstrumentData, Length } from './instruments';

export enum DrumNote {
  kick = 'bd',
  snare = 'sd',
  hiHat = 'hh',
  clap = 'cp',
  crash = 'cr',
  ride = 'rd',
  highTom = 'ht',
  medTom = 'mt',
  lowTom = 'lt'
}

/** The key the whole song plays in. */
export interface Scale {
  scaleKey: string;
  scaleMode: string;
}
export const DEFAULT_SCALE: Scale = { scaleKey: 'A', scaleMode: 'minor' };

/** Everything a part needs to emit its code, besides its own data. Passed in, so generation is a pure function of the song. */
export interface GenContext extends Length, Scale {
  /** The scale degrees the instrument's input part plays, one per step (rests are null/undefined), if it plays degrees. */
  degrees?: readonly (number | null | undefined)[];
  /**
   * Ids of parts another part has already rendered as part of its own code (the instrument skips
   * them). Parts run in stage order, so a part can only take over one of a later stage.
   */
  consumed?: Set<string>;
}

/**
 * Where a part's code goes in the instrument's chain. Parts are emitted in ascending stage order; the
 * instrument inserts `.fast(steps)` after the last stage that works on the step grid (`Stage.arp`).
 * Stages follow the signal, so sorting by stage never puts a later `Role` before an earlier one (a test
 * checks it).
 */
export enum Stage {
  input = 0,
  harmony = 10,
  arp = 20,
  voice = 40,
  fm = 41,
  envelope = 42,
  filter = 50,
  effects = 60,
  /** Parts that only feed other parts (octave, steps): they emit nothing themselves. */
  none = 100
}
export const LAST_STEP_STAGE = Stage.arp;

/**
 * What a part does to the signal, in the order the signal flows. It decides where the part's controls
 * show (`components/partViews.ts`, grouped by role). Never saved or sent, so it is free to change.
 */
export enum Role {
  /** Makes the pattern: the input part and the loop's length. */
  notes = 'notes',
  /** Transforms the notes before they sound: octave, chords, arpeggiator. */
  noteFx = 'noteFx',
  /** Turns notes into audio: voice, FM, amplitude envelope. */
  sound = 'sound',
  /** Processes the audio: filter, effects. */
  soundFx = 'soundFx'
}
export const ROLE_ORDER: readonly Role[] = [Role.notes, Role.noteFx, Role.sound, Role.soundFx];
export const ROLE_LABELS: Record<Role, string> = {
  [Role.notes]: 'Notes',
  [Role.noteFx]: 'Note FX',
  [Role.sound]: 'Sound',
  [Role.soundFx]: 'Sound FX'
};

/** Longest pattern data accepted from the network (steps per track). */
export const MAX_PATTERN = 4096;

// ---- field validation ----------------------------------------------------------------------------
// Part data comes from peers and ends up inside code that Strudel evaluates (i.e. runs as JavaScript),
// so every field is declared with a validator, and the reducer only lets validated data in.

const INVALID: unique symbol = Symbol('invalid');
type Invalid = typeof INVALID;
/** Validates (and may clamp) one field: returns the value to store, or INVALID. */
export type Field<V> = (v: unknown) => V | Invalid;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const field = {
  /** A finite number, clamped into [min, max] (and rounded when `int`). */
  num:
    (min: number, max: number, int = false): Field<number> =>
    (v) =>
      isNum(v) ? Math.min(max, Math.max(min, int ? Math.round(v) : v)) : INVALID,
  bool: (): Field<boolean> => (v) => (typeof v === 'boolean' ? v : INVALID),
  oneOf:
    <T extends string>(values: readonly T[]): Field<T> =>
    (v) =>
      (values as readonly unknown[]).includes(v) ? (v as T) : INVALID,
  /** A pattern of steps: each an integer in [min, max], or a rest (null / undefined). */
  steps:
    (min: number, max: number): Field<(number | undefined)[]> =>
    (v) => {
      if (!Array.isArray(v) || v.length > MAX_PATTERN) return INVALID;
      const out: (number | undefined)[] = [];
      for (const x of v) {
        if (x === null || x === undefined) out.push(undefined);
        else if (Number.isInteger(x) && x >= min && x <= max) out.push(x);
        else return INVALID;
      }
      return out;
    }
};

export interface InstrumentPartData {
  partName: string;
}
/** A part's data as stored in the song: its fields plus its `partName`. */
export type PartData<T extends InstrumentPart<any>> = PartType<T> & InstrumentPartData;
export type PartType<T extends InstrumentPart<any>> = T extends InstrumentPart<infer U> ? U : never;
/** A part class: constructible, with the stable id its data is stored under. */
export type PartClass<T extends InstrumentPart<any> = InstrumentPart<any>> = (new () => T) & {
  readonly id: string;
};

/**
 * One aspect of an instrument (its notes, filter, effects...). Stateless: the data lives in the song as
 * plain JSON (`T & { partName }`), and this object knows how to create, validate and render it.
 */
export abstract class InstrumentPart<T extends object = any> {
  /**
   * The id the part's data is stored under (`partName`). It is saved in songs and sent over the network,
   * so it must never change. Every concrete part sets it; it is not derived from the class name, which
   * a minifier is free to change.
   */
  static readonly id: string;
  get id(): string {
    const id = (this.constructor as PartClass).id;
    if (!id) throw new Error(`${this.constructor.name} has no static id`);
    return id;
  }
  /** Type only (no value at runtime): the part's data as stored in the song. */
  declare readonly dataType: T & InstrumentPartData;
  /** Where the part's code goes in the chain. */
  abstract readonly stage: Stage;
  /** What it does to the signal, and so where its controls show. */
  abstract readonly role: Role;
  /** The validator for each field. Fields not listed here are not part of the part's data. */
  protected abstract readonly fields: { [K in keyof T]-?: Field<T[K]> };
  abstract defaultData(): T;

  isInput(): boolean {
    return this.stage === Stage.input;
  }
  createData(data?: Partial<T>): T & InstrumentPartData {
    return { ...this.defaultData(), ...data, partName: this.id };
  }
  hasField(key: string): boolean {
    return Object.hasOwn(this.fields, key);
  }
  /**
   * Validated part data from untrusted input. Missing fields get their default (data saved before a
   * field existed); unknown fields are dropped. An invalid field makes the whole part invalid (`null`)
   * when `strict`, otherwise it falls back to the default.
   */
  normalize(raw: unknown, strict = true): (T & InstrumentPartData) | null {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
    const defaults = this.defaultData() as Record<string, unknown>;
    const out: Record<string, unknown> = { partName: this.id };
    for (const [key, check] of Object.entries(this.fields) as [string, Field<unknown>][]) {
      const v = (raw as Record<string, unknown>)[key];
      if (v === undefined) {
        out[key] = defaults[key];
        continue;
      }
      const checked = check(v);
      if (checked === INVALID) {
        if (strict) return null;
        out[key] = defaults[key];
      } else out[key] = checked;
    }
    return out as T & InstrumentPartData;
  }
  /** The scale degrees this (input) part plays per step, for parts that build on the melody. */
  degrees(_selfData: T): readonly (number | null | undefined)[] | undefined {
    return undefined;
  }
  generate(_data: InstrumentData, _selfData: T & InstrumentPartData, _ctx: GenContext): string {
    return '';
  }
}

export function getPart<T extends InstrumentPart<any>>(
  key: PartClass<T>,
  data: InstrumentData
): T['dataType'] | undefined {
  return data?.parts?.find((x) => x.partName === key.id) as T['dataType'] | undefined;
}

/** Built-in Strudel synth sounds (no sample loading needed). */
export const VOICES = [
  'sawtooth',
  'supersaw',
  'square',
  'triangle',
  'sine',
  'white',
  'pink',
  'brown',
  'crackle',
  // General MIDI soundfonts (@strudel/soundfonts): each is downloaded the first time it plays
  'gm_piano',
  'gm_epiano1',
  'gm_vibraphone',
  'gm_marimba',
  'gm_music_box',
  'gm_flute',
  'gm_acoustic_bass',
  'gm_synth_bass_1',
  'gm_pad_warm',
  'gm_pad_poly',
  'gm_pad_halo',
  'gm_string_ensemble_1',
  'gm_choir_aahs',
  'gm_lead_2_sawtooth',
  'gm_acoustic_guitar_nylon',
  'gm_kalimba',
  'gm_pizzicato_strings'
] as const;
export type Voice = (typeof VOICES)[number];

/** A number for the generated code: finite and inside [min, max] (defence in depth: the reducer already validated it). */
const num = (v: unknown, min: number, max: number, fallback: number) =>
  isNum(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Which sound the instrument plays. The name comes from peers and ends up in code, so only known voices are emitted. */
export class PartVoice extends InstrumentPart<{ sound: string }> {
  static override readonly id = 'PartVoice';
  readonly stage = Stage.voice;
  readonly role = Role.sound;
  protected readonly fields = { sound: field.oneOf(VOICES) };
  override defaultData() {
    return { sound: 'sawtooth' };
  }
  override generate(_data: InstrumentData, selfData: PartVoice['dataType']): string {
    const sound = (VOICES as readonly string[]).includes(selfData.sound)
      ? selfData.sound
      : 'sawtooth';
    return `.sound("${sound}")`;
  }
}

/** Frequency modulation: `index` is how much the modulator bends the pitch, `ratio` its frequency relative to the note. */
export class PartFm extends InstrumentPart<{ index: number; ratio: number; decay: number }> {
  static override readonly id = 'PartFm';
  readonly stage = Stage.fm;
  readonly role = Role.sound;
  protected readonly fields = {
    index: field.num(0, 32),
    ratio: field.num(0.25, 16),
    decay: field.num(0, 4)
  };
  override defaultData() {
    return { index: 4, ratio: 2, decay: 0 };
  }
  override generate(_data: InstrumentData, selfData: PartFm['dataType']): string {
    const index = num(selfData.index, 0, 32, 0);
    if (index === 0) return '';
    const ratio = num(selfData.ratio, 0.25, 16, 1);
    const decay = num(selfData.decay, 0, 4, 0);
    // a decaying modulator gives bells and electric pianos: bright at the start, then mellow
    const env = decay > 0 ? `.fmdecay(${decay}).fmsustain(0)` : '';
    return `.fm(${index}).fmh(${ratio})${env}`;
  }
}

/** Amplitude envelope. A short decay with no sustain turns any voice into a pluck. */
export class PartEnvelope extends InstrumentPart<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}> {
  static override readonly id = 'PartEnvelope';
  readonly stage = Stage.envelope;
  readonly role = Role.sound;
  protected readonly fields = {
    attack: field.num(0, 4),
    decay: field.num(0, 4),
    sustain: field.num(0, 1),
    release: field.num(0, 4)
  };
  override defaultData() {
    return { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.1 };
  }
  override generate(_data: InstrumentData, selfData: PartEnvelope['dataType']): string {
    const a = num(selfData.attack, 0, 4, 0.005);
    const d = num(selfData.decay, 0, 4, 0.3);
    const s = num(selfData.sustain, 0, 1, 0.6);
    const r = num(selfData.release, 0, 4, 0.1);
    return `.attack(${a}).decay(${d}).sustain(${s}).release(${r})`;
  }
}

/** The octave the instrument's scale degrees are played in (read by the input and chord parts). */
export class PartOctave extends InstrumentPart<{ octave: number }> {
  static override readonly id = 'PartOctave';
  readonly stage = Stage.none;
  readonly role = Role.noteFx;
  protected readonly fields = { octave: field.num(0, 8, true) };
  override defaultData() {
    return { octave: 4 };
  }
  /** The octave of an instrument, safe to put in code. */
  static of(data: InstrumentData): number {
    return num(getPart(PartOctave, data)?.octave, 0, 8, 4);
  }
}

export const MAX_STEPS_PER_MEASURE = 64;
export const MAX_MEASURES = 16;

/** The loop's length: steps per measure and measures. */
export class PartSteps extends InstrumentPart<{
  stepsPerMeasure: number;
  measures: number;
  oddSignature: boolean;
}> {
  static override readonly id = 'PartSteps';
  readonly stage = Stage.none;
  readonly role = Role.notes;
  protected readonly fields = {
    stepsPerMeasure: field.num(1, MAX_STEPS_PER_MEASURE, true),
    measures: field.num(1, MAX_MEASURES, true),
    oddSignature: field.bool()
  };
  override defaultData() {
    return { stepsPerMeasure: 4, measures: 1, oddSignature: false };
  }
}

export enum VoicingMode {
  root = 'root',
  above = 'above',
  below = 'below',
  duck = 'duck'
}
/** `triadQuality` names, as Strudel's triad dictionary spells them (it has no 'dim', only 'o'; an unknown symbol makes a chord silent). */
const STRUDEL_TRIAD: Record<string, string> = { '': 'M', m: 'm', dim: 'o', aug: 'aug' };
const quality = (mode: string, degree: number | null | undefined) =>
  degree == null ? 'm' : (STRUDEL_TRIAD[triadQuality(mode, degree)] ?? 'm');
/** A degree for the code: an integer, or a rest. */
const degree = (d: unknown) => (Number.isInteger(d) ? `${d}` : '~');

/** How long a chord lasts: a new chord on every melody note, or one held per half bar / bar. */
export enum ChordHold {
  step = 'step',
  half = 'half',
  bar = 'bar'
}

/**
 * Triads built on the melody. Needs an input part that plays scale degrees (`GenContext.degrees`).
 * When chords are held, they run the arpeggiator's pattern on the held chord themselves, and mark it
 * consumed so it is not applied to the melody as well. (The arpeggiator knows nothing about chords.)
 */
export class PartChords extends InstrumentPart<{
  enabled: boolean;
  mode: VoicingMode;
  hold: ChordHold;
}> {
  static override readonly id = 'PartChords';
  readonly stage = Stage.harmony;
  readonly role = Role.noteFx;
  protected readonly fields = {
    enabled: field.bool(),
    mode: field.oneOf(Object.values(VoicingMode)),
    hold: field.oneOf(Object.values(ChordHold))
  };
  override defaultData() {
    return { enabled: false, mode: VoicingMode.below, hold: ChordHold.bar };
  }
  /** Steps per chord. Always divides the bar, so the chords stay aligned with the melody's loop. */
  static holdSteps(hold: ChordHold, stepsPerMeasure: number): number {
    if (hold === ChordHold.step) return 1;
    if (hold === ChordHold.half && stepsPerMeasure % 2 === 0) return stepsPerMeasure / 2;
    return stepsPerMeasure;
  }
  override generate(
    data: InstrumentData,
    selfData: PartChords['dataType'],
    ctx: GenContext
  ): string {
    if (!selfData.enabled || !ctx.degrees) return '';
    const notes = ctx.degrees;
    const { scaleKey, scaleMode } = ctx;
    const total = ctx.stepsPerMeasure * ctx.measures;
    const mode = (Object.values(VoicingMode) as string[]).includes(selfData.mode)
      ? selfData.mode
      : VoicingMode.below;
    const hold = (Object.values(ChordHold) as string[]).includes(selfData.hold)
      ? selfData.hold
      : ChordHold.bar;

    if (hold === ChordHold.step) {
      // each melody note becomes the triad built on its scale degree, one quality per step, aligned
      // with the notes; the note is the anchor, so in 'below' mode the melody stays the top voice
      const qualities = Array.from({ length: total }, (_, i) => quality(scaleMode, notes[i]));
      // the 'triads' dictionary: real three-note chords (the default one voices them as wide jazz shapes)
      return `.asChords("<${qualities.join(' ')}>").dict('triads').mode('${mode}').voicing()`;
    }

    // Held: the melody keeps playing, with a chord under it per segment, built on the segment's first
    // melody note. Every chord is aligned to the same fixed anchor (the key's root at the melody's
    // octave), so consecutive chords move to their nearest inversion instead of jumping in parallel.
    const k = PartChords.holdSteps(hold, ctx.stepsPerMeasure);
    const segments = Array.from({ length: Math.ceil(total / k) }, (_, s) =>
      notes.slice(s * k, s * k + k).find((x) => x != null)
    );
    const degrees = segments.map(degree).join(' ');
    const qualities = segments.map((d) => quality(scaleMode, d)).join(' ');
    const root = `${scaleKey}${PartOctave.of(data)}`;
    const arp = getPart(PartArpeggiator, data);
    // the arpeggio plays the held chord (not the melody); it runs at its usual rate per step
    const arpCode = arp?.enabled ? PartArpeggiator.code(arp, k) : '';
    if (arpCode) ctx.consumed?.add(PartArpeggiator.id);
    return `.stack(n("<${degrees}>").scale("${root}:${scaleMode}").asChords("<${qualities}>").dict('triads').anchor("${root}").mode('${mode}').voicing()${arpCode}.velocity(0.6).slow(${k}))`;
  }
}
export enum ArpeggiatorType {
  up = 'up',
  down = 'down',
  upDown = 'upDown',
  random = 'random'
}

const ARP_ORDERS: Record<ArpeggiatorType, string> = {
  [ArpeggiatorType.up]: '0 1 2',
  [ArpeggiatorType.down]: '2 1 0',
  [ArpeggiatorType.upDown]: '0 1 2 1',
  [ArpeggiatorType.random]: '0|1|2'
};

/** Plays the chord's notes one after another (held chords take it over: see `PartChords`). */
export class PartArpeggiator extends InstrumentPart<{
  enabled: boolean;
  speed: number;
  arpeggiatorType: ArpeggiatorType;
}> {
  static override readonly id = 'PartArpeggiator';
  readonly stage = Stage.arp;
  readonly role = Role.noteFx;
  protected readonly fields = {
    enabled: field.bool(),
    speed: field.num(0.25, 16),
    arpeggiatorType: field.oneOf(Object.values(ArpeggiatorType))
  };
  override defaultData() {
    return { enabled: false, arpeggiatorType: ArpeggiatorType.up, speed: 1 };
  }

  override generate(_data: InstrumentData, selfData: PartArpeggiator['dataType']): string {
    return selfData.enabled ? PartArpeggiator.code(selfData, 1) : '';
  }
  /** `stretch`: how many steps one cycle of the pattern lasts (a held chord is slowed down by its length). */
  static code(selfData: PartArpeggiator['dataType'], stretch: number): string {
    // indices into the chord's notes (a triad has three; an index past the end wraps round)
    const order = ARP_ORDERS[selfData.arpeggiatorType] ?? ARP_ORDERS[ArpeggiatorType.up];
    const speed = num(selfData.speed, 0.25, 16, 1);
    return `.arp("[${order}] * ${speed * stretch}")`;
  }
}

const DRUM_NOTES = Object.values(DrumNote) as string[];
type DrumTracks = { [key in DrumNote]: (0 | 1)[] };
/** Drum tracks: only known drum sounds, each a pattern of hits (0 / 1). */
const drumTracks: Field<DrumTracks> = (v) => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return INVALID;
  const out = {} as DrumTracks;
  for (const [k, hits] of Object.entries(v as Record<string, unknown>)) {
    if (!DRUM_NOTES.includes(k)) return INVALID;
    if (!Array.isArray(hits) || hits.length > MAX_PATTERN) return INVALID;
    if (!hits.every((h) => h === 0 || h === 1 || h === null)) return INVALID;
    out[k as DrumNote] = hits.map((h) => (h === 1 ? 1 : 0));
  }
  return out;
};

/** The input of a drum kit: one row of hits per drum sound. */
export class PartTrackNotes extends InstrumentPart<{ notes: DrumTracks }> {
  static override readonly id = 'PartTrackNotes';
  readonly stage = Stage.input;
  readonly role = Role.notes;
  protected readonly fields = { notes: drumTracks };
  override defaultData() {
    return { notes: {} as DrumTracks };
  }
  override generate(
    _data: InstrumentData,
    selfData: PartTrackNotes['dataType'],
    ctx: GenContext
  ): string {
    const total = ctx.stepsPerMeasure * ctx.measures;
    const joined = Object.entries(selfData.notes)
      .filter(([k]) => DRUM_NOTES.includes(k))
      .map(
        ([k, v]) => `<${Array.from({ length: total }, (_, i) => (v[i] == 1 ? k : '~')).join(' ')}>`
      )
      .join(',');
    return `s("${joined || '~'}")`; // a kit without tracks (a new pattern) rests
  }
}

/** Lowest and highest scale degree a melody step can hold (a few octaves around the instrument's). */
export const MIN_DEGREE = -32;
export const MAX_DEGREE = 32;

/** The input of a melodic instrument: one scale degree (or a rest) per step. */
export class MonoSequence extends InstrumentPart<{ notes: (number | undefined)[] }> {
  static override readonly id = 'MonoSequence';
  readonly stage = Stage.input;
  readonly role = Role.notes;
  protected readonly fields = { notes: field.steps(MIN_DEGREE, MAX_DEGREE) };
  override defaultData() {
    return { notes: [] };
  }
  override degrees(selfData: MonoSequence['dataType']) {
    return selfData.notes;
  }
  override generate(
    data: InstrumentData,
    selfData: MonoSequence['dataType'],
    ctx: GenContext
  ): string {
    const total = ctx.stepsPerMeasure * ctx.measures;
    const steps = Array.from({ length: total }, (_, i) => degree(selfData.notes[i])).join(' ');
    return `n("<${steps}>")
 .scale("${ctx.scaleKey}${PartOctave.of(data)}:${ctx.scaleMode}")`;
  }
}

export class PartEffects extends InstrumentPart<{
  reverb: number;
  delay: number;
  chorus: number;
}> {
  static override readonly id = 'PartEffects';
  readonly stage = Stage.effects;
  readonly role = Role.soundFx;
  protected readonly fields = {
    reverb: field.num(0, 1),
    delay: field.num(0, 1),
    chorus: field.num(0, 1)
  };
  override defaultData() {
    return { reverb: 0, delay: 0, chorus: 0 };
  }

  override generate(_data: InstrumentData, selfData: PartEffects['dataType']): string {
    const chorusAmount = num(selfData.chorus, 0, 1, 0);
    const chorus = chorusAmount ? `.add(note(0, ${chorusAmount}))` : '';
    return `${chorus}.room(${num(selfData.reverb, 0, 1, 0)}).delay(${num(selfData.delay, 0, 1, 0)})`;
  }
}

export const MIN_FILTER_HZ = 20;
export const MAX_FILTER_HZ = 20000;

export const MAX_FILTER_RES = 50;
export const MAX_FILTER_ENV = 8;

/** Which side of the cutoff a filter keeps. Saved: never change the values. */
export enum FilterType {
  lowpass = 'low pass',
  highpass = 'high pass',
  bandpass = 'band pass'
}
/** Strudel's controls per filter type: cutoff, resonance (Q), envelope depth. */
const FILTER_CONTROLS: Record<FilterType, [string, string, string]> = {
  [FilterType.lowpass]: ['lpf', 'lpq', 'lpenv'],
  [FilterType.highpass]: ['hpf', 'hpq', 'hpenv'],
  [FilterType.bandpass]: ['bpf', 'bpq', 'bpenv']
};

/**
 * A resonant filter. `res` is its resonance (Q: a peak at the cutoff, or how narrow a band pass is);
 * `env` is how far the filter envelope sweeps the cutoff on each note, in octaves (0: it stays put).
 */
export class PartFilter extends InstrumentPart<{
  type: FilterType;
  freq: number;
  res: number;
  env: number;
}> {
  static override readonly id = 'PartFilter';
  readonly stage = Stage.filter;
  readonly role = Role.soundFx;
  protected readonly fields = {
    type: field.oneOf(Object.values(FilterType)),
    freq: field.num(MIN_FILTER_HZ, MAX_FILTER_HZ),
    res: field.num(0, MAX_FILTER_RES),
    env: field.num(0, MAX_FILTER_ENV)
  };
  override defaultData() {
    // songs saved before the type and envelope existed were a low pass swept by 4 octaves
    return { type: FilterType.lowpass, freq: 1000, res: 0.5, env: 4 };
  }

  override generate(_data: InstrumentData, selfData: PartFilter['dataType']): string {
    const [cutoff, q, envelope] =
      FILTER_CONTROLS[selfData.type] ?? FILTER_CONTROLS[FilterType.lowpass];
    const freq = num(selfData.freq, MIN_FILTER_HZ, MAX_FILTER_HZ, 1000);
    const res = num(selfData.res, 0, MAX_FILTER_RES, 0.5);
    const env = num(selfData.env, 0, MAX_FILTER_ENV, 4);
    return `.${cutoff}(${freq}).${q}(${res})${env > 0 ? `.${envelope}(${env})` : ''}`;
  }
}

/** Every part type, by id. Adding a part: write the class, list it here, and give it a view in `components/partViews.ts`. */
export const PART_TYPES: PartClass[] = [
  MonoSequence,
  PartTrackNotes,
  PartVoice,
  PartFm,
  PartEnvelope,
  PartChords,
  PartArpeggiator,
  PartFilter,
  PartOctave,
  PartSteps,
  PartEffects
];
const partsById = new Map<string, InstrumentPart>(PART_TYPES.map((P) => [P.id, new P()]));
/** The part type stored under `partName`, if it is one this version knows. */
export function getPartType(partName: string): InstrumentPart | undefined {
  return typeof partName === 'string' ? partsById.get(partName) : undefined;
}
/** A part's name for people: "PartArpeggiator" -> "Arpeggiator", "PartTrackNotes" -> "Track notes". */
export function partTitle(partName: string): string {
  if (partName === 'PartFm') return 'FM';
  return partName
    .replace(/^Part/, '')
    .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`);
}

/** New data for a part, with `data` over its defaults. */
export function makePartData<T extends InstrumentPart<any>>(
  part: PartClass<T>,
  data?: Partial<T['dataType']>
): T['dataType'] {
  return getPartType(part.id)!.createData(data) as T['dataType'];
}
