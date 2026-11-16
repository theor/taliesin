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
  /** The transport, for views that show a playhead: position in cycles, and whether it is running. */
  position?: number;
  playing?: boolean;
  /** The song position (cycles) being heard right now, read live: for views that record live input. */
  now?: () => number;
  /** When someone else last edited this instrument (changes → the view flashes). */
  editedByOther?: number;
}
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
  instrumentData: T;
  index: number;
}
