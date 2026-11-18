import type { Acoustics, Recorder } from './calibration.svelte';
import { makeChirp, type ChirpKind } from './dsp';

/** Runs in the audio thread: forwards every block of microphone samples with its audio-clock frame. */
const WORKLET = `
class TaliesinRecorder extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage({ frame: currentFrame, data: ch.slice() });
    return true;
  }
}
registerProcessor('taliesin-recorder', TaliesinRecorder);
`;

export interface WebAcousticsOptions {
  /** Where probes are played (default: the speakers). Tests loop it back into the microphone. */
  output?: AudioNode;
  /** The microphone (default: getUserMedia without echo cancellation, which would erase the probe). */
  getStream?: () => Promise<MediaStream>;
}

const defaultStream = () =>
  navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: 1
    }
  });

/** Acoustics on a real AudioContext: same context and output path as the song itself. */
export class WebAcoustics implements Acoustics {
  private probes = new Map<ChirpKind, AudioBuffer>();
  private workletLoaded = false;

  constructor(
    private ctx: AudioContext,
    private opts: WebAcousticsOptions = {}
  ) {}

  get sampleRate() {
    return this.ctx.sampleRate;
  }
  now() {
    return this.ctx.currentTime;
  }
  ready() {
    return this.ctx.state === 'running';
  }

  play(kind: ChirpKind) {
    let buffer = this.probes.get(kind);
    if (!buffer) {
      const data = makeChirp(this.ctx.sampleRate, kind);
      buffer = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
      buffer.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.probes.set(kind, buffer);
    }
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.opts.output ?? this.ctx.destination);
    source.start();
  }

  async record(): Promise<Recorder> {
    const ctx = this.ctx;
    await ctx.resume(); // the calibrate button is a user gesture
    if (!this.workletLoaded) {
      const url = URL.createObjectURL(new Blob([WORKLET], { type: 'text/javascript' }));
      try {
        await ctx.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      this.workletLoaded = true;
    }
    const stream = await (this.opts.getStream ?? defaultStream)();
    const source = ctx.createMediaStreamSource(stream);
    const node = new AudioWorkletNode(ctx, 'taliesin-recorder', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1
    });
    const mute = ctx.createGain(); // an unconnected worklet may never be processed
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);

    const chunks: { frame: number; data: Float32Array }[] = [];
    node.port.onmessage = (e) => chunks.push(e.data);

    return {
      stop: () => {
        node.port.onmessage = null;
        source.disconnect();
        node.disconnect();
        mute.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        if (!chunks.length) return { samples: new Float32Array(0), start: ctx.currentTime };
        const first = chunks[0].frame;
        const last = chunks[chunks.length - 1];
        const samples = new Float32Array(last.frame + last.data.length - first);
        for (const c of chunks) samples.set(c.data, c.frame - first); // by frame, so a gap stays a gap
        return { samples, start: first / ctx.sampleRate };
      }
    };
  }
}
