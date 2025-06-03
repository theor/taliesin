import { derived } from 'svelte/store';
import { getGlobalContext } from './context';
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
    return selfData.enabled ? `.asChords("<m m>*2").mode('${selfData.mode}').voicing()` : '';
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
    const seq = `[0 1 2 3] * ${selfData.speed}`;
    return `${selfData.enabled ? `.arp("${seq}")` : ''}`;
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
