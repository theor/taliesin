import { derived } from 'svelte/store';
import { getGlobalContext } from './context';
import { triadQuality } from './scale';
import { getPart, type InstrumentData, type Length } from './instruments';
import { strudel } from './strudel';

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
export abstract class InstrumentPart {
  // abstract serialize(): ({ [key: string]: any });
  abstract createData(data?: InstrumentPartDataNoName): InstrumentPartData;
  abstract assign(
    self: InstrumentPartDataNoName,
    other: InstrumentPartDataNoName
  ): InstrumentPartDataNoName;
  isInput(): boolean {
    return false;
  }
  generate(data: InstrumentData, selfData: InstrumentPartData, length: Length): string {
    return '';
  }
}
export interface InstrumentPartData {
  partName: string;
}
type InstrumentPartDataNoName = Omit<InstrumentPartData, 'partName'>;

export abstract class InstrumentPartTyped<
  T extends InstrumentPartDataNoName
> extends InstrumentPart {
  // data = $state<T & InstrumentPartData>({} as (T & InstrumentPartData));
  // override serialize(): { [key: string]: any } {
  //   return $state.snapshot(this.data) as { [key: string]: any };
  // }
  protected _dataType: T & InstrumentPartData = undefined!;
  getPart(data: InstrumentData): T | undefined {
    return getPart(this.constructor as any, data) as T;
  }
  abstract defaultData(): T;
  override assign(self: T, other: T): T {
    if (!other) {
      throw new Error(`Cannot assign part of type ${other} to ${this.constructor.name}`);
    }
    return { ...self, ...other };
  }
  override createData(data?: Partial<Omit<T, 'partName'>>) {
    const partName = this.constructor.name;
    return data
      ? { ...this.defaultData(), ...data, partName }
      : { ...this.defaultData(), partName };
  }
  override generate(
    data: InstrumentData,
    selfData: T & InstrumentPartData,
    length: Length
  ): string {
    return '';
  }
}
export type PartType<T extends InstrumentPartTyped<any>> =
  T extends InstrumentPartTyped<infer U> ? U : never;

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

/** Which sound the instrument plays. The name comes from peers and ends up in code, so only known voices are emitted. */
export class PartVoice extends InstrumentPartTyped<{ sound: string }> {
  override defaultData() {
    return { sound: 'sawtooth' };
  }
  override generate(
    data: InstrumentData,
    selfData: PartVoice['_dataType'],
    length: Length
  ): string {
    const sound = (VOICES as readonly string[]).includes(selfData.sound) ? selfData.sound : 'sawtooth';
    return `.sound("${sound}")`;
  }
}

