/**
 * Signal processing for acoustic latency calibration: the probe signals and the matched filter that finds
 * them in a microphone recording. Pure functions, no Web Audio, so it is all unit-testable.
 */

export type ChirpKind = 'up' | 'down';

/**
 * Long on purpose: the matched filter's gain grows with the sweep's duration x bandwidth, so a longer sweep is
 * found at a lower volume (400 ms hears a probe ~9 dB quieter than 60 ms at the same false-alarm rate).
 */
const CHIRP_SECONDS = 0.4;
const F_LOW = 1500;
const F_HIGH = 8000;
/** Minimum normalised correlation to accept a detection (white noise alone peaks around 0.04 for this sweep). */
export const MIN_SCORE = 0.1;

/**
 * A short windowed frequency sweep. A sweep (rather than a click) correlates sharply with itself yet barely
 * with room noise, speech or music, so arrival times can be found to a fraction of a millisecond. The up
 * and down sweeps are nearly orthogonal, so the host's own probe and a guest's can be told apart.
 */
export function makeChirp(
  sampleRate: number,
  kind: ChirpKind,
  seconds = CHIRP_SECONDS
): Float32Array {
  const n = Math.round(seconds * sampleRate);
  const hi = Math.min(F_HIGH, 0.45 * sampleRate);
  const [f0, f1] = kind === 'up' ? [F_LOW, hi] : [hi, F_LOW];
  const out = new Float32Array(n);
  const k = (f1 - f0) / seconds;
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1));
    out[i] = 0.9 * hann * Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * t * t));
  }
  return out;
}

function nextPow2(n: number) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place iterative radix-2 FFT (unnormalised; the caller divides after an inverse). */
function fft(re: Float64Array, im: Float64Array, inverse: boolean) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

export interface Detection {
  /** Where the probe starts in the recording, in samples (fractional). */
  index: number;
  /** Normalised correlation, 0..1: how much of the recording at that spot is the probe. */
  score: number;
}

/**
 * Find `probe` in `recording` by normalised cross-correlation. Normalising by the local signal energy
 * matters: a loud transient that is not the probe (a beep, a clap, music) has a big raw correlation but
 * only a small *fraction* of its energy is the probe's shape. Returns undefined when nothing matches well
 * enough (the other device was silent, too far, or drowned by noise).
 */
export function findChirp(
  recording: Float32Array,
  probe: Float32Array,
  minScore = MIN_SCORE
): Detection | undefined {
  const m = probe.length;
  const span = recording.length - m;
  if (span < 1) return undefined;
  const n = nextPow2(recording.length + m);
  const ar = new Float64Array(n);
  const ai = new Float64Array(n);
  const br = new Float64Array(n);
  const bi = new Float64Array(n);
  ar.set(recording);
  br.set(probe);
  fft(ar, ai, false);
  fft(br, bi, false);
  for (let i = 0; i < n; i++) {
    // A * conj(B)
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const im = ai[i] * br[i] - ar[i] * bi[i];
    ar[i] = r;
    ai[i] = im;
  }
  fft(ar, ai, true);

  let probeEnergy = 0;
  for (let i = 0; i < m; i++) probeEnergy += probe[i] * probe[i];
  const prefix = new Float64Array(recording.length + 1);
  for (let i = 0; i < recording.length; i++)
    prefix[i + 1] = prefix[i] + recording[i] * recording[i];

  // |correlation| so a speaker/mic that inverts polarity still counts
  const ncc = new Float64Array(span + 1);
  let best = 0;
  let at = 0;
  for (let i = 0; i <= span; i++) {
    const energy = prefix[i + m] - prefix[i];
    ncc[i] = energy > 1e-12 ? Math.abs(ar[i] / n) / Math.sqrt(probeEnergy * energy) : 0;
    if (ncc[i] > best) {
      best = ncc[i];
      at = i;
    }
  }
  if (!(best >= minScore)) return undefined;

  // parabolic interpolation around the peak for sub-sample precision
  let index = at;
  if (at > 0 && at < span) {
    const y0 = ncc[at - 1];
    const y1 = ncc[at];
    const y2 = ncc[at + 1];
    const denom = y0 - 2 * y1 + y2;
    if (denom !== 0) index += (0.5 * (y0 - y2)) / denom;
  }
  return { index, score: best };
}

export function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
