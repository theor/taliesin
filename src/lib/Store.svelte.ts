import { Status } from './interfaces';
import { joinRoom, type BaseRoomConfig, type RelayConfig } from 'trystero/nostr';
import { selfId, type ActionSender, type JsonValue, type Room } from 'trystero';
import {
  getPart,
  type Constructor,
  type Instrument,
  type InstrumentData,
  type InstrumentDataJsonValue
} from './instruments';
import { PianoScale } from './instruments/MonoSynth';
import { Drum } from './instruments/Drum';
import type { Component } from 'svelte';
import { DrumIcon, KeyboardMusic, Music, Piano } from '@lucide/svelte';
import {
  PartEffects,
  type InstrumentPart,
  MonoSequence,
  PartSteps,
  PartFilter,
  PartOctave,
  PartChords,
  PartArpeggiator,
  PartTrackNotes,
  type InstrumentPartData,
  InstrumentPartTyped,
  type PartType
} from './parts.svelte';
import { VITEST } from './strudel';

export const mixerIndex = -1;

if (VITEST) {
}

const config: BaseRoomConfig & RelayConfig = {
  appId: 'taliesin'

  // turnConfig: [
  //   { urls: ['stun:stun.l.google.com:19302' ]},
  // ]

  // relayUrls: ["wss://192.168.1.82:3334"]
};
let room: Room = undefined!;

type WrappedInstrument = {
  index: number;
  instrument: InstrumentDataJsonValue;
};

type Preset = {
  name: string;
  instrument: Constructor<Instrument>;
  parts: InstrumentPartData[];
};

export const parts: { part: Constructor<InstrumentPart>; partName: string }[] = [
  { partName: PartEffects.name, part: PartEffects },
  { partName: PartFilter.name, part: PartFilter },
  { partName: PartSteps.name, part: PartSteps },
  { partName: PartChords.name, part: PartChords },
  { partName: PartArpeggiator.name, part: PartArpeggiator },
  { partName: MonoSequence.name, part: MonoSequence },
  { partName: PartOctave.name, part: PartOctave },
  { partName: PartTrackNotes.name, part: PartTrackNotes }
];
export const partMap: { [key: string]: InstrumentPart } = parts.reduce(
  (acc, p) => {
    acc[p.partName] = new p.part();
    return acc;
  },
  {} as { [key: string]: InstrumentPart }
);

export type PartTypeAndData<T extends InstrumentPartTyped<any>> = { part: T; data: PartType<T> };
export function findPartTypeAndData<T extends InstrumentPartTyped<any>>(
  data: InstrumentData,
  f: (x: InstrumentPart) => boolean
): PartTypeAndData<T> | undefined {
  // Constructor<InstrumentPart> | undefined {
  for (const p of data.parts) {
    const partInst = partMap[p.partName] as T;
    if (partInst && f(partInst)) {
      return { part: partInst, data: p as PartType<T> };
    }
  }
  return undefined;
}

export function getPartTypeAndData<T extends InstrumentPartTyped<any>>(
  partType: Constructor<T>,
  data: InstrumentData
): PartTypeAndData<T> {
  // Constructor<InstrumentPart> | undefined {
  const part = partMap[partType.name] as T;
  if (!part) {
    console.error('Part type not found:', partType.name);
    return { part: undefined!, data: undefined! };
  }
  const partData = getPart(partType, data);
  return { part, data: partData! };
}
export function getPartType(name: string): InstrumentPart {
  // Constructor<InstrumentPart> | undefined {
  // return part.find((p) => p.part.name === name)?.part;
  return partMap[name];
}
export function makePartData<T extends InstrumentPartTyped<any>>(
  part: Constructor<T>,
  data?: Partial<Omit<PartType<T>, 'partName'>>
): InstrumentPartData {
  const partName = part.name;
  const partInstance = getPartType(partName);
  return { ...partInstance.createData(data), partName };
}

