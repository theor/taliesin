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
  'gm_lead_2_sawtooth'
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
export class PartChords extends InstrumentPartTyped<{ enabled: boolean; mode: VoicingMode }> {
  override defaultData() {
    return { enabled: false, mode: VoicingMode.root };
  }
  override generate(
    data: InstrumentData,
    selfData: PartChords['_dataType'],
    length: Length
  ): string {
    if (!selfData.enabled) return '';
    // each melody note becomes the triad built on its scale degree (major / minor / dim), one
    // quality per step, aligned with the notes; steps without a note get a filler (they are rests)
    const notes = getPart(MonoSequence, data)?.notes ?? [];
    const { scaleMode } = getGlobalContext();
    const qualities = Array.from({ length: length.stepsPerMeasure * length.measures }, (_, i) => {
      const degree = notes[i];
      return degree === undefined ? 'm' : triadQuality(scaleMode, degree) || 'M';
    });
    return `.asChords("<${qualities.join(' ')}>").mode('${selfData.mode}').voicing()`;
  }
  // override generate(data: InstrumentData, selfData: infer T, length: Length): string {
  // }
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
    // indices into the chord's notes (a triad has three; an index past the end wraps round)
    const order = ARP_ORDERS[selfData.arpeggiatorType] ?? ARP_ORDERS[ArpeggiatorType.up];
    return `.arp("[${order}] * ${selfData.speed}")`;
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