/** A number from a peer, kept finite and inside [min, max]. */
const num = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/** Frequency modulation: `index` is how much the modulator bends the pitch, `ratio` its frequency relative to the note. */
export class PartFm extends InstrumentPartTyped<{ index: number; ratio: number; decay: number }> {
  override defaultData() {
    return { index: 4, ratio: 2, decay: 0 };
  }
  override generate(
    data: InstrumentData,
    selfData: PartFm['_dataType'],
    length: Length
  ): string {
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
export class PartEnvelope extends InstrumentPartTyped<{
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}> {
  override defaultData() {
    return { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.1 };
  }
  override generate(
    data: InstrumentData,
    selfData: PartEnvelope['_dataType'],
    length: Length
  ): string {
    const a = num(selfData.attack, 0, 4, 0.005);
    const d = num(selfData.decay, 0, 4, 0.3);
    const s = num(selfData.sustain, 0, 1, 0.6);
    const r = num(selfData.release, 0, 4, 0.1);
    return `.attack(${a}).decay(${d}).sustain(${s}).release(${r})`;
  }
}

export class PartOctave extends InstrumentPartTyped<{ octave: number }> {
  override defaultData() {
    return { octave: 4 };
  }
}

export class PartSteps extends InstrumentPartTyped<{
  stepsPerMeasure: number;
  measures: number;
  oddSignature: boolean;
}> {
  time(data: PartType<PartSteps>, x: number): number {
    return (x / data.measures) % 1;
  }

  override isInput(): boolean {
    return true;
  }
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

/** How long a chord lasts: a new chord on every melody note, or one held per half bar / bar. */
export enum ChordHold {
  step = 'step',
  half = 'half',
  bar = 'bar'
}

export class PartChords extends InstrumentPartTyped<{ enabled: boolean; mode: VoicingMode; hold: ChordHold }> {
  override defaultData() {
    return { enabled: false, mode: VoicingMode.below, hold: ChordHold.bar };
  }
  /** Steps per chord. Always divides the bar, so the chords stay aligned with the melody's loop. */
  static holdSteps(hold: ChordHold, stepsPerMeasure: number): number {
    if (hold === ChordHold.step) return 1;
    if (hold === ChordHold.half && stepsPerMeasure % 2 === 0) return stepsPerMeasure / 2;
    return stepsPerMeasure;
  }
  /** Whether the chords are a layer under the melody (anything but one chord per step). */
  static isHeld(selfData: { enabled: boolean; hold: ChordHold } | undefined): boolean {
    return !!selfData?.enabled && selfData.hold !== ChordHold.step;
  }
  override generate(
    data: InstrumentData,
    selfData: PartChords['_dataType'],
    length: Length
  ): string {
    if (!selfData.enabled) return '';
    const notes = getPart(MonoSequence, data)?.notes ?? [];
    const { scaleKey, scaleMode } = getGlobalContext();
    const total = length.stepsPerMeasure * length.measures;
    const mode = (Object.values(VoicingMode) as string[]).includes(selfData.mode) ? selfData.mode : VoicingMode.below;
    const hold = (Object.values(ChordHold) as string[]).includes(selfData.hold) ? selfData.hold : ChordHold.bar;

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
    const k = PartChords.holdSteps(hold, length.stepsPerMeasure);
    const segments = Array.from({ length: Math.ceil(total / k) }, (_, s) =>
      notes.slice(s * k, s * k + k).find((x) => x != null)
    );
    const degrees = segments.map((d) => (d == null ? '~' : d)).join(' ');
    const qualities = segments.map((d) => quality(scaleMode, d)).join(' ');
    const octave = getPart(PartOctave, data)?.octave ?? 4;
    const root = `${scaleKey}${octave}`;
    const arp = getPart(PartArpeggiator, data);
    // the arpeggio plays the held chord (not the melody); it runs at its usual rate per step
    const arpCode = arp?.enabled ? PartArpeggiator.code(arp, k) : '';
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

export class PartArpeggiator extends InstrumentPartTyped<{
  enabled: boolean;
  speed: number;
  arpeggiatorType: ArpeggiatorType;
}> {
  override defaultData() {
    return { enabled: false, arpeggiatorType: ArpeggiatorType.up, speed: 1 };
  }

  override generate(
    data: InstrumentData,
    selfData: PartArpeggiator['_dataType'],
    length: Length
  ): string {
    if (!selfData.enabled) return '';
    // held chords run their own arpeggio (this one would arpeggiate the melody along with them)
    if (data?.parts && PartChords.isHeld(getPart(PartChords, data))) return '';
    return PartArpeggiator.code(selfData, 1);
  }
  /** `stretch`: how many steps one cycle of the pattern lasts (a held chord is slowed down by its length). */
  static code(selfData: PartType<PartArpeggiator>, stretch: number): string {
    // indices into the chord's notes (a triad has three; an index past the end wraps round)
    const order = ARP_ORDERS[selfData.arpeggiatorType] ?? ARP_ORDERS[ArpeggiatorType.up];
    const speed = Number.isFinite(selfData.speed) ? selfData.speed : 1;
    return `.arp("[${order}] * ${speed * stretch}")`;
  }
}
export class PartTrackNotes extends InstrumentPartTyped<{
  notes: { [key in DrumNote]: (0 | 1)[] };
}> {
  override isInput(): boolean {
    return true;
  }
  override defaultData() {
    return { notes: {} as { [key in DrumNote]: (0 | 1)[] } };
  }
  override generate(
    data: InstrumentData,
    selfData: PartTrackNotes['_dataType'],
    length: Length
  ): string {
    const joined = Object.entries(selfData.notes)
      .map((t) => {
        const [k, v] = t;
        var p = Array.from({ length: length.stepsPerMeasure * length.measures }, (_, i) =>
          v[i] == 1 ? k : '~'
        ).join(' ');
        return `<${p}>`;
      })
      .join(','); // `s("${data.notes.join(' ')}")`;
    return `s("${joined}")`;
  }
}

export class MonoSequence extends InstrumentPartTyped<{ notes: (number | undefined)[] }> {
  override isInput(): boolean {
    return true;
  }
  override defaultData() {
    return { notes: [] };
  }
  override generate(
    data: InstrumentData,
    selfData: MonoSequence['_dataType'],
    length: Length
  ): string {
    const octave = getPart(PartOctave, data)?.octave ?? 4;
    // console.log(`GEN ${this}`, selfData, length);

    const ctx = getGlobalContext();
    return `n("<${Array.from(
      { length: length.stepsPerMeasure * length.measures },
      (_, i) => selfData.notes[i]
    )
      .map((x) => x ?? '~')
      .join(' ')}>")
 .scale("${ctx.scaleKey}${octave}:${ctx.scaleMode}")`;
  }
}

export class PartEffects extends InstrumentPartTyped<{
  reverb: number;
  delay: number;
  chorus: number;
}> {
  override defaultData() {
    return { reverb: 0, delay: 0, chorus: 0 };
  }

  override generate(
    data: InstrumentData,
    selfData: PartEffects['_dataType'],
    length: Length
  ): string {
    const chorus = selfData.chorus ? `.add(note(0, ${selfData.chorus}))` : '';
    return `${chorus}.room(${selfData.reverb ?? 0}).delay(${selfData.delay ?? 0})`;
  }
}

export class PartFilter extends InstrumentPartTyped<{ freq: number; res: number }> {
  override defaultData(): { freq: number; res: number } {
    return { freq: 1000, res: 0.5 };
  }

  override generate(
    data: InstrumentData,
    selfData: PartFilter['_dataType'],
    length: Length
  ): string {
    return `.lpf("${selfData.freq}:${selfData.res}").lpenv(4)`;
  }
}
