import type { Command } from './commands';
import type { InstrumentData } from './instruments';
import type { ActionSender, Room } from './netRoom';
import { hasNotes, isSlot, liveSlot, MAX_PATTERNS } from './patterns';

/** What a device tells the others about its cues: the slot it has open, by instrument id. */
type CueMap = Record<string, number>;

/** How a pattern slot shows (`data-state` on the chips and the launcher's cells). */
export type SlotState = 'live' | 'cue' | 'queued' | 'other' | 'stopped' | 'empty';

/** How long before the next bar a queued launch is sent, so it reaches the other devices in time. */
export const LAUNCH_LEAD_S = 0.15;
const MAX_CUES = 64;

export interface CueClock {
  playing: boolean;
  /** The song position, in cycles (one cycle is one bar). */
  position(): number;
  /** Cycles per second. */
  cps(): number;
}

/**
 * This device's side of patterns: which slot of each instrument is open here, whether this device plays
 * it (a cue: heard here only, in place of the live one) or the live one, launches waiting for the next
 * bar, and the cues the other devices announce. None of this is song state: it is never in a command.
 */
export class PatternCues {
  /** The slot open here, by instrument id (absent: the live one). */
  open = $state<Record<string, number>>({});
  /** Instruments whose cue this device mutes, to hear the live pattern while editing another. */
  hearLive = $state<Record<string, boolean>>({});
  /** Launches waiting for the next bar: the slot, by instrument id. */
  queued = $state<Record<string, number>>({});
  /** Other devices' cues: by peer id, then instrument id. */
  remote = $state<Record<string, CueMap>>({});

