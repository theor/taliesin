import type { InstrumentPart, PartSteps } from './parts';
import type { ISequencer } from './sequencer';

export interface IInstrument {
  name: string;
  getLength(data: InstrumentData): number;
  generate: (data: InstrumentData) => string;
  createData: () => InstrumentData;
  // sequencer(data: IInstrumentData): ISequencer|undefined ;
  sequencer: ISequencer | undefined;
  randomize(data: InstrumentData): InstrumentData;
}
export abstract class Instrument
  // <T extends InstrumentData>
  implements IInstrument
{
  getLength(data: InstrumentData): number {
    var steps = getPart<PartSteps>('steps', data);
    if (steps) {
      return steps.stepsPerMeasure * steps.measures;
    }
    return 4;
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

export interface InstrumentData {
  instrumentName: string;
  parts: InstrumentPart[];
}
export function getPart<T extends InstrumentPart>(
  key: T['type'],
  data: InstrumentData
): T | undefined {
  return data.parts.find((x) => x.type === key) as T;
}
export function hasPart<T extends InstrumentPart>(key: T['type'], data: InstrumentData): boolean {
  return data.parts.some((x) => x.type === key);
}
