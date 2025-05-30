import { getPart, type InstrumentData, type Length } from "./instruments";

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
  abstract assign(other: InstrumentPart): void;
  isInput(): boolean { return false; }
  generate(data: InstrumentData, length: Length): string {
    return '';
  }
}

abstract class InstrumentPartTyped<T> extends InstrumentPart {
  data = $state<T>({} as T);
  abstract defaultData(): T;
  override assign(other: InstrumentPartTyped<T>): void {
    if (!other || !(other instanceof this.constructor)) {
      throw new Error(
        `Cannot assign part of type ${other?.constructor.name} to ${this.constructor.name}`
      );
    }
    this.data = { ...this.data, ...other.data };
  }
  constructor(data?: Partial<T>) {
    super();
    this.data = data ? { ...this.defaultData(), ...data } : { ...this.defaultData() };
  }
}

export class PartOctave extends InstrumentPartTyped<{ octave: number }> {
  override defaultData() {
    return { octave: 4 };
  }
  // type = 'octave';
  constructor(octave: number) {
    super({ octave });
  }
}

export class PartSteps extends InstrumentPartTyped<{
  stepsPerMeasure: number;
  measures: number;
  oddSignature: boolean;
}> {
  override isInput(): boolean { return true; }
  override defaultData() {
    return { stepsPerMeasure: 4, measures: 1, oddSignature: false };
  }
  constructor(stepsPerMeasure: number, measures: number, oddSignature: boolean) {
    super({ stepsPerMeasure, measures, oddSignature });
  }
}

export enum  VoicingMode {
  root = 'root',
  above = 'above',
  below = 'below',
  duck = 'duck',
}
export class PartChords extends InstrumentPartTyped<{ enabled: boolean; mode:VoicingMode }> {
  override defaultData() {
    return { enabled: false, mode: VoicingMode.root };
  }
  override generate(data: InstrumentData, length: Length): string {
    return this.data.enabled ? `.asChords("<M m7>*2").mode('${this.data.mode}').voicing()` : '';
  }
}
export enum ArpeggiatorType {
  up = 'up',
  down = 'down',
  upDown = 'upDown',
  random = 'random'
}

export class PartArpeggiator extends InstrumentPartTyped<{
  enabled: boolean;
  arpeggiatorType: ArpeggiatorType;
}> {
  override defaultData() {
    return { enabled: false, arpeggiatorType: ArpeggiatorType.up };
  }
  
  override generate(data: InstrumentData, length: Length): string {
    const seq = "<0 1 2 3>"
    return `${this.data.enabled ? `.arp("${seq}")` : ''}`;
  }
}
export class PartTrackNotes extends InstrumentPartTyped<{
  notes: { [key in DrumNote]: (0 | 1)[] };
}> {
  override isInput(): boolean { return true; }
  override defaultData() {
    return { notes: {} as { [key in DrumNote]: (0 | 1)[] } };
  }
  override generate(data: InstrumentData, length: Length): string {
    const joined = Object.entries(this.data.notes)
      .map((t) => {
        const [k, v] = t;
        var p = Array.from({ length: length.stepsPerMeasure * length.measures }, (_, i) => v[i] == 1 ? k : '~').join(' ');
        return `<${p}>*${length.stepsPerMeasure}`;
      })
      .join(','); // `s("${data.notes.join(' ')}")`;
    return `s("${joined}")`;
  }
}

export class MonoSequence extends InstrumentPartTyped<{ notes: (number | undefined)[] }> {
  override isInput(): boolean { return true; }
  override defaultData() {
    return { notes: [] };
  }
  override generate(data: InstrumentData, length: Length): string {
    const notes = getPart(MonoSequence, data)!;
    const octave = getPart(PartOctave, data)?.data?.octave ?? 4;
    // console.log(`GEN ${this.name}`, notes.data.notes, this.getLength(data));
    return `n("<${Array.from({ length: length.stepsPerMeasure * length.measures }, (_, i) => notes.data.notes[i])
      .map((x) => x ?? '~')
      .join(' ')}>*${length.stepsPerMeasure}")
 .scale("C${octave}:minor")`;
  }
}

export class PartEffects extends InstrumentPartTyped<{ reverb: number; delay: number, chorus: number }> {
  override defaultData() {
    return { reverb: 0, delay: 0, chorus: 0 };
  }

  override generate(data: InstrumentData, length: Length): string {
    const chorus = this.data.chorus ? `.add(note(0, ${this.data.chorus}))` : '';
    return `${chorus}.room(${this.data.reverb ?? 0}).delay(${this.data.delay ?? 0})`;
  }
}

export class PartFilter extends InstrumentPartTyped<{ freq: number, res: number }> {
  override defaultData(): { freq: number; res: number; } {
    return { freq: 1000, res: 0.5 };
  }

  override generate(data: InstrumentData, length: Length): string {
    return `.lpf("${this.data.freq}:${this.data.res}").lpenv(4)`;
  }
}
