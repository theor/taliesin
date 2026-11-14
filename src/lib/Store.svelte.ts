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
import { applySongCommand, isSongCommand, type Command, type SongCommand } from './commands';

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

/** `ordered`: sent by the host, which is the single sequencer of instrument commands. */
type WireCommand = { cmd: Command; ordered: boolean };

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
  getPreset(name: string): Preset | undefined {
    const preset = presets.find((p) => p.name === name);
    return preset;
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
  sendState: ActionSender<InstrumentDataJsonValue[]>;
  sendCommand: ActionSender<WireCommand>;

  /** Every command applied here, in order: a recording that can be replayed through `dispatch`. */
  commandLog: { cmd: Command; origin: 'local' | 'remote' }[] = [];

  /**
   * The single entry point for UI intent. Song commands are applied locally right away (the UI feels
   * instant) and sent to the host, which orders them; transport commands go to the transport.
   */
  dispatch = (cmd: Command) => {
    this.commandLog.push({ cmd, origin: 'local' });
    if (cmd.type === 'transport') {
      if (cmd.action === 'toggle') void this.transport.toggle();
      else this.transport.stop();
      return;
    }
    if (!this.applyCommand(cmd)) return;
    this.sendCommand({ cmd, ordered: this.host });
  };
  private applyCommand(cmd: SongCommand): boolean {
    return applySongCommand(this.instrumentsData, cmd, {
      sequencerFor: (data) => getInstrument(data)?.sequencer,
      isKnownInstrument: (name) => name in instrumentMap
    });
  }

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
    // Command is JSON, but its union type is wider than Trystero's payload constraint allows
    const [sendCommand, onReceiveCommand] = this.room.makeAction<any>('cmd') as unknown as [
      ActionSender<WireCommand>,
      (cb: (msg: WireCommand, peerId: string) => void) => void
    ];
    this.sendState = sendState;
    this.sendCommand = sendCommand;

    // Host: takes unordered commands from clients, applies them and rebroadcasts them in the order it
    // received them (including back to the sender). Clients: only take the host's ordered stream, so a
    // peer-to-peer copy of someone else's command can never race the host's ordering.
    onReceiveCommand((msg) => {
      if (!isSongCommand(msg?.cmd)) return;
      if (this.host ? msg.ordered : !msg.ordered) return;
      if (!this.applyCommand(msg.cmd)) return;
      this.commandLog.push({ cmd: msg.cmd, origin: 'remote' });
      if (this.host) this.sendCommand({ cmd: msg.cmd, ordered: true });
    });

    this.room.onPeerJoin((peerId) => this.peerJoined(peerId));
    this.room.onPeerLeave((peerId) => this.peerLeft(peerId));

    // Full state: sent by the host when a peer connects (and by cycle()). Everything after that is commands.
    onReceiveState((data, peerId) => {
      console.log('receiveState', data, peerId);
      if (!Array.isArray(data)) return;
      this.instrumentsData.instrumentsData = data.map((i) => ({ ...i, id: i.id ?? newId() }));
    });
  }
  private init(host: boolean, roomId: string, room?: Room) {
    this.host = host;

    const r = room ?? joinRoom(config, roomId);

    if (this.instrumentsData.instrumentsData.length === 0) this.seed();
    return { room: r };
  }
  /** The initial song, built locally (peers get the host's version when they connect). */
  private seed() {
    for (const name of ['Piano', 'Bass', 'Drum']) {
      const { instrument, parts, name: presetName } = this.getPreset(name)!;
      this.instrumentsData.instrumentsData.push(createInstrument(instrument, parts, presetName));
    }
  }
}

export let store: AppStore = undefined!;
/** @param opts.relayUrls override the Nostr signalling relays (e2e tests point this at a local relay). */
export function initStore(host: boolean, roomId: string, opts: { relayUrls?: string[] } = {}) {
  if (store) {
    console.warn('Store already initialized');
    return store;
  }
  const room = opts.relayUrls ? joinRoom({ ...config, relayUrls: opts.relayUrls }, roomId) : undefined;
  store = new AppStore(host, roomId, room);
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
