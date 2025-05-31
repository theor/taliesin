import { Status } from './interfaces';
import { joinRoom, type BaseRoomConfig, type RelayConfig } from 'trystero/nostr';
import {
  selfId,
  type ActionSender,
  type JsonValue,
} from 'trystero';
import type { Constructor, Instrument, InstrumentData, InstrumentDataJsonValue } from './instruments';
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
  PartTrackNotes
} from './parts.svelte';

export const mixerIndex = -1;

const config: BaseRoomConfig & RelayConfig = {
  appId: 'taliesin',

  turnConfig: [
    { urls: ['stun:stun.l.google.com:19302' ]},
  ]

  // relayUrls: ["wss://192.168.1.82:3334"]
};
const room = joinRoom(config, 'room1');

type WrappedInstrument = {
  index: number;
  instrument: InstrumentDataJsonValue;
};

type Preset = {
  name: string;
  instrument: Constructor<Instrument>;
  parts: InstrumentPart[];
};

export const parts: { part: Constructor<InstrumentPart> }[] = [
  { part: PartEffects },
  { part: PartFilter },
  { part: PartSteps },
  { part: PartChords },
  { part: PartArpeggiator },
  { part: MonoSequence },
  { part: PartOctave },
    { part: PartTrackNotes },
];
export function getPartType(name:string): Constructor<InstrumentPart> | undefined {
  return parts.find((p) => p.part.name === name)?.part;
}

export const presets: Preset[] = [
  { name: 'Piano', instrument: PianoScale, parts: [new PartChords(), new PartArpeggiator()] },
  { name: 'Drum', instrument: Drum, parts: [] },
  {
    name: 'Bass',
    instrument: PianoScale,
    parts: [
      new PartEffects({ reverb: 0.5 }),
      new MonoSequence({ notes: [1, 2, 3, undefined, 4, 5, 3, undefined] }),
      new PartSteps(8, 2, false),
      new PartOctave(2)
    ]
  }
];
class AppStore {
  getPreset(name: string): Preset | undefined {
    const preset = presets.find((p) => p.name === name);
    return preset;
  }
  createInstrumentPreset(preset: {
    name: string;
    instrument: Constructor<Instrument>;
    parts: InstrumentPart[];
  }) {
    const { instrument, parts } = preset;
    this.instrumentsData.instrumentsData.push(createInstrument(instrument, parts, preset.name));
  }
  setInstrumentPart(selectedIndex: number, partIndex: number, p: InstrumentPart): void {
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

  clearCommands() {
    // this.synchedStore.commands.splice(0, this.synchedStore.commands.length);
  }
  instrumentsData = $state({ instrumentsData: [] as InstrumentData[], volume: 0.8 });
  serialized(): string {
    return JSON.stringify(
      this.instrumentsData.instrumentsData.map((i) => this.serializeInstrumentData(i)),
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
      .join('\n');
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
    if (this.host)
      this.sendState(this.instrumentsData.instrumentsData.map(this.serializeInstrumentData), peerId);
  }
  peerLeft(peerId: string) {
    console.log('peer left', peerId);
  }

  sendState: ActionSender<InstrumentDataJsonValue[]>;
  sendInstrument: ActionSender<WrappedInstrument>;

  deserializeInstrumentData(data: InstrumentDataJsonValue): InstrumentData {
    let res: InstrumentData = {...data, parts: data.parts.map(part => {
        const type = getPartType(part.name);
        if (!type) {
          console.error('Unknown instrument part type', data.parts);
          return undefined!; // Fallback to original data
        }
        return new type(data);
    }).filter(x => x)};
    console.log('deserializeInstrumentData', data, res);
    return res;
    
  }
  serializeInstrumentData(data: InstrumentData): InstrumentDataJsonValue {
    console.log('serializeInstrumentData', data);
    
    return {
      ...data,
      parts: data.parts.map((part) => {return {...part.serialize(), name: part.constructor.name}})
    };
  }

  constructor() {
    const [sendState, onReceiveState] = room.makeAction<InstrumentDataJsonValue[]>('state');
    const [sendInstrument, onReceiveInstrument] = room.makeAction<WrappedInstrument>('instrument');
    this.sendState = sendState;
    this.sendInstrument = sendInstrument;
    onReceiveState((data, peerId) => {
      if (this.host) return;
      console.log('receiveState', data, peerId);
      this.instrumentsData.instrumentsData = data.map(this.deserializeInstrumentData);
    });
    onReceiveInstrument((data, peerId) => {
      console.log('receiveInstrument', data, peerId);
      this.instrumentsData.instrumentsData.splice(data.index, 1, this.deserializeInstrumentData(data.instrument));
    });
  }
  init(host: boolean) {
    this.host = host;
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
  }
  setInstrument(index: number, data: InstrumentData) {
    // console.log("setInstrument", index, data);
    const snapshot = data;
    this.instrumentsData.instrumentsData.splice(index, 1, snapshot);
    this.sendInstrument({ index, instrument: this.serializeInstrumentData(snapshot)});
  }
  setInstrumentPartial = (index: number, data: Partial<InstrumentData>) => {
    // this.instrumentsData[index] = Object.assign(this.instrumentsData[index], data);

    this.instrumentsData.instrumentsData[index] = {
      ...this.instrumentsData.instrumentsData[index],
      ...data
    };
    // this.synchedStore.instrumentsData = [...this.synchedStore.instrumentsData];
    console.log('setInstrumentPartial', index, data, $state.snapshot(this.instrumentsData));
  };
  removeInstrument(index: number): any {
    this.instrumentsData.instrumentsData.splice(index, 1);
  }
}

export const store = new AppStore();
room.onPeerJoin((peerId) => store.peerJoined(peerId));
room.onPeerLeave((peerId) => store.peerLeft(peerId));

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
  d?: InstrumentPart[],
  name?: string
): InstrumentData {
  console.log('createInstrument', n, d);
  var instr = instrumentMap[n.name];
  var baseData = instr.createData(name);
  if (d) {
    d.forEach((t, index) => {
      let existingPart = baseData.parts.find((p) => p instanceof t.constructor);
      if (existingPart) {
        // Update existing part
        existingPart.assign(t);
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
  console.warn($state.snapshot(baseData));

  return baseData;
}
