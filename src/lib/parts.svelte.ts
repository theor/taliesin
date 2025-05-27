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
  constructor(data: Partial<T>) {
    super();
    this.data = { ...this.defaultData(), ...data };
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
  override defaultData() {
    return { stepsPerMeasure: 4, measures: 1, oddSignature: false };
  }
  constructor(stepsPerMeasure: number, measures: number, oddSignature: boolean) {
    super({ stepsPerMeasure, measures, oddSignature });
  }
}

export class PartTrackNotes extends InstrumentPartTyped<{
  notes: { [key in DrumNote]: (0 | 1)[] };
}> {
  override defaultData() {
    return { notes: {} as { [key in DrumNote]: (0 | 1)[] } };
  }
}

export class MonoSequence extends InstrumentPartTyped<{ notes: (number | undefined)[] }> {
  override defaultData() {
    return { notes: [] };
  }
}

export class PartEffects extends InstrumentPartTyped<{ reverb: number; delay: number }> {
  override defaultData() {
    return { reverb: 0, delay: 0 };
  }
  generate(): string {
    return `.room(${this.data.reverb ?? 0}).delay(${this.data.delay ?? 0})`;
  }
}

export class PartFilter extends InstrumentPartTyped<{freq:number, res:number}> {
  override defaultData(): { freq: number; res: number; } {
    return { freq: 1000, res: 0.5 };
  }
  generate(): string {
    return `.lpf("${this.data.freq}:${this.data.res}")`;
  }
}
