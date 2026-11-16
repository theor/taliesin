import type { ActionSender, Room } from './netRoom';
import { get, type Readable } from 'svelte/store';

/** The slice of the Strudel wrapper the transport needs; tests inject a fake. */
export interface PlayerLike {
  isPlaying: Readable<boolean>;
  /** The scheduler's current cycle, read live (0 when stopped). The same quantity on every peer. */
  now(): number;
  /** Cycles per second. */
  cps: number;
  /** Audio output delay in seconds. */
  outputLatency: number;
  toggle(): Promise<void> | void;
  stop(): void;
  /**
   * Start playing at the cycle `target()` returns (called once the audio is allowed to run; undefined
   * cancels). Used by clients, which follow the host's clock.
   */
  start(target: () => number | undefined): Promise<void>;
  /** Jump the running scheduler by `delta` cycles. */
  shift(delta: number): void;
}

// `type`, not `interface`: Trystero's payload constraint needs an implicit index signature
export type TransportState = {
  playing: boolean;
  /** Host cycle position when the message was sent. */
  cycle: number;
  /** Cycles per second on the host. */
  cps: number;
  /** The host's audio output delay (seconds), so peers can line up what is *heard*. */
  out: number;
  /**
   * Strictly increasing per host (seeded from the host clock so a reloaded host still beats its earlier
   * session). Clients drop anything not newer than what they already applied: messages can overtake each
   * other, and a stale "playing" must not override a newer "stopped".
   */
  seq: number;
  /** The host's "only this device plays" setting: clients follow the playhead but stay silent. */
  hostOnly?: boolean;
};
export type TransportRequest = { action: 'toggle' | 'stop' };

/** How often the host re-announces its position while playing, to correct drift. */
const RESYNC_MS = 4000;
/** A client's playback is only corrected when it is this far off (seconds): smaller jumps are audible. */
const DRIFT_THRESHOLD_S = 0.04;
/** After a local start the scheduler needs a moment before its position can be compared. */
const SETTLE_MS = 400;
/** Host: when to re-announce the position after starting. */
const WARMUP_ANNOUNCE_MS = 600;
/** Ping samples kept: the smallest round trip is the least jittery estimate of the network delay. */
const PING_SAMPLES = 5;

/**
 * Host-authoritative play/stop state and playhead.
 * - host: owns the player; every change of `isPlaying` is broadcast, requests from clients are executed,
 *   and the position is re-announced periodically while playing.
 * - client: plays audio itself, following the host's clock. `playing` mirrors the host, toggle/stop become
 *   requests to the host, `position()` extrapolates from the last message, and the local scheduler is
 *   started at that position and nudged back whenever it drifts (see `reconcile`).
 *
 * Clients never compare wall clocks (they differ between machines). They use only their own elapsed time
 * since the message arrived, plus half the measured round-trip as an estimate of the network delay.
 * UI and key handlers should only call `toggle()` / `stop()` and read `playing` / `position()`.
 */
export class Transport {
  playing = $state(false);
  /**
   * When true, only the host makes sound. Clients still mirror play/stop and the playhead, but never start
   * their own scheduler. The host sets it (and tells everybody); clients just follow.
   */
  hostOnly = $state(false);
  /** Host: choose whether everyone plays the song, or only this device. */
  setHostOnly(value: boolean) {
    if (!this.host || this.hostOnly === value) return;
    this.hostOnly = value;
    this.broadcast();
  }
  /** Last state received from the host (clients only). */
  last = $state<TransportState | undefined>(undefined);

  private sendState: ActionSender<TransportState>;
  private sendRequest: ActionSender<TransportRequest>;
  private receivedAt = 0; // local monotonic ms when `last` arrived
  private latencyMs = 0; // estimated one-way delay host -> us
  private rtts: number[] = [];
  private starting = false;
  private hostId = '';
  private settleTimer: ReturnType<typeof setTimeout> | undefined;
  private resync: ReturnType<typeof setInterval> | undefined;
  private seq = 0; // host: last sequence number sent
  private appliedSeq = -Infinity; // client: newest sequence number applied

  constructor(
    private room: Room,
    private host: boolean,
    private player: PlayerLike,
    private now: () => number = () => performance.now()
  ) {
    const [sendState, onState] = room.makeAction<TransportState>('transport');
    const [sendRequest, onRequest] = room.makeAction<TransportRequest>('transportReq');
    this.sendState = sendState;
    this.sendRequest = sendRequest;

    if (host) {
      let first = true;
      player.isPlaying.subscribe((playing) => {
        this.playing = playing;
        // the initial value is just the subscription firing; nobody needs to hear it
        if (first) first = false;
        else this.broadcast();
        this.updateResync();
      });
      onRequest((req) => {
        if (req?.action === 'toggle') void this.player.toggle();
        else if (req?.action === 'stop') this.player.stop();
      });
    } else {
      onState((state, peerId) => {
        if (typeof state?.playing !== 'boolean' || typeof state.seq !== 'number') return;
        if (state.seq <= this.appliedSeq) return; // stale or duplicate
        this.appliedSeq = state.seq;
        this.hostId = peerId;
        this.playing = state.playing;
        this.hostOnly = state.hostOnly === true;
        this.last = state;
        this.receivedAt = this.now();
        // measure first, so even the first start uses a real latency estimate
        void this.measureLatency(peerId).then(() => this.reconcile(true));
      });
    }
  }

