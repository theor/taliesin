import type { ActionSender, Room } from 'trystero';
import { get, type Readable } from 'svelte/store';

/** The slice of the Strudel wrapper the transport needs; tests inject a fake. */
export interface PlayerLike {
  isPlaying: Readable<boolean>;
  /** Current cycle position. */
  time: Readable<number>;
  /** Cycles per second. */
  cps: number;
  toggle(): Promise<void> | void;
  stop(): void;
}

// `type`, not `interface`: Trystero's payload constraint needs an implicit index signature
export type TransportState = {
  playing: boolean;
  /** Host cycle position when the message was sent. */
  cycle: number;
  /** Cycles per second on the host. */
  cps: number;
  /**
   * Strictly increasing per host (seeded from the host clock so a reloaded host still beats its earlier
   * session). Clients drop anything not newer than what they already applied: messages can overtake each
   * other, and a stale "playing" must not override a newer "stopped".
   */
  seq: number;
};
export type TransportRequest = { action: 'toggle' | 'stop' };

/** How often the host re-announces its position while playing, to correct drift. */
const RESYNC_MS = 4000;

/**
 * Host-authoritative play/stop state and playhead.
 * - host: owns the player; every change of `isPlaying` is broadcast, requests from clients are executed,
 *   and the position is re-announced periodically while playing.
 * - client: never plays audio; `playing` mirrors the host, toggle/stop become requests to the host, and
 *   `position()` extrapolates from the last message.
 *
 * Clients never compare wall clocks (they differ between machines). They use only their own elapsed time
 * since the message arrived, plus half the measured round-trip as an estimate of the network delay.
 * UI and key handlers should only call `toggle()` / `stop()` and read `playing` / `position()`.
 */
export class Transport {
  playing = $state(false);
  /** Last state received from the host (clients only). */
  last = $state<TransportState | undefined>(undefined);

  private sendState: ActionSender<TransportState>;
  private sendRequest: ActionSender<TransportRequest>;
  private receivedAt = 0; // local monotonic ms when `last` arrived
  private latencyMs = 0; // estimated one-way delay host -> us
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
        this.playing = state.playing;
        this.last = state;
        this.receivedAt = this.now();
        void this.measureLatency(peerId);
      });
    }
  }

  private updateResync() {
    if (this.playing && !this.resync) {
      this.resync = setInterval(() => this.broadcast(), RESYNC_MS);
    } else if (!this.playing && this.resync) {
      clearInterval(this.resync);
      this.resync = undefined;
    }
  }
  private async measureLatency(hostPeerId: string) {
    try {
      const rtt = await this.room.ping(hostPeerId);
      if (Number.isFinite(rtt) && rtt >= 0) this.latencyMs = rtt / 2;
    } catch {
      // keep the previous estimate
    }
  }

  /** Current cycle position: exact on the host, extrapolated on clients. */
  position(): number {
    if (this.host) return get(this.player.time);
    const last = this.last;
    if (!last) return 0;
    if (!last.playing) return last.cycle;
    const elapsedSec = (this.now() - this.receivedAt + this.latencyMs) / 1000;
    return last.cycle + elapsedSec * last.cps;
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
        cycle: get(this.player.time),
        cps: this.player.cps,
        seq: this.seq
      },
      peerId
    );
  }
  peerJoined(peerId: string) {
    this.broadcast(peerId);
  }
}
