import type { ActionSender, Room } from 'trystero';
import { get, type Readable } from 'svelte/store';

/** The slice of the Strudel wrapper the transport needs; tests inject a fake. */
export interface PlayerLike {
  isPlaying: Readable<boolean>;
  time: Readable<number>;
  toggle(): Promise<void> | void;
  stop(): void;
}

// `type`, not `interface`: Trystero's payload constraint needs an implicit index signature
export type TransportState = {
  playing: boolean;
  /** Host cycle position when the message was sent. */
  cycle: number;
  /** Host wall clock (ms) when the message was sent. */
  hostTime: number;
};
export type TransportRequest = { action: 'toggle' | 'stop' };

/**
 * Host-authoritative play/stop state.
 * - host: owns the player; every change of `isPlaying` is broadcast, and requests from clients are executed.
 * - client: never plays audio; `playing` mirrors the host, and toggle/stop become requests to the host.
 * UI and key handlers should only call `toggle()` / `stop()` and read `playing`.
 */
export class Transport {
  playing = $state(false);
  /** Last state received from the host (clients only), for playhead extrapolation. */
  last = $state<TransportState | undefined>(undefined);

  private sendState: ActionSender<TransportState>;
  private sendRequest: ActionSender<TransportRequest>;

  constructor(
    room: Room,
    private host: boolean,
    private player: PlayerLike
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
      });
      onRequest((req) => {
        if (req?.action === 'toggle') void this.player.toggle();
        else if (req?.action === 'stop') this.player.stop();
      });
    } else {
      onState((state) => {
        if (typeof state?.playing !== 'boolean') return;
        this.playing = state.playing;
        this.last = state;
      });
    }
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
    this.sendState(
      {
        playing: get(this.player.isPlaying),
        cycle: get(this.player.time),
        hostTime: Date.now()
      },
      peerId
    );
  }
  peerJoined(peerId: string) {
    this.broadcast(peerId);
  }
}