  private updateResync() {
    if (this.playing && !this.resync) {
      this.resync = setInterval(() => this.broadcast(), RESYNC_MS);
      // The announcement made at the moment of starting precedes the scheduler's first tick, so its
      // position is only approximate: send an accurate one as soon as the scheduler has warmed up.
      setTimeout(() => this.playing && this.broadcast(), WARMUP_ANNOUNCE_MS);
    } else if (!this.playing && this.resync) {
      clearInterval(this.resync);
      this.resync = undefined;
    }
  }
  private async measureLatency(hostPeerId: string) {
    try {
      const rtt = await this.room.ping(hostPeerId);
      if (Number.isFinite(rtt) && rtt >= 0) {
        this.rtts = [...this.rtts, rtt].slice(-PING_SAMPLES);
        this.latencyMs = Math.min(...this.rtts) / 2;
      }
    } catch {
      // keep the previous estimate
    }
  }

  /**
   * Client: measured offset (seconds) of how much later than the host this device sounds, from an acoustic
   * calibration. It replaces the browser's reported output latency, which is often missing or wrong.
   */
  offset = $state<number | undefined>(undefined);

  /** Where the local scheduler should be: the host's position, shifted by the output-latency difference. */
  private target(): number | undefined {
    const last = this.last;
    if (!last?.playing) return undefined;
    const shift = this.offset ?? this.player.outputLatency - (last.out ?? 0);
    return this.position() + shift * last.cps;
  }

  /** Client: apply (or with undefined, drop) a measured offset, correcting playback right away. */
  setOffset(seconds: number | undefined) {
    this.offset = seconds;
    this.correct(0);
  }

  /** Client: re-measure the network delay to the host (smallest of the recent round trips), in seconds. */
  async refreshLatency(hostPeerId: string): Promise<number> {
    for (let i = 0; i < 3; i++) await this.measureLatency(hostPeerId);
    return this.latencyMs / 1000;
  }

  /**
   * Client: make local audio match the host. Starts, stops, or (if playing) corrects drift.
   * @param fromMessage a new host message arrived (so the first check after a start is not skipped)
   */
  private reconcile(fromMessage = false) {
    if (this.host || !this.last) return;
    const playingLocally = get(this.player.isPlaying);
    if (!this.last.playing || this.hostOnly) {
      clearTimeout(this.settleTimer);
      this.settleTimer = undefined;
      if (playingLocally) this.player.stop();
      return;
    }
    if (!playingLocally) {
      if (this.starting) return;
      this.starting = true;
      this.player
        .start(() => this.target())
        .catch((e) => console.error('could not start playback', e))
        .finally(() => {
          this.starting = false;
          // compare once the scheduler has ticked, and fix the initial offset whatever its size
          clearTimeout(this.settleTimer);
          // The first ping of a connection is slow (warm-up), so measure again before correcting.
          this.settleTimer = setTimeout(async () => {
            await this.measureLatency(this.hostId);
            this.correct(0);
            this.settleTimer = setTimeout(async () => {
              await this.measureLatency(this.hostId);
              this.correct(DRIFT_THRESHOLD_S / 2);
            }, SETTLE_MS * 2);
          }, SETTLE_MS);
        });
      return;
    }
    if (fromMessage && !this.settleTimer) this.correct(DRIFT_THRESHOLD_S);
  }
  private correct(thresholdS: number) {
    this.settleTimer = undefined;
    const target = this.target();
    if (target === undefined || !get(this.player.isPlaying)) return;
    const drift = target - this.player.now();
    if (Math.abs(drift) / this.last!.cps > thresholdS) this.player.shift(drift);
  }

  /** Current cycle position: exact on the host, extrapolated on clients. */
  position(): number {
    if (this.host) return this.player.now();
    const last = this.last;
    if (!last) return 0;
    if (!last.playing) return last.cycle;
    const elapsedSec = (this.now() - this.receivedAt + this.latencyMs) / 1000;
    return last.cycle + elapsedSec * last.cps;
  }

  /**
   * The cycle that is being *heard* right now (not just scheduled): `position()` minus the audio output
   * delay, which on a client is the host's, since clients line up what is heard with the host. Live input
   * (recording) should use this: people play along with what they hear. May be slightly negative
   * just after starting.
   */
  heardPosition(): number {
    const last = this.last;
    const cps = this.host ? this.player.cps : (last?.cps ?? this.player.cps);
    const out = this.host ? this.player.outputLatency : (last?.out ?? 0);
    return this.position() - out * cps;
  }

  toggle() {
    if (this.host) return this.player.toggle();
    return this.sendRequest({ action: 'toggle' });
  }
  stop() {
    if (this.host) return this.player.stop();
    return this.sendRequest({ action: 'stop' });
  }

  /** Host: tell everybody (or one peer) the current state. */
  broadcast(peerId?: string) {
    if (!this.host) return;
    this.seq = Math.max(this.seq + 1, Date.now());
    this.sendState(
      {
        playing: get(this.player.isPlaying),
        cycle: this.player.now(),
        cps: this.player.cps,
        out: this.player.outputLatency,
        seq: this.seq,
        hostOnly: this.hostOnly
      },
      peerId
    );
  }
  peerJoined(peerId: string) {
    this.broadcast(peerId);
  }
}