export const presets: Preset[] = [
  {
    name: 'Piano',
    instrument: PianoScale,
    parts: [makePartData(PartChords), makePartData(PartArpeggiator)]
  },
  { name: 'Drum', instrument: Drum, parts: [] },
  {
    name: 'Bass',
    instrument: PianoScale,
    parts: [
      makePartData(PartEffects, { reverb: 0.5 }),
      makePartData(MonoSequence, { notes: [1, 2, 3, undefined, 4, 5, 3, undefined] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 2 })
    ]
  }
];
class AppStore {
  updatePart<TPart extends InstrumentPartData>(
    instrumentIndex: number,
    partIndex: number,
    partData: TPart
  ) {
    const instrument = this.instrumentsData.instrumentsData[instrumentIndex];
    if (!instrument) {
      console.error('Instrument not found', instrumentIndex);
      return;
    }
    const part = instrument.parts[partIndex];
    if (!part) {
      console.error('Part not found', partIndex);
      return;
    }
    // Update the part data
    Object.assign(part, partData);
    // Update the instrument
    this.setInstrument(instrumentIndex, instrument);
  }
  getPreset(name: string): Preset | undefined {
    const preset = presets.find((p) => p.name === name);
    return preset;
  }
  createInstrumentPreset(preset: Preset) {
    const { instrument, parts } = preset;
    this.instrumentsData.instrumentsData.push(createInstrument(instrument, parts, preset.name));
  }
  setInstrumentPart(selectedIndex: number, partIndex: number, p: InstrumentPartData): void {
    this.instrumentsData.instrumentsData[selectedIndex].parts.splice(partIndex, 1, p);
    this.setInstrument(selectedIndex, this.instrumentsData.instrumentsData[selectedIndex]);
  }
  randomize(index: number) {
    const instr = getInstrument(this.instrumentsData.instrumentsData[index]);
    if (instr) {
      const data = instr.randomize(this.instrumentsData.instrumentsData[index]);
      this.setInstrumentPartial(index, data);
    }
  }

  cycle() {
    console.log('cycle');
    const json = this.serialized();
    console.warn(json);
    this.instrumentsData.instrumentsData = JSON.parse(json) as InstrumentDataJsonValue[];
  }
  instrumentsData = $state({ instrumentsData: [] as InstrumentData[], volume: 0.8 });
  serialized(): string {
    return JSON.stringify(
      this.instrumentsData.instrumentsData,
      //.map((i) => this.serializeInstrumentData(i))
      null,
      2
    );
  }
  code = () => {
    return this.instrumentsData.instrumentsData
      .map((i) => {
        const instr = getInstrument(i);
        return instr ? `$: ${instr.generate(i)}` : '';
      })
      .join('\n').replace(/[\r\n]{2,}/g, '\n\n')
  };
  status(): Status {
    // return Status.connected;
    return Status.disconnected;
  }
  id() {
    return selfId; // this.webrtcProvider.doc.clientID;
  }
  host: boolean = false;
  peerJoined(peerId: string) {
    console.log('peer joined', peerId);
    // TODO PARTS
    if (this.host) this.sendState(this.instrumentsData.instrumentsData, peerId);
  }
  peerLeft(peerId: string) {
    console.log('peer left', peerId);
  }

  sendState: ActionSender<InstrumentDataJsonValue[]>;
  sendInstrument: ActionSender<WrappedInstrument>;

  // deserializeInstrumentData(data: InstrumentDataJsonValue): InstrumentData {
  //   let res: InstrumentData = {...data, parts: data.parts.map(part => {
  //       const type = getPartType(part.name);
  //       if (!type) {
  //         console.error('Unknown instrument part type', data.parts);
  //         return undefined!; // Fallback to original data
  //       }
  //       let newPart = new type(data);
  //       console.log('deserializeInstrumentData', part, newPart);
  //       // newPart.assign(part as InstrumentPart);
  //       return newPart;
  //   }).filter(x => x)};
  //   // console.log('deserializeInstrumentData', data, res);
  //   return res;

  // }
  // serializeInstrumentData(dataOrReactive: InstrumentData): InstrumentDataJsonValue {
  //   const data = $state.snapshot(dataOrReactive) as InstrumentData;
  //   console.log('serializeInstrumentData', data);
  //   return {
  //     ...data,
  //     parts: data.parts.map((part, index) => {return {...dataOrReactive.parts[index].serialize(), name: dataOrReactive.parts[index].constructor.name}})
  //   };
  // }
  isReceiving = false;

