import { Status } from './interfaces';
import { joinRoom, type JoinRoomConfig } from 'trystero';
import { joinRoom as joinRoomMqtt } from '@trystero-p2p/mqtt';
import { adaptRoom, type ActionSender, type Room } from './netRoom';
import type { JsonValue } from 'trystero';
import {
  getPart,
  newId,
  type Constructor,
  type Instrument,
  type InstrumentData,
  type InstrumentDataJsonValue,
  TrackState
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
  PartVoice,
  PartChords,
  PartArpeggiator,
  PartTrackNotes,
  type InstrumentPartData,
  InstrumentPartTyped,
  type PartType
} from './parts.svelte';
import { VITEST, strudel } from './strudel';
import { Transport, type PlayerLike } from './transport.svelte';
import type { IceServer } from './turn';
import { Calibration, type Acoustics } from './calibration/calibration.svelte';
import { WebAcoustics } from './calibration/webAcoustics';
import { applySongCommand, isSongCommand, type Command, type SongCommand } from './commands';

export const mixerIndex = -1;

/** Which instruments make sound: any soloed ones alone, otherwise everything that is not muted. */
export function audibleInstruments(all: InstrumentData[]): InstrumentData[] {
  const soloed = all.filter((i) => i.state === TrackState.Solo);
  return soloed.length > 0 ? soloed : all.filter((i) => i.state !== TrackState.Muted);
}

if (VITEST) {
}

/**
 * Optional TURN relay, set at build time (VITE_TURN_URLS comma-separated, VITE_TURN_USERNAME,
 * VITE_TURN_CREDENTIAL). Needed when peers cannot reach each other directly (mobile data, strict NATs,
 * isolated Wi-Fi): media and data then flow through the relay. STUN servers are already built in.
 * These values end up in the public bundle, so use a relay's browser-side credentials, not an admin key.
 */
const turnUrls = import.meta.env?.VITE_TURN_URLS?.split(',').filter(Boolean) ?? [];
const turnConfig = turnUrls.length
  ? [
      {
        urls: turnUrls,
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_CREDENTIAL
      }
    ]
  : undefined;

const config: JoinRoomConfig = { appId: 'taliesin', turnConfig };

