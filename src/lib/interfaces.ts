import type { Component, Snippet } from 'svelte';
import type { InstrumentPart } from './parts';
import type { InstrumentData } from './instruments';

export enum Status {
  disconnected = 'disconnected',
  connecting = 'connecting',
  connected = 'connected'
}

export interface IPartViewProps<T extends InstrumentPart> {
  part: T;
  btnSnippet: Snippet<[Component, () => void]>;
  onPartChanged: (part: T) => void;
}
export interface IInstrumentViewProps {
  instrumentData: InstrumentData;
  index: number;
}
// export function castProps<T extends IInstrumentData>(p:IInstrumentData): ITypedInstrumentViewProps<T>{
//     return p as ITypedInstrumentViewProps<T>;
// }
export interface ITypedInstrumentViewProps<T extends InstrumentData> {
  instrumentData: T;
  index: number;
}
// interface IInstrumentView<T extends IInstrument> {
//     getInstrument(): T;
//     setInstrument(instrument: T): void;

//     // onChange: (instrument: T) => void;
//     // onDelete: (instrument: T) => void;
//     // onAdd: (instrument: T) => void;
//     // onPlay: (instrument: T) => void;
//     // onStop: (instrument: T) => void;
// }

// class PianoScaleView implements IInstrumentView<PianoScale> {
//     instrument: PianoScale;
//     constructor(instrument: PianoScale) {
//         this.instrument = instrument;
//     }
// }
