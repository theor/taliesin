import type { ActionSender, Room } from '../netRoom';
import { findChirp, makeChirp, median, type ChirpKind } from './dsp';

/** The audio hardware a calibration needs; the app uses Web Audio, tests inject a simulation. */
export interface Acoustics {
  readonly sampleRate: number;
  /** The audio clock, in seconds. */
  now(): number;
  /** False while the browser keeps audio locked (no user gesture yet). */
  ready(): boolean;
  /** Play the probe signal right now. */
  play(kind: ChirpKind): void;
  /** Start recording the microphone (rejects if there is none or it is refused). */
  record(): Promise<Recorder>;
}
export interface Recorder {
  /** Stop and return the samples; `start` is the audio-clock time of the first one. */
  stop(): { samples: Float32Array; start: number };
}

export type CalibrationResult =
  | { status: 'ok'; /** how much later than predicted this peer sounds, seconds */ delay: number }
  | { status: 'failed'; reason: string };

/** Wire format. `type` rather than `interface` for Trystero's payload constraint. */
type CalMessage = { t: 'play' | 'unready' | 'result'; round?: number };

/** What a calibrated peer needs from the transport. */
export interface CalibrationTarget {
  /** Re-measure and return the one-way delay to the host, seconds. */
  refreshLatency(hostPeerId: string): Promise<number>;
  setOffset(seconds: number | undefined): void;
}

/** Probes played by the host itself to learn its own speaker-to-microphone delay. */
const HOST_PROBES = 2;
const HOST_WINDOW_S = 1.0;
/** Probes asked of each guest. */
const GUEST_PROBES = 4;
const GUEST_WINDOW_S = 1.4;
const MIN_GOOD_PROBES = 3;
/** Probes of one guest may disagree by this much (seconds) before the result is not trusted. */
const MAX_SPREAD_S = 0.06;
/** Offsets beyond this are certainly a mis-detection. */
const MAX_OFFSET_S = 1.5;

const sleep = (s: number) => new Promise<void>((r) => setTimeout(r, s * 1000));

/**
 * Acoustic latency calibration for devices in the same room.
 *
 * The song is scheduled on each guest from the host's clock, corrected by network delay and by the audio
 * output latency the browser *reports*. That report is often missing or wrong (Bluetooth adds 100-300 ms).
 * So we measure what is actually heard: the host listens on its microphone while a guest plays a probe
 * the moment it receives the host's request. Timing the sound's arrival gives
 *
 *   round = network delay (host -> guest) + guest output delay - host output delay
 *
 * once the host's own speaker-to-microphone delay (measured with a probe of its own) is subtracted. The
 * guest then subtracts the network delay it already assumes when it positions the song, and what is left
 * is exactly how late it sounds: that becomes its playback offset, replacing the reported-latency guess.
 *
 * Host: `run(peers)`. Guest: automatic (answers requests, applies the result). The host's microphone
 * delay cancels out because the same input path measures both the host's probe and the guest's.
 */
export class Calibration {
  /** Host: progress and results of the last run, by peer id. */
  results = $state<Record<string, CalibrationResult>>({});
  /** Host: a run is in progress. */
  running = $state(false);
  /** Guest: the offset applied by the last calibration, seconds (undefined = not calibrated). */
  applied = $state<number | undefined>(undefined);

  private send: ActionSender<CalMessage>;
  private unready = new Set<string>();
  private chirps = new Map<number, Record<ChirpKind, Float32Array>>();

  constructor(
    room: Room,
    private host: boolean,
    private acoustics: () => Acoustics,
    private target: CalibrationTarget
  ) {
    const [send, onMessage] = room.makeAction<CalMessage>('cal');
    this.send = send;
    onMessage((msg, peerId) => void this.receive(msg, peerId));
  }

  private probes(sampleRate: number) {
    let c = this.chirps.get(sampleRate);
    if (!c) {
      c = { up: makeChirp(sampleRate, 'up'), down: makeChirp(sampleRate, 'down') };
      this.chirps.set(sampleRate, c);
    }
    return c;
  }

  private async receive(msg: CalMessage, peerId: string) {
    if (this.host) {
      if (msg?.t === 'unready') this.unready.add(peerId);
      return;
    }
    if (msg?.t === 'play') {
      let ac: Acoustics | undefined;
      try {
        ac = this.acoustics();
      } catch {
        /* no audio */
      }
      if (ac?.ready()) ac.play('down');
      else void this.send({ t: 'unready' }, peerId);
    } else if (msg?.t === 'result' && typeof msg.round === 'number' && Number.isFinite(msg.round)) {
      const latency = await this.target.refreshLatency(peerId);
      const offset = msg.round - latency;
      if (Math.abs(offset) > MAX_OFFSET_S) return;
      this.applied = offset;
      this.target.setOffset(offset);
    }
  }

  /** Guest: forget the calibration and go back to the browser's reported latency. */
  reset() {
    this.applied = undefined;
    this.target.setOffset(undefined);
  }

  /** Host: calibrate these peers, one after the other, and tell each its result. */
  async run(peers: string[]) {
    if (!this.host || this.running) return;
    this.running = true;
    this.results = {};
    try {
      for (const peer of peers) {
        const result = await this.measure(peer);
        this.results = { ...this.results, [peer]: result };
        if (result.status === 'ok') void this.send({ t: 'result', round: result.delay }, peer);
      }
    } finally {
      this.running = false;
    }
  }

  private async measure(peer: string): Promise<CalibrationResult> {
    let ac: Acoustics;
    let recorder: Recorder;
    try {
      ac = this.acoustics();
      recorder = await ac.record();
    } catch {
      return { status: 'failed', reason: 'The microphone is not available' };
    }
    this.unready.delete(peer);

    const probes: { t0: number; kind: ChirpKind; window: number }[] = [];
    for (let i = 0; i < HOST_PROBES; i++) {
      probes.push({ t0: ac.now(), kind: 'up', window: HOST_WINDOW_S });
      ac.play('up');
      await sleep(HOST_WINDOW_S);
    }
    for (let i = 0; i < GUEST_PROBES; i++) {
      probes.push({ t0: ac.now(), kind: 'down', window: GUEST_WINDOW_S });
      void this.send({ t: 'play' }, peer);
      await sleep(GUEST_WINDOW_S);
      if (this.unready.has(peer)) break;
    }
    const { samples, start } = recorder.stop();
    if (this.unready.has(peer)) {
      return { status: 'failed', reason: 'That device has to tap "Tap to hear" first' };
    }

    const sr = ac.sampleRate;
    const chirps = this.probes(sr);
    const delays: Record<ChirpKind, number[]> = { up: [], down: [] };
    for (const p of probes) {
      const from = Math.max(0, Math.floor((p.t0 - start) * sr));
      const to = Math.min(samples.length, from + Math.ceil(p.window * sr));
      const found = findChirp(samples.subarray(from, to), chirps[p.kind]);
      if (found) delays[p.kind].push(start + (from + found.index) / sr - p.t0);
    }

    if (delays.up.length < 1) {
      return { status: 'failed', reason: 'The host could not hear its own speaker (volume too low?)' };
    }
    if (delays.down.length < MIN_GOOD_PROBES) {
      return { status: 'failed', reason: 'The host could not hear that device (too far, or muted?)' };
    }
    if (Math.max(...delays.down) - Math.min(...delays.down) > MAX_SPREAD_S) {
      return { status: 'failed', reason: 'The measurements were inconsistent (noise or a bad connection)' };
    }
    return { status: 'ok', delay: median(delays.down) - median(delays.up) };
  }
}
