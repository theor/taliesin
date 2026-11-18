import { Status } from './interfaces';
import { joinRoom, type JoinRoomConfig } from 'trystero';
import { joinRoom as joinRoomMqtt } from '@trystero-p2p/mqtt';
import { adaptRoom, type ActionSender, type Room } from './netRoom';
import type { JsonValue } from 'trystero';
import {
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
  DEFAULT_SCALE,
  getPartType,
  makePartData,
  MonoSequence,
  PartArpeggiator,
  PartChords,
  PartEffects,
  PartEnvelope,
  PartFilter,
  PartFm,
  PartOctave,
  PartSteps,
  PartVoice,
  type InstrumentPartData,
  type Scale
} from './parts.svelte';
import { VITEST, strudel } from './strudel';
import { Transport, type PlayerLike } from './transport.svelte';
import type { IceServer } from './turn';
import { Calibration, type Acoustics } from './calibration/calibration.svelte';
import { WebAcoustics } from './calibration/webAcoustics';
import {
  applySongCommand,
  isSongCommand,
  type Command,
  type Dispatch,
  type SongCommand
} from './commands';
import { PatternCues } from './cues.svelte';
import { liveSlot, patternDispatch, withPattern } from './patterns';

export const mixerIndex = -1;
/** The desktop's `selectedIndex` for the pattern launcher (`nav.svelte.ts`). */
export const patternsIndex = -2;
/** Most instruments a song received from the network can have. */
const MAX_INSTRUMENTS = 64;

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
/** The `'state'` message: the whole song (each part of it still goes through the reducer). */
type SongState = { instruments: InstrumentDataJsonValue[]; volume: number; scale: Scale };

type Preset = {
  name: string;
  instrument: Constructor<Instrument>;
  parts: InstrumentPartData[];
};

