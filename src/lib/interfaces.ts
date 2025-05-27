import type { InstrumentPart } from './parts.svelte';
import type { InstrumentData } from './instruments';

export enum Status {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected'
}

export interface IPartViewProps<T extends InstrumentPart> {
  part: T;
}
export interface IInstrumentViewProps {
  instrumentData: InstrumentData;
  index: number;
}
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
  instrumentData: T;
  index: number;
}