/** `ordered`: sent by the host, which is the single sequencer of instrument commands. */
/** `from`: the peer that made the edit, stamped by the host when it rebroadcasts (only used to show who is editing). */
type WireCommand = { cmd: Command; ordered: boolean; from?: string };

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
  { partName: PartVoice.name, part: PartVoice },
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
      makePartData(PartVoice, { sound: 'square' }),
      makePartData(PartEffects, { reverb: 0.5 }),
      makePartData(MonoSequence, { notes: [1, 2, 3, undefined, 4, 5, 3, undefined] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 2 })
    ]
  },
  {
    name: 'Pad',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'gm_pad_warm' }),
      makePartData(PartChords, { enabled: true }),
      makePartData(PartEffects, { reverb: 0.6 }),
      makePartData(MonoSequence, { notes: [1, undefined, undefined, undefined, 4, undefined, undefined, undefined] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 3 })
    ]
  },
  {
    name: 'Lead',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'gm_lead_2_sawtooth' }),
      makePartData(PartEffects, { reverb: 0.3, delay: 0.3 }),
      makePartData(MonoSequence, { notes: [5, 6, 5, undefined, 3, undefined, 2, 3] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 5 })
    ]
  },
  {
    name: 'Marimba',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'gm_marimba' }),
      makePartData(PartEffects, { reverb: 0.3 }),
      makePartData(MonoSequence, { notes: [1, 3, 5, 3, 1, 3, 5, 6] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 4 })
    ]
  },
  {
    name: 'Filter Bass',
    instrument: PianoScale,
    parts: [
      makePartData(PartFilter, { freq: 400 }),
      makePartData(PartEffects, { reverb: 0.2 }),
      makePartData(MonoSequence, { notes: [1, undefined, 1, 3, 1, undefined, 5, 4] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 2 })
    ]
  }
];
export class AppStore {
  private room: Room = undefined!;
  /** Host-authoritative play/stop state; use this instead of calling strudel directly from the UI. */
  transport: Transport = undefined!;
  /** Acoustic latency calibration (host listens, guests play a probe). */
  calibration: Calibration = undefined!;
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
    const code = audibleInstruments(this.instrumentsData.instrumentsData)
      .map((i) => {
        const instr = getInstrument(i);
        return instr ? `$: ${instr.generate(i)}` : '';
      })
      .join('\n')
      .replace(/[\r\n]{2,}/g, '\n\n');
    // Strudel ignores an empty evaluation, which would leave the previous song playing
    return code.trim() === '' ? '$: silence' : code;
  };
  /**
   * When someone else last edited each instrument (by instrument id, ms since epoch). A view can
   * watch its entry to flash "someone just touched this". Your own edits never show up here.
   */
  activity = $state<Record<string, number>>({});
  private noteActivity(cmd: SongCommand) {
    const id =
      cmd.type === 'addInstrument'
        ? cmd.instrument?.id
        : 'instrumentId' in cmd
          ? cmd.instrumentId
          : undefined;
    if (typeof id === 'string' && id.length <= 128) this.activity[id] = Date.now();
  }
  /** Our own peer id (known once the room is joined). */
  selfPeerId = $state('');
  /** Ids of the peers currently connected to us. */
  peers = $state<string[]>([]);
  status(): Status {
    return this.peers.length > 0 ? Status.connected : Status.disconnected;
  }
  id() {
    return this.selfPeerId;
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
  /** The song `commandLog` starts from (set when the song is seeded or received in full). */
  logStart: InstrumentDataJsonValue[] = [];

  /** A bug report: the starting song and every command since, as JSON. Replay through `dispatch`. */
  exportLog(): string {
    return JSON.stringify(
      { start: this.logStart, volume: this.instrumentsData.volume, log: this.commandLog },
      null,
      1
    );
  }

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
    this.scheduleSave();
    this.emit(cmd, this.host, this.selfPeerId || undefined);
  };

  /** Where the host keeps the song between sessions (`localStorage`; none under test). */
  private storage?: Pick<Storage, 'getItem' | 'setItem'>;
  private storageKey = '';
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  /** Host: write the song soon (debounced). Clients get it from the host, so they don't save. */
  private scheduleSave() {
    if (!this.host || !this.storage) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveNow(), 500);
  }
  saveNow() {
    clearTimeout(this.saveTimer);
    if (!this.host || !this.storage) return;
    try {
      this.storage.setItem(
        this.storageKey,
        JSON.stringify({
          instruments: this.snapshotInstruments(),
          volume: this.instrumentsData.volume
        })
      );
    } catch (e) {
      console.warn('could not save the song', e); // storage full or blocked: the jam goes on
    }
  }
  /** Replace the song with the saved one, if any. Goes through the reducer, so bad data is dropped. */
  private restore(): boolean {
    try {
      const saved = JSON.parse(this.storage?.getItem(this.storageKey) ?? 'null');
      if (!Array.isArray(saved?.instruments)) return false;
      for (const instrument of saved.instruments)
        this.applyCommand({ type: 'addInstrument', instrument });
      if (typeof saved.volume === 'number')
        this.applyCommand({ type: 'setMasterVolume', volume: saved.volume });
      return this.instrumentsData.instrumentsData.length > 0;
    } catch {
      return false; // corrupt: start from the presets
    }
  }

  /**
   * Minimum gap between network sends of the same slider-like command. While one is waiting, newer
   * commands for the same target are merged into it (last value wins). Local state is never delayed.
   * 0 sends everything immediately: the default under unit tests and in automated browsers
   * (`navigator.webdriver`, e.g. the Playwright e2e run); only a real UI session throttles.
   */
  throttleMs = VITEST || (typeof navigator !== 'undefined' && navigator.webdriver) ? 0 : 50;
  private pending = new Map<string, { cmd: SongCommand; from?: string }>();
  private pendingTimer: ReturnType<typeof setTimeout> | undefined;

  /** Commands that stream while a control is dragged, keyed by what they overwrite. */
  private static coalesceKey(cmd: SongCommand): string | undefined {
    switch (cmd.type) {
      case 'setPartFields':
        return `p:${cmd.instrumentId}:${cmd.partName}`;
      case 'setInstrumentFields':
        return `i:${cmd.instrumentId}`;
      case 'setMasterVolume':
        return 'm';
    }
  }

  /** Send a song command, throttling streaming ones. Order between different commands is preserved. */
  private emit(cmd: SongCommand, ordered: boolean, from?: string) {
    const key = this.throttleMs > 0 ? AppStore.coalesceKey(cmd) : undefined;
    if (key === undefined) {
      this.flushPending();
      this.sendCommand({ cmd, ordered, ...(ordered && from ? { from } : {}) });
      return;
    }
    const waiting = this.pending.get(key)?.cmd;
    if (waiting && 'fields' in waiting && 'fields' in cmd) {
      this.pending.set(key, {
        cmd: { ...cmd, fields: { ...waiting.fields, ...cmd.fields } } as SongCommand,
        from
      });
    } else {
      this.pending.set(key, { cmd, from });
    }
    this.pendingTimer ??= setTimeout(() => this.flushPending(), this.throttleMs);
  }
  /** Send whatever is waiting now (in the order it first started waiting). */
  flushPending() {
    clearTimeout(this.pendingTimer);
    this.pendingTimer = undefined;
    const batch = [...this.pending.values()];
    this.pending.clear();
    for (const { cmd, from } of batch)
      this.sendCommand({ cmd, ordered: this.host, ...(this.host && from ? { from } : {}) });
  }
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
  constructor(
    host: boolean,
    roomId: string,
    room?: Room,
    player: PlayerLike = strudel,
    storage?: Pick<Storage, 'getItem' | 'setItem'>,
    acoustics?: () => Acoustics
  ) {
    this.storage = storage;
    this.storageKey = `taliesin:song:${roomId}`;
    const { room: r } = this.init(host, roomId, room);
    this.room = r;
    this.transport = new Transport(this.room, host, player);
    let web: WebAcoustics | undefined;
    this.calibration = new Calibration(
      this.room,
      host,
      acoustics ?? (() => (web ??= new WebAcoustics(strudel.audioContext()))),
      this.transport
    );

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
    onReceiveCommand((msg, peerId) => {
      if (!isSongCommand(msg?.cmd)) return;
      if (this.host ? msg.ordered : !msg.ordered) return;
      if (!this.applyCommand(msg.cmd)) return;
      this.commandLog.push({ cmd: msg.cmd, origin: 'remote' });
      // the host knows who sent it; a client is told by the host (and ignores its own edits coming back)
      const from = this.host ? peerId : typeof msg.from === 'string' ? msg.from : undefined;
      if (from && from !== this.selfPeerId && this.selfPeerId !== '') this.noteActivity(msg.cmd);
      if (this.host) {
        this.scheduleSave();
        this.emit(msg.cmd, true, peerId);
      }
    });

    this.room.onPeerJoin((peerId) => this.peerJoined(peerId));
    this.room.onPeerLeave((peerId) => this.peerLeft(peerId));

    // Full state: sent by the host when a peer connects (and by cycle()). Everything after that is commands.
    onReceiveState((data, peerId) => {
      console.log('receiveState', data, peerId);
      if (!Array.isArray(data)) return;
      this.instrumentsData.instrumentsData = data.map((i) => ({ ...i, id: i.id ?? newId() }));
      this.commandLog = [];
      this.logStart = this.snapshotInstruments();
    });
  }
  private init(host: boolean, roomId: string, room?: Room) {
    this.host = host;

    const r = room ?? adaptRoom(joinRoom(config, roomId));
    void r.selfId?.().then((id) => (this.selfPeerId = id));

    if (host && this.restore()) console.log('restored the saved song');
    if (this.instrumentsData.instrumentsData.length === 0) this.seed();
    this.logStart = this.snapshotInstruments();
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

/** `localStorage`, or nothing where it is missing or blocked (private windows, tests). */
function safeLocalStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try {
    return VITEST ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}
export let store: AppStore = undefined!;
/**
 * @param opts.relayUrls override the signalling relays/brokers (e2e tests point this at a local relay).
 * @param opts.signal which public signalling network to use: Nostr relays (default) or MQTT brokers.
 */
export function initStore(
  host: boolean,
  roomId: string,
  opts: { relayUrls?: string[]; iceServers?: IceServer[]; signal?: 'nostr' | 'mqtt' } = {}
) {
  if (store) {
    console.warn('Store already initialized');
    return store;
  }
  const turn = [...(turnConfig ?? []), ...(opts.iceServers ?? [])];
  const room =
    opts.relayUrls || opts.iceServers?.length || opts.signal === 'mqtt'
      ? adaptRoom(
          (opts.signal === 'mqtt' ? joinRoomMqtt : joinRoom)(
            {
              ...config,
              ...(opts.relayUrls ? { relayConfig: { urls: opts.relayUrls } } : {}),
              turnConfig: turn.length ? turn : undefined
            },
            roomId
          )
        )
      : undefined;
  store = new AppStore(host, roomId, room, undefined, safeLocalStorage());
  // a change in the last half second must survive closing the tab
  globalThis.addEventListener?.('pagehide', () => store.saveNow());
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