export const presets: Preset[] = [
  {
    name: 'Piano',
    instrument: PianoScale,
    parts: [
      makePartData(PartChords),
      makePartData(PartArpeggiator),
      makePartData(PartEnvelope, { attack: 0.005, decay: 0.6, sustain: 0.3, release: 0.3 })
    ]
  },
  { name: 'Drum', instrument: Drum, parts: [] },
  {
    name: 'Bass',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'square' }),
      makePartData(PartEnvelope, { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.1 }),
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
      makePartData(PartEnvelope, { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1 }),
      makePartData(PartChords, { enabled: true }),
      makePartData(PartEffects, { reverb: 0.6 }),
      makePartData(MonoSequence, {
        notes: [1, undefined, undefined, undefined, 4, undefined, undefined, undefined]
      }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 3 })
    ]
  },
  {
    name: 'Lead',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'gm_lead_2_sawtooth' }),
      makePartData(PartEnvelope, { attack: 0.01, decay: 0.2, sustain: 0.8, release: 0.3 }),
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
      makePartData(PartEnvelope, { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 }),
      makePartData(PartEffects, { reverb: 0.3 }),
      makePartData(MonoSequence, { notes: [1, 3, 5, 3, 1, 3, 5, 6] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 4 })
    ]
  },
  {
    name: 'FM Bell',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'sine' }),
      makePartData(PartFm, { index: 6, ratio: 3.5, decay: 0.8 }),
      makePartData(PartEnvelope, { attack: 0.005, decay: 1.2, sustain: 0, release: 0.8 }),
      makePartData(PartEffects, { reverb: 0.5 }),
      makePartData(MonoSequence, {
        notes: [1, undefined, 5, undefined, 3, undefined, 6, undefined]
      }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 5 })
    ]
  },
  {
    name: 'FM Bass',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'sine' }),
      makePartData(PartFm, { index: 3, ratio: 1, decay: 0.25 }),
      makePartData(PartEnvelope, { attack: 0.005, decay: 0.3, sustain: 0.5, release: 0.1 }),
      makePartData(MonoSequence, { notes: [1, undefined, 1, 3, 1, undefined, 5, 4] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 2 })
    ]
  },
  {
    name: 'Pluck',
    instrument: PianoScale,
    parts: [
      makePartData(PartVoice, { sound: 'gm_acoustic_guitar_nylon' }),
      makePartData(PartEnvelope, { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 }),
      makePartData(PartEffects, { reverb: 0.3 }),
      makePartData(MonoSequence, { notes: [1, 3, 5, 3, 2, 4, 6, 4] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2 }),
      makePartData(PartOctave, { octave: 4 })
    ]
  },
  {
    name: 'Filter Bass',
    instrument: PianoScale,
    parts: [
      makePartData(PartEnvelope, { attack: 0.005, decay: 0.25, sustain: 0.5, release: 0.1 }),
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
  instrumentsData = $state({
    instrumentsData: [] as InstrumentData[],
    volume: 0.8,
    scale: { ...DEFAULT_SCALE } as Scale
  });
  serialized(): string {
    return JSON.stringify(
      this.instrumentsData.instrumentsData,
      //.map((i) => this.serializeInstrumentData(i))
      null,
      2
    );
  }
  /** The key the song plays in (song state: changed with `setScale`, synced like everything else). */
  get scale(): Scale {
    return this.instrumentsData.scale;
  }
  /**
   * The song as Strudel code: every audible instrument's live pattern, or, with `heard`, the pattern
   * slot it gives for an instrument (this device's cues: `localCode`).
   */
  code = (heard?: (data: InstrumentData) => number) => {
    const code = audibleInstruments(this.instrumentsData.instrumentsData)
      .map((data) => {
        const i = heard ? patternFor(data, heard(data)) : data;
        const code = getInstrument(i)?.generate(i, this.scale);
        return code ? `$: ${code}` : ''; // an instrument with nothing to play is left out
      })
      .join('\n')
      .replace(/[\r\n]{2,}/g, '\n\n');
    // Strudel ignores an empty evaluation, which would leave the previous song playing
    return code.trim() === '' ? '$: silence' : code;
  };
  /** What this device plays: the song, with its own cues in place of those instruments' live patterns. */
  localCode = () => this.code((data) => this.cues.heard(data));
  /** This device's patterns: the slot open per instrument, cues, launches waiting for the next bar. */
  cues: PatternCues = undefined!;

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
    this.cues.announce(peerId);
    // Both sides get onPeerJoin for each other, so the host always syncs a (re)connecting peer.
    if (this.host) {
      this.sendState(this.snapshotSong(), peerId);
    }
  }
  /** Client: the peer we take the song and the command order from (the first to send us the song). */
  private hostPeerId = '';
  peerLeft(peerId: string) {
    console.log('peer left', peerId);
    if (peerId === this.hostPeerId) this.hostPeerId = ''; // a host that comes back has a new id
    this.peers = this.peers.filter((p) => p !== peerId);
    this.cues.peerLeft(peerId);
  }

  private snapshotInstruments(): InstrumentDataJsonValue[] {
    return $state.snapshot(this.instrumentsData.instrumentsData) as InstrumentDataJsonValue[];
  }
  /** The whole song, as the `'state'` message carries it. */
  private snapshotSong(): SongState {
    const { volume, scale } = this.instrumentsData;
    return { instruments: this.snapshotInstruments(), volume, scale: { ...scale } };
  }
  /**
   * Send the full instrument list to everyone. Used for structural changes (add / remove / reorder),
   * where per-instrument updates can't express the change. Last write wins.
   */
  private broadcastState() {
    // not wired yet while the constructor seeds the initial presets
    this.sendState?.(this.snapshotSong());
  }
  sendState: ActionSender<SongState>;
  sendCommand: ActionSender<WireCommand>;

  /** Every command applied here, in order: a recording that can be replayed through `dispatch`. */
  commandLog: { cmd: Command; origin: 'local' | 'remote' }[] = [];
  /** The song `commandLog` starts from (set when the song is seeded or received in full). */
  logStart: InstrumentDataJsonValue[] = [];

  /** A bug report: the starting song and every command since, as JSON. Replay through `dispatch`. */
  exportLog(): string {
    return JSON.stringify(
      {
        start: this.logStart,
        volume: this.instrumentsData.volume,
        scale: this.instrumentsData.scale,
        log: this.commandLog
      },
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
          volume: this.instrumentsData.volume,
          scale: this.instrumentsData.scale
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
      if (saved.scale) this.applyCommand({ type: 'setScale', ...saved.scale });
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
        return `p:${cmd.instrumentId}:${cmd.partName}:${cmd.pattern ?? ''}`; // one slot's notes never merge into another's
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
    const applied = this.applySong(cmd);
    // a slot open here that has just gone live (whoever launched it): follow the live one from now on
    if (applied && cmd.type === 'setLivePattern')
      this.cues?.followed(cmd.instrumentId, cmd.pattern);
    return applied;
  }
  private applySong(cmd: SongCommand): boolean {
    return applySongCommand(this.instrumentsData, cmd, {
      sequencerFor: (data) => getInstrument(data)?.sequencer,
      instrumentInput: (name) =>
        Object.hasOwn(instrumentMap, name) ? instrumentMap[name].input.id : undefined,
      partType: getPartType,
      canAddPart: (name, partName) =>
        Object.hasOwn(instrumentMap, name) &&
        instrumentMap[name].addableParts.some((p) => p.id === partName)
    });
  }

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
    const transport = this.transport;
    this.cues = new PatternCues(
      this.room,
      (cmd) => this.dispatch(cmd),
      {
        get playing() {
          return transport.playing;
        },
        position: () => transport.position(),
        cps: () => transport.cps()
      },
      (id) => this.instrumentsData.instrumentsData.find((i) => i.id === id)
    );
    let web: WebAcoustics | undefined;
    this.calibration = new Calibration(
      this.room,
      host,
      acoustics ?? (() => (web ??= new WebAcoustics(strudel.audioContext()))),
      this.transport
    );

    const [sendState, onReceiveState] = this.room.makeAction<SongState>('state');
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
      if (!this.host && peerId !== this.hostPeerId) return; // "ordered" by someone who is not our host
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
    // Only clients take it, only from their host, and only what the reducer accepts.
    onReceiveState((data: SongState | InstrumentDataJsonValue[], peerId) => {
      // older hosts send just the instrument list
      const song = Array.isArray(data) ? { instruments: data } : data;
      if (this.host || !Array.isArray(song?.instruments)) return;
      // the host sends the song first thing when we meet, so the first peer to send one is the host
      // (until it leaves); anyone else sending a whole song is ignored
      if (this.hostPeerId && peerId !== this.hostPeerId) return;
      this.hostPeerId = peerId;
      this.instrumentsData.instrumentsData = [];
      for (const instrument of song.instruments.slice(0, MAX_INSTRUMENTS)) {
        // instruments from older peers have no id yet
        const id = typeof instrument?.id === 'string' && instrument.id ? instrument.id : newId();
        this.applyCommand({ type: 'addInstrument', instrument: { ...instrument, id } as never });
      }
      if ('volume' in song) this.applyCommand({ type: 'setMasterVolume', volume: song.volume });
      if ('scale' in song) this.applyCommand({ type: 'setScale', ...song.scale });
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
/** An instrument with one of its pattern slots' notes (`withPattern`): an empty slot plays nothing. */
export function patternFor(data: InstrumentData, slot: number): InstrumentData {
  if (slot === liveSlot(data)) return data;
  const input = getInstrument(data)?.input;
  if (!input) return data;
  const type = getPartType(input.id)!;
  return withPattern(data, slot, input.id, () => type.createData());
}
/**
 * A slot's notes at a glance: `cells` cells (fewer for a shorter loop), each on when any step it covers
 * holds a note. For the launcher's clips.
 */
export function patternStrip(data: InstrumentData, slot: number, cells = 16): boolean[] {
  const i = patternFor(data, slot);
  const instr = getInstrument(i);
  const seq = instr?.sequencer;
  if (!instr || !seq) return [];
  const length = instr.getLength(i);
  const total = length.stepsPerMeasure * length.measures;
  const n = Math.min(total, cells);
  const per = total / Math.max(n, 1);
  return Array.from({ length: n }, (_, c) => {
    for (let step = Math.floor(c * per); step < Math.floor((c + 1) * per); step++)
      if (seq.tracks.some((_, track) => seq.getCell(i, track, step))) return true;
    return false;
  });
}

/**
 * What the edit views work on for the slot open on this device: the instrument with that slot's notes,
 * and a dispatch that addresses their note edits to it (`patternDispatch`), the live slot too: "the live
 * one" is not absolute, a launch can land before the edit does.
 */
export function patternEdit(
  data: InstrumentData,
  slot: number,
  dispatch: Dispatch
): { data: InstrumentData; dispatch: Dispatch } {
  const input = getInstrument(data)?.input;
  if (!input) return { data, dispatch };
  return {
    data: patternFor(data, slot),
    dispatch: patternDispatch(dispatch, data.id, slot, input.id)
  };
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
/** The instrument object of a kind (its class). */
export function instrumentOf(kind: Constructor<Instrument>): Instrument {
  const instr = Object.values(instrumentMap).find((i) => i instanceof kind);
  if (!instr) throw new Error(`Unknown instrument ${kind.name}`);
  return instr;
}
/** A new instrument of the given kind, with `parts` replacing (or added to) its default parts. */
export function createInstrument<TInstr extends Instrument>(
  kind: Constructor<TInstr>,
  parts?: InstrumentPartData[],
  name?: string
): InstrumentData {
  const data = instrumentOf(kind).createData(name);
  for (const part of parts ?? []) {
    const copy = structuredClone(part); // never share arrays with a preset (and keep rests `undefined`)
    const at = data.parts.findIndex((p) => p.partName === part.partName);
    if (at >= 0) data.parts[at] = { ...data.parts[at], ...copy };
    else data.parts.push(copy);
  }
  return data;
}