  constructor(host: boolean, roomId:string) {

    this.init(host, roomId);

    const [sendState, onReceiveState] = room.makeAction<InstrumentDataJsonValue[]>('state');
    const [sendInstrument, onReceiveInstrument] = room.makeAction<WrappedInstrument>('instrument');
    this.sendState = sendState;
    this.sendInstrument = sendInstrument;


    room.onPeerJoin((peerId) => this.peerJoined(peerId));
    room.onPeerLeave((peerId) => this.peerLeft(peerId));

    onReceiveState((data, peerId) => {
      if (this.host) return;
      console.log('receiveState', data, peerId);
      this.instrumentsData.instrumentsData = data;
    });
    onReceiveInstrument((data, peerId) => {
      console.log('receiveInstrument', data, peerId);
      this.isReceiving = true;
      try {
        this.instrumentsData.instrumentsData.splice(data.index, 1, data.instrument);
      } catch (error) {
        this.isReceiving = false;
      }
    });
  }
  private init(host: boolean, roomId: string) {
    this.host = host;

    room = VITEST
      ? ({
          makeAction: () => [() => {}, () => {}],
          onPeerJoin: () => {},
          onPeerLeave: () => {}
        } as any as Room)
      : joinRoom(config, roomId);

    if (this.instrumentsData.instrumentsData.length === 0) this.preset();
  }
  preset() {
    this.createInstrumentPreset(this.getPreset('Piano')!);
    this.createInstrumentPreset(this.getPreset('Bass')!);
    this.createInstrumentPreset(this.getPreset('Drum')!);
  }
  createInstrument<T extends Instrument>(name: Constructor<T>) {
    this.instrumentsData.instrumentsData.push(
      createInstrument(
        name
        //  notes: [1, 2, 3,undefined,4,5,3,undefined]
      )
    );
    return this.instrumentsData.instrumentsData[this.instrumentsData.instrumentsData.length - 1];
  }
  setInstrument(index: number, data: InstrumentData) {
    // console.log('setInstrument', index, data);
    const snapshot = data;
    this.instrumentsData.instrumentsData.splice(index, 1, snapshot);
    if (!this.isReceiving) this.sendInstrument({ index, instrument: snapshot });
  }
  // TODO send
  setInstrumentPartial = (index: number, data: Partial<InstrumentData>) => {
    this.instrumentsData.instrumentsData[index] = {
      ...this.instrumentsData.instrumentsData[index],
      ...data
    };
    console.log('setInstrumentPartial', index, data, $state.snapshot(this.instrumentsData));
  };
  removeInstrument(index: number): any {
    this.instrumentsData.instrumentsData.splice(index, 1);
  }
}

export let store: AppStore = undefined!;
export function initStore(host: boolean, roomId: string) {
  if (store) {
    console.warn('Store already initialized');
    return store;
  }
  store = new AppStore(host, roomId);
}
const instrumentMap: { [key: string]: Instrument } = {
  PianoScale: new PianoScale(),
  Drum: new Drum()
};
export function getInstrumentIcon(name: string): Component {
  switch (name) {
    case 'PianoScale':
      return KeyboardMusic;
    case 'Drum':
      return DrumIcon;
    default:
      return Music;
  }
}
export function getInstrument(data: InstrumentData): Instrument | undefined {
  if (!data) return undefined;
  const instr = instrumentMap[data.instrumentName];
  if (instr) {
    return instr as Instrument;
  } else {
    console.error('Instrument not found', data);
    return undefined;
    // throw new Error(`Instrument ${name} not found`);
  }
}
export function createInstrument<TInstr extends Instrument>(
  n: Constructor<TInstr>,
  d?: InstrumentPartData[],
  name?: string
): InstrumentData {
  console.log('createInstrument', n, d);
  var instr = instrumentMap[n.name];
  var baseData = instr.createData(name);
  if (d) {
    d.forEach((t, index) => {
      let existingPart = baseData.parts.find((p) => p.partName === t.partName);
      if (existingPart) {
        // Update existing part
        Object.assign(existingPart, t);
      } else {
        // Add new part
        baseData.parts.push(t);
      }
    });
    // baseData.parts
    // var data = { ...baseData, ...d };
    // return data;
  }
  // else
  // console.warn($state.snapshot(baseData));

  return baseData;
}
