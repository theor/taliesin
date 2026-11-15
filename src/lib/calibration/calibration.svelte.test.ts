import { afterEach, describe, expect, test, vi } from 'vitest';
import { AppStore } from '../Store.svelte';
import { createFakeNetwork } from '../testing/fakeRoom';
import { fakePlayer } from '../testing/fakePlayer';
import type { Acoustics } from './calibration.svelte';
import { findChirp, makeChirp, type ChirpKind } from './dsp';

const SR = 16000;
const clock = () => Date.now() / 1000; // fake timers drive Date

/** What the host's microphone hears: every probe played by anyone, when it comes out of a speaker. */
function createAir() {
  const emissions: { kind: ChirpKind; at: number }[] = [];
  const chirps = { up: makeChirp(SR, 'up'), down: makeChirp(SR, 'down') };
  return {
    emit: (kind: ChirpKind, at: number) => emissions.push({ kind, at }),
    /** the microphone signal between two times, with a little deterministic noise */
    record(from: number, to: number): Float32Array {
      const out = new Float32Array(Math.round((to - from) * SR));
      let seed = 7;
      for (let i = 0; i < out.length; i++) {
        seed = (seed * 16807) % 2147483647;
        out[i] = (seed / 2147483647 - 0.5) * 0.02;
      }
      for (const e of emissions) {
        const at = Math.round((e.at - from) * SR);
        chirps[e.kind].forEach((v, i) => {
          if (at + i >= 0 && at + i < out.length) out[at + i] += v * 0.5;
        });
      }
      return out;
    }
  };
}

function fakeAcoustics(
  air: ReturnType<typeof createAir>,
  o: { out: number; ready?: boolean; mute?: boolean }
): Acoustics {
  return {
    sampleRate: SR,
    now: clock,
    ready: () => o.ready ?? true,
    play: (kind) => {
      if (!o.mute) air.emit(kind, clock() + o.out);
    },
    record: async () => {
      const startedAt = clock();
      return { stop: () => ({ samples: air.record(startedAt, clock()), start: startedAt }) };
    }
  };
}

describe('probe detection', () => {
  const probe = makeChirp(SR, 'up');
  const place = (at: number, kind: ChirpKind = 'up', gain = 0.3, length = 20000) => {
    const rec = new Float32Array(length);
    makeChirp(SR, kind).forEach((v, i) => (rec[at + i] += v * gain));
    return rec;
  };

  test('finds the probe at the right place, to a fraction of a sample', () => {
    const found = findChirp(place(7321), probe)!;
    expect(found.index).toBeCloseTo(7321, 0);
  });

  test('still finds it in noise as loud as the probe itself', () => {
    const rec = place(5000, 'up', 0.1);
    let seed = 3;
    for (let i = 0; i < rec.length; i++) {
      seed = (seed * 16807) % 2147483647;
      rec[i] += (seed / 2147483647 - 0.5) * 0.12;
    }
    expect(findChirp(rec, probe)!.index).toBeCloseTo(5000, 0);
  });

  test('finds a probe 15 dB below the room noise (a quiet phone speaker), without false alarms', () => {
    const noise = (seed: number, sigma: number) => {
      const rec = new Float32Array(20000);
      let s = seed;
      const uniform = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * Math.sqrt(12);
      for (let i = 0; i < rec.length; i++) rec[i] = sigma * ((uniform() + uniform() + uniform() + uniform()) / 2);
      return rec;
    };
    const sigma = 2.19; // noise power 0.15 x 31.6: the probe is 15 dB below the noise
    for (const seed of [11, 12, 13, 14, 15, 16]) {
      const rec = noise(seed, sigma);
      makeChirp(SR, 'up').forEach((v, i) => (rec[6000 + i] += v));
      const found = findChirp(rec, probe);
      expect(found, `probe in noise, seed ${seed}`).toBeDefined();
      expect(found!.index).toBeCloseTo(6000, 0);
      expect(findChirp(noise(seed + 100, sigma), probe), `noise only, seed ${seed}`).toBeUndefined();
    }
  });

  test('ignores loud sounds that are not the probe: a beep, a clap', () => {
    const beep = new Float32Array(20000);
    for (let i = 6000; i < 10800; i++) beep[i] = 0.8 * Math.sin((2 * Math.PI * 1000 * i) / SR);
    expect(findChirp(beep, probe)).toBeUndefined();
    const clap = new Float32Array(20000);
    for (let i = 0; i < 400; i++) clap[8000 + i] = (i % 2 ? 1 : -1) * Math.exp(-i / 60);
    expect(findChirp(clap, probe)).toBeUndefined();
  });

  test('tells the two sweeps apart when both are in the recording, and finds nothing in silence', () => {
    const rec = place(3000, 'up');
    place(9000, 'down').forEach((v, i) => (rec[i] += v));
    expect(findChirp(rec, probe)!.index).toBeCloseTo(3000, 0);
    expect(findChirp(rec, makeChirp(SR, 'down'))!.index).toBeCloseTo(9000, 0);
    expect(findChirp(new Float32Array(20000), probe)).toBeUndefined();
  });

  test('works when the speaker inverts the signal', () => {
    expect(findChirp(place(3000, 'up', -0.3), probe)!.index).toBeCloseTo(3000, 0);
  });
});

