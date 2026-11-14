import type { InstrumentPart, InstrumentPartTyped, PartType } from './parts.svelte';
import type { InstrumentData } from './instruments';
import type { Dispatch } from './commands';

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
/** Views that edit data get a `dispatch`: they never mutate instrument state themselves. */
export interface IDispatchingInstrumentViewProps extends IInstrumentViewProps {
  dispatch: Dispatch;
}
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
  instrumentData: T;
  index: number;
}
