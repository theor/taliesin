import type { InstrumentPart, PartType } from './parts.svelte';
import type { InstrumentData } from './instruments';
import type { Dispatch } from './commands';

export enum Status {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected'
}

/** A part's controls: they edit `partData` (a draft, bound), and `InstrumentPartView` turns the edits into commands. */
export interface IPartViewProps<T extends InstrumentPart<any>> {
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
