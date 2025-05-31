import { PartChords, PartEffects, PartFilter, PartSteps, type InstrumentPart, PartArpeggiator} from './parts.svelte';
import type { ISequencer } from './sequencer';


export interface Length {
  stepsPerMeasure: number;
  measures: number;
}
export abstract class Instrument {
  getLength(data: InstrumentData): Length {
    var steps = getPart(PartSteps, data);
    if (steps) {
      return steps.data;
    }
    return { stepsPerMeasure: 4, measures: 1 };
  }
  abstract randomize(data: InstrumentData): InstrumentData;
  sequencer: ISequencer | undefined;
  // abstract sequencer(data: InstrumentData): ISequencer|undefined ;
  notes: string[] = [];
  name: string = this.constructor.name;
  progress(data:InstrumentData) { return getPart(PartSteps, data)?.time!; }

  abstract createData_(): InstrumentPart[];
  createData(name?: string): InstrumentData {
    return {
      parts: this.createData_(),
      instrumentName: this.name,
      name: name || this.name,
      volume: 1,
      state: TrackState.Playing,
    };
  }
  protected abstract generate_(data: InstrumentData): string;
  generate(data: InstrumentData): string {
    const inputPart = data.parts.find((x) => x.isInput());
    
    const l = this.getLength(data);
    return `${inputPart?.generate(data, l) || ''}
  ${getPart(PartChords, data)?.generate(data, l) || ''}
  ${getPart(PartArpeggiator, data)?.generate(data, l) || ''}
  .fast(${this.getLength(data).stepsPerMeasure})
  ${getPart(PartFilter, data)?.generate(data, l) || ''}
  ${getPart(PartEffects, data)?.generate(data, l) || ''}
  ${this.generate_(data)}
  ${this.trackOptions(data)}`;
  }

  protected trackOptions(data: InstrumentData): string {
    return `.gain(${data.volume})`;
  }
}
export type Constructor<T> = new (...args: any[]) => T;
export enum TrackState {
  Playing,
  Muted,
  Solo,
}
export interface InstrumentData {
  name: string;
  instrumentName: string;
  parts: InstrumentPart[];
  volume: number;
  state: TrackState;
}
export type InstrumentDataJsonValue = Omit<InstrumentData, 'parts'> & {parts: {name:string}[]};

export function getPart<T extends InstrumentPart>(
  key: Constructor<T>,
  data: InstrumentData
): T | undefined {
  // console.log('getPart', key.name, data.instrumentName, data.parts);

  return data.parts.find((x) => x instanceof key) as T;
}
export function hasPart<T extends InstrumentPart>(
  key: Constructor<T>,
  data: InstrumentData): boolean {
  return data.parts.some((x) => x instanceof key);
}
