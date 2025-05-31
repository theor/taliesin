import type { InstrumentPart, InstrumentPartTyped, PartType } from './parts.svelte';
import type { InstrumentData } from './instruments';

export enum Status {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected'
}

export interface IPartViewProps<T extends InstrumentPartTyped<any>> {
  part: T;
  partData: PartType<T>;
}
export interface IInstrumentViewProps {
  instrumentData: InstrumentData;
  index: number;
}
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
  instrumentData: T;
  index: number;
}
