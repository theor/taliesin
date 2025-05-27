import { PartSteps, type InstrumentPart } from './parts.svelte';
import type { ISequencer } from './sequencer';


export interface Length {
    stepsPerMeasure: number;
    measures: number;
}
export abstract class Instrument
{
  getLength(data: InstrumentData): Length {
    var steps = getPart(PartSteps, data);
    if (steps) {
      return steps.data;
    }
    return {stepsPerMeasure: 4, measures: 1};
  }
  abstract randomize(data: InstrumentData): InstrumentData;
  sequencer: ISequencer | undefined;
  // abstract sequencer(data: InstrumentData): ISequencer|undefined ;
  notes: string[] = [];
  name: string = this.constructor.name;

  abstract createData_(): InstrumentPart[];
  createData(): InstrumentData {
    return { parts: this.createData_(), instrumentName: this.name };
  }
  abstract generate(data: InstrumentData): string;
}
export type Constructor<T> = new (...args: any[]) => T;
export interface InstrumentData {
  instrumentName: string;
  parts: InstrumentPart[];
}
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
