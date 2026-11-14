import { findPartTypeAndData, getPartType, getPartTypeAndData } from './Store.svelte';
import {
  PartChords,
  PartEffects,
  PartFilter,
  PartSteps,
  type InstrumentPart,
  PartArpeggiator,
  type InstrumentPartData,
  InstrumentPartTyped,
  type PartType
} from './parts.svelte';
import type { ISequencer } from './sequencer';
import { strudel } from './strudel';

export interface Length {
  stepsPerMeasure: number;
  measures: number;
}
export abstract class Instrument {
  getLength(data: InstrumentData): Length {
    var steps = getPart(PartSteps, data);
    if (steps) {
      return steps;
    }
    return { stepsPerMeasure: 4, measures: 1 };
  }
  abstract randomize(data: InstrumentData): InstrumentData;
  sequencer: ISequencer | undefined;
  // abstract sequencer(data: InstrumentData): ISequencer|undefined ;
  notes: string[] = [];
  name: string = this.constructor.name;
  // progress(data:InstrumentData) { return getPart(PartSteps, data)?.time(strudel.time)!; }

  abstract createData_(): InstrumentPartData[];
  createData(name?: string): InstrumentData {
    return {
      id: newId(),
      parts: this.createData_(),
      instrumentName: this.name,
      name: name || this.name,
      volume: 1,
      state: TrackState.Playing
    };
  }
  protected abstract generate_(data: InstrumentData): string;
  generate(data: InstrumentData): string {
    const generatePart = (x:Constructor<InstrumentPartTyped<any>>) => {
      const part = getPartTypeAndData(x, data);
      // console.log(`Generating part ${x.name}`, part);
      if (part.part && part.data) {
        
        return part.part.generate(data, part.data, this.getLength(data));
      }
      return '';
    }
    const inputPart = findPartTypeAndData(data, (x) => x.isInput());
// console.warn(`Generating instrument ${this.name} with input part:`, inputPart?.part, inputPart?.data, data);

    const l = this.getLength(data);
    return `${inputPart?.part.generate(data, inputPart.data, l) || ''}
  ${generatePart(PartChords)}
  ${generatePart(PartArpeggiator)}
  .fast(${this.getLength(data).stepsPerMeasure})
  ${generatePart(PartFilter)}
  ${generatePart(PartEffects)}
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
  Solo
}
/** Stable identity used to address an instrument across peers (array indices shift on add/remove). */
export function newId(): string {
  // crypto.randomUUID needs a secure context; fall back for plain-http LAN sessions
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
export interface InstrumentData {
  id: string;
  name: string;
  instrumentName: string;
  parts: InstrumentPartData[];
  volume: number;
  state: TrackState;
}
export type InstrumentDataJsonValue = InstrumentData & { [key: string]: any }; // Omit<InstrumentData, 'parts'> & {parts: {name:string}[]};
export function getPart<T extends InstrumentPartTyped<any>>(
  key: Constructor<T>,
  data: InstrumentData
): PartType<T> | undefined {
  return data.parts.find((x) => x.partName === key.name) as PartType<T>;
}

export function hasPart<T extends InstrumentPart>(
  key: Constructor<T>,
  data: InstrumentData
): boolean {
  return data.parts.some((x) => x instanceof key);
}