  private send: ActionSender<CueMap>;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    room: Room,
    private dispatch: (cmd: Command) => void,
    private clock: CueClock,
    private find: (instrumentId: string) => InstrumentData | undefined
  ) {
    const [send, receive] = room.makeAction<CueMap>('cue');
    this.send = send;
    receive((map, peerId) => {
      if (typeof map !== 'object' || map === null || Array.isArray(map)) return;
      const entries = Object.entries(map)
        .filter(([id, slot]) => typeof id === 'string' && id.length <= 128 && isSlot(slot))
        .slice(0, MAX_CUES);
      this.remote[peerId] = Object.fromEntries(entries);
    });
  }

  /** The slot open here for an instrument (the live one unless another was picked and still exists). */
  slot(data: InstrumentData): number {
    const s = this.open[data.id];
    return isSlot(s) ? s : liveSlot(data);
  }
  /** Whether this device has a slot open that is not live. */
  isCue(data: InstrumentData): boolean {
    return this.slot(data) !== liveSlot(data);
  }
  /** The slot this device plays for the instrument (its cue unless it chose to hear the live one). */
  heard(data: InstrumentData): number {
    return this.isCue(data) && !this.hearLive[data.id] ? this.slot(data) : liveSlot(data);
  }
  /**
   * Open a slot here (to edit it; heard here when it is not the live one). Opening the live slot follows
   * the live pattern from then on, wherever launches take it.
   */
  pick(data: InstrumentData, slot: number) {
    if (!isSlot(slot)) return;
    if (slot === liveSlot(data)) delete this.open[data.id];
    else this.open[data.id] = slot;
    this.hearLive[data.id] = false;
    this.announce();
  }
  setHearLive(data: InstrumentData, value: boolean) {
    this.hearLive[data.id] = value;
    this.announce();
  }

  /**
   * Instruments this device is playing live (an input view set to "Live"): their pattern is left out
   * here, so what is played is not heard twice. The others hear the pattern as always.
   */
  playingHere = $state<Record<string, boolean>>({});
  setPlayingHere(instrumentId: string, on: boolean) {
    if (!!this.playingHere[instrumentId] === on) return;
    if (on) this.playingHere[instrumentId] = true;
    else delete this.playingHere[instrumentId];
  }

  /** Make a slot live for everyone at the next bar (right away when stopped). */
  launch(data: InstrumentData, slot: number) {
    if (!isSlot(slot) || slot === liveSlot(data)) return;
    if (!this.clock.playing) {
      this.go(data.id, slot);
      return;
    }
    this.queued[data.id] = slot;
    this.timer ??= setInterval(() => this.tick(), 20);
    this.tick();
  }
  cancelLaunch(data: InstrumentData) {
    delete this.queued[data.id];
  }
  /** Send the launches due: close enough to the next bar, or the song stopped. */
  tick() {
    const ids = Object.keys(this.queued);
    if (ids.length === 0) {
      clearInterval(this.timer);
      this.timer = undefined;
      return;
    }
    const pos = this.clock.position();
    const toBar = (Math.floor(pos) + 1 - pos) / Math.max(this.clock.cps(), 1e-3);
    if (this.clock.playing && toBar > LAUNCH_LEAD_S) return;
    for (const id of ids) {
      const slot = this.queued[id];
      delete this.queued[id];
      if (this.find(id)) this.go(id, slot);
    }
  }
  /** Launch now; this device then follows the live pattern (the one it just launched). */
  private go(instrumentId: string, slot: number) {
    this.dispatch({ type: 'setLivePattern', instrumentId, pattern: slot });
    if (this.open[instrumentId] === slot) delete this.open[instrumentId];
    this.announce();
  }

  /** A slot went live: if it is the one open here, this device follows the live pattern again. */
  followed(instrumentId: string, slot: number) {
    if (this.open[instrumentId] !== slot) return;
    delete this.open[instrumentId];
    this.announce();
  }

  /**
   * How a slot shows (the chips and the launcher's cells agree through this): live, launched for the
   * next bar, cued here, cued by someone else, holding notes but not playing, or empty.
   */
  state(data: InstrumentData, slot: number): SlotState {
    if (slot === liveSlot(data)) return 'live';
    if (slot === this.queued[data.id]) return 'queued';
    if (slot === this.slot(data)) return 'cue';
    if (this.othersOn(data).some((c) => c.slot === slot)) return 'other';
    return hasNotes(data, slot) ? 'stopped' : 'empty';
  }

  // A column (a scene): the same slot of every instrument. Instruments whose slot holds no notes are
  // left as they are, so a column plays what it shows and the other tracks carry on.

  /** The instruments a column plays: those with notes in that slot (the live one counts). */
  private inColumn(instruments: InstrumentData[], slot: number): InstrumentData[] {
    return isSlot(slot) ? instruments.filter((data) => hasNotes(data, slot)) : [];
  }
  /** Launch a column for everyone at the next bar: every instrument with notes in it, together. */
  launchColumn(instruments: InstrumentData[], slot: number) {
    for (const data of this.inColumn(instruments, slot)) this.launch(data, slot);
  }
  cancelColumn(instruments: InstrumentData[], slot: number) {
    for (const data of instruments) if (this.queued[data.id] === slot) this.cancelLaunch(data);
  }
  /** Hear a column on this device only: its slots are opened as cues, the other tracks play live. */
  cueColumn(instruments: InstrumentData[], slot: number) {
    if (!isSlot(slot)) return;
    for (const data of instruments) this.pick(data, hasNotes(data, slot) ? slot : liveSlot(data));
  }
  /** Back to the live patterns everywhere on this device. */
  uncueAll(instruments: InstrumentData[]) {
    for (const data of instruments)
      if (this.open[data.id] !== undefined) this.pick(data, liveSlot(data));
  }
  /** Whether this device is hearing the column: each of its slots that is not live is cued and heard here. */
  columnCued(instruments: InstrumentData[], slot: number): boolean {
    const cued = this.inColumn(instruments, slot).filter((d) => slot !== liveSlot(d));
    return cued.length > 0 && cued.every((d) => this.heard(d) === slot);
  }
  /** Whether a launch of the column is waiting for the bar. */
  columnQueued(instruments: InstrumentData[], slot: number): boolean {
    return instruments.some((d) => this.queued[d.id] === slot);
  }

  /** Who else has a cue open on an instrument: slot by peer id. */
  othersOn(data: InstrumentData): { peerId: string; slot: number }[] {
    return Object.entries(this.remote)
      .map(([peerId, map]) => ({ peerId, slot: map[data.id] }))
      .filter((c) => isSlot(c.slot) && c.slot !== liveSlot(data) && c.slot < MAX_PATTERNS);
  }
  /** The cues this device plays, for the others to show. */
  private mine(): CueMap {
    const map: CueMap = {};
    for (const [id, slot] of Object.entries(this.open)) {
      const data = this.find(id);
      if (data && isSlot(slot) && slot !== liveSlot(data) && !this.hearLive[id]) map[id] = slot;
    }
    return map;
  }
  announce(peerId?: string) {
    void this.send(this.mine(), peerId);
  }
  peerLeft(peerId: string) {
    delete this.remote[peerId];
  }
}