describe('acoustic calibration', () => {
  afterEach(() => vi.useRealTimers());

  function setup(guest: { out: number; ready?: boolean; mute?: boolean }, hostLoop = 0.03) {
    vi.useFakeTimers();
    const net = createFakeNetwork();
    const air = createAir();
    const players = { host: fakePlayer({ clocked: true }), a: fakePlayer({ clocked: true }) };
    const host = new AppStore(true, 'r', net.join('host', { latencyMs: 20 }), players.host, undefined, () =>
      fakeAcoustics(air, { out: hostLoop })
    );
    const a = new AppStore(false, 'r', net.join('a', { latencyMs: 30 }), players.a, undefined, () =>
      fakeAcoustics(air, guest)
    );
    net.settle();
    return { host, a, players };
  }
  async function calibrate(host: AppStore) {
    const run = host.calibration.run(host.peers);
    await vi.advanceTimersByTimeAsync(8000);
    await run;
    await vi.advanceTimersByTimeAsync(2000); // the guest re-measures the network, then applies
  }

  test("measures how much later than the host a guest sounds, net of the network delay it assumes", async () => {
    const { host, a } = setup({ out: 0.15 }, 0.03);
    await calibrate(host);
    expect(host.calibration.results.a.status).toBe('ok');
    // the guest's speaker is 150 ms behind its clock, the host's 30 ms: 120 ms later than the host
    expect(a.transport.offset).toBeCloseTo(0.12, 2);
    expect(a.calibration.applied).toBe(a.transport.offset);
  });

  test('a calibrated guest starts and stays that much ahead of the host', async () => {
    const { host, a, players } = setup({ out: 0.15 }, 0.03);
    await calibrate(host);
    players.host.startCycle = 10;
    await host.transport.toggle();
    await vi.advanceTimersByTimeAsync(2000);
    // late by 120ms => scheduled 120ms (0.06 cycle) ahead of where the host is
    expect(players.a.now() - players.host.now()).toBeCloseTo(0.06, 1);
  });

  test('reports a guest that has not unlocked audio, and applies nothing', async () => {
    const { host, a } = setup({ out: 0.15, ready: false });
    await calibrate(host);
    const r = host.calibration.results.a;
    expect(r.status === 'failed' && r.reason).toMatch(/Tap to hear/);
    expect(a.transport.offset).toBeUndefined();
  });

  test('reports a guest the microphone cannot hear, and applies nothing', async () => {
    const { host, a } = setup({ out: 0.15, mute: true });
    await calibrate(host);
    const r = host.calibration.results.a;
    expect(r.status === 'failed' && r.reason).toMatch(/could not hear that device/);
    expect(a.transport.offset).toBeUndefined();
  });

  test('a guest can drop its calibration', async () => {
    const { host, a } = setup({ out: 0.15 });
    await calibrate(host);
    a.calibration.reset();
    expect(a.transport.offset).toBeUndefined();
    expect(a.calibration.applied).toBeUndefined();
  });

  test('clients cannot start a calibration, and ignore results that make no sense', async () => {
    const { host, a } = setup({ out: 0.15 });
    await a.calibration.run(['host']);
    expect(a.calibration.running).toBe(false);
    host.calibration['send']({ t: 'result', round: 99 }, 'a');
    await vi.advanceTimersByTimeAsync(2000);
    expect(a.transport.offset).toBeUndefined();
  });
});
