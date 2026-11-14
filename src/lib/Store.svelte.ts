import { Status } from './interfaces';
import { joinRoom, type BaseRoomConfig, type RelayConfig } from 'trystero/nostr';
import { selfId, type ActionSender, type JsonValue, type Room } from 'trystero';
import {
  getPart,
  newId,
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
import { VITEST, strudel } from './strudel';
import { Transport, type PlayerLike } from './transport.svelte';

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

type WrappedInstrument = {
  id: string;
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
export class AppStore {
  private room: Room = undefined!;
  /** Host-authoritative play/stop state; use this instead of calling strudel directly from the UI. */
  transport: Transport = undefined!;
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
    this.sendCreated(
      this.instrumentsData.instrumentsData[this.instrumentsData.instrumentsData.length - 1]
    );
  }
  /** An unknown id makes receivers append, so a creation is just an instrument update. */
  private sendCreated(created: InstrumentData) {
    // not wired yet while the constructor seeds the initial presets
    this.sendInstrument?.({ id: created.id, instrument: $state.snapshot(created) as InstrumentData });
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
    this.broadcastState();
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
  /** Ids of the peers currently connected to us. */
  peers = $state<string[]>([]);
  status(): Status {
    return this.peers.length > 0 ? Status.connected : Status.disconnected;
  }
  id() {
    return selfId; // this.webrtcProvider.doc.clientID;
  }
  host: boolean = false;
  peerJoined(peerId: string) {
    console.log('peer joined', peerId);
    if (!this.peers.includes(peerId)) this.peers.push(peerId);
    this.transport.peerJoined(peerId);
    // Both sides get onPeerJoin for each other, so the host always syncs a (re)connecting peer.
    if (this.host) this.sendState(this.snapshotInstruments(), peerId);
  }
  peerLeft(peerId: string) {
    console.log('peer left', peerId);
    this.peers = this.peers.filter((p) => p !== peerId);
  }

  private snapshotInstruments(): InstrumentDataJsonValue[] {
    return $state.snapshot(this.instrumentsData.instrumentsData) as InstrumentDataJsonValue[];
  }
  /**
   * Send the full instrument list to everyone. Used for structural changes (add / remove / reorder),
   * where per-instrument updates can't express the change. Last write wins.
   */
  private broadcastState() {
    // not wired yet while the constructor seeds the initial presets
    this.sendState?.(this.snapshotInstruments());
  }
  private findIndexById(id: string): number {
    return this.instrumentsData.instrumentsData.findIndex((i) => i.id === id);
  }

  sendState: ActionSender<InstrumentDataJsonValue[]>;
  sendInstrument: ActionSender<WrappedInstrument>;
  sendRemove: ActionSender<{ id: string }>;

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
  /**
   * @param room optional pre-built room (tests inject a fake one); defaults to a real Trystero room.
   * @param player optional audio player (tests inject a fake one); defaults to the Strudel singleton.
   */
  constructor(host: boolean, roomId: string, room?: Room, player: PlayerLike = strudel) {
    const { room: r } = this.init(host, roomId, room);
    this.room = r;
    this.transport = new Transport(this.room, host, player);

    const [sendState, onReceiveState] = this.room.makeAction<InstrumentDataJsonValue[]>('state');
    const [sendInstrument, onReceiveInstrument] =
      this.room.makeAction<WrappedInstrument>('instrument');
    const [sendRemove, onReceiveRemove] = this.room.makeAction<{ id: string }>('remove');
    this.sendState = sendState;
    this.sendInstrument = sendInstrument;
    this.sendRemove = sendRemove;
    onReceiveRemove((data) => {
      const index = data?.id ? this.findIndexById(data.id) : -1;
      if (index >= 0) this.instrumentsData.instrumentsData.splice(index, 1);
    });

    this.room.onPeerJoin((peerId) => this.peerJoined(peerId));
    this.room.onPeerLeave((peerId) => this.peerLeft(peerId));

    onReceiveState((data, peerId) => {
      console.log('receiveState', data, peerId);
      if (!Array.isArray(data)) return;
      // Applied directly to the state: never go through the setters, which would echo it back.
      this.instrumentsData.instrumentsData = data.map((i) => ({ ...i, id: i.id ?? newId() }));
    });
    onReceiveInstrument((data, peerId) => {
      console.log('receiveInstrument', data, peerId);
      if (!data?.instrument || !data.id) return;
      const index = this.findIndexById(data.id);
      const instrument = { ...data.instrument, id: data.id };
      if (index >= 0) this.instrumentsData.instrumentsData.splice(index, 1, instrument);
      else this.instrumentsData.instrumentsData.push(instrument);
    });
  }
  private init(host: boolean, roomId: string, room?: Room) {
    this.host = host;

    const r = room ?? joinRoom(config, roomId);

    if (this.instrumentsData.instrumentsData.length === 0) this.preset();
    return { room: r };
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
    const created =
      this.instrumentsData.instrumentsData[this.instrumentsData.instrumentsData.length - 1];
    this.sendCreated(created);
    return created;
  }
  setInstrument(index: number, data: InstrumentData) {
    // console.log('setInstrument', index, data);
    const snapshot = data;
    this.instrumentsData.instrumentsData.splice(index, 1, snapshot);
    this.sendInstrument({ id: snapshot.id, instrument: snapshot });
  }
  setInstrumentPartial = (index: number, data: Partial<InstrumentData>) => {
    this.instrumentsData.instrumentsData[index] = {
      ...this.instrumentsData.instrumentsData[index],
      ...data
    };
    const updated = $state.snapshot(this.instrumentsData.instrumentsData[index]) as InstrumentData;
    this.sendInstrument({ id: updated.id, instrument: updated });
  };
  removeInstrument(index: number): any {
    const removed = this.instrumentsData.instrumentsData.splice(index, 1)[0];
    if (removed) this.sendRemove({ id: removed.id });
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
