import { describe, expect, test } from 'vitest';
import {
  APOTHEM,
  BALL_RADIUS,
  CORNER,
  cycleAt,
  dcos,
  dsin,
  firstTickOf,
  PLAY_AHEAD_S,
  secondsAt,
  stepOfTick,
  TICKS_PER_STEP,
  TombolaPlayer,
  TombolaSim,
  type LiveNote
} from './tombolaPhysics';
import type { LinearClock } from './strudel';

/** Hits per step over `steps` steps. */
function run(seed: number, balls: number[], spin: number, steps: number, shake = false) {
  const sim = new TombolaSim(seed, balls, firstTickOf(0));
  if (shake) sim.shake();
  return { sim, decided: sim.advanceTo(steps - 1, spin) };
}
const hitSteps = (decided: { hits: unknown[] }[]) => decided.filter((d) => d.hits.length).length;

describe('deterministic maths', () => {
  test('dsin and dcos match Math.sin and cos closely', () => {
    for (let x = -50; x <= 50; x += 0.0137) {
      expect(Math.abs(dsin(x) - Math.sin(x))).toBeLessThan(1e-9);
      expect(Math.abs(dcos(x) - Math.cos(x))).toBeLessThan(1e-9);
    }
  });

  test('a tick is heard on the nearest step', () => {
    expect(stepOfTick(0)).toBe(0);
    expect(stepOfTick(TICKS_PER_STEP / 2 - 1)).toBe(0);
    expect(stepOfTick(TICKS_PER_STEP / 2)).toBe(1);
    expect(stepOfTick(-1)).toBe(0);
    expect(stepOfTick(firstTickOf(5))).toBe(5);
    expect(stepOfTick(firstTickOf(5) - 1)).toBe(4);
  });
});

describe('the drum', () => {
  test('the same seed and inputs give the same drum, tick for tick', () => {
    const a = run(42, [0, 2, 4, 7], 0.8, 200, true);
    const b = run(42, [0, 2, 4, 7], 0.8, 200, true);
    expect(a.sim.fingerprint()).toBe(b.sim.fingerprint());
    expect(a.decided).toEqual(b.decided);
    expect(run(43, [0, 2, 4, 7], 0.8, 200, true).sim.fingerprint()).not.toBe(a.sim.fingerprint());
  });

  test('a fixed seed gives a fixed outcome (catches a change of physics or of engine maths)', () => {
    const { decided } = run(7, [0, 2, 4], 1, 64, true);
    const pattern = decided.map((d) => (d.hits.length ? d.hits[0].track : '.')).join('');
    // update this when the physics is changed on purpose; an engine that disagrees is a bug
    expect(pattern).toMatchSnapshot();
  });

  test('the balls never leave the drum', () => {
    const sim = new TombolaSim(1, [0, 1, 2, 3, 4, 5, 6, 7], 0);
    for (let i = 0; i < 5000; i++) {
      sim.step(1);
      if (i % 300 === 0) sim.shake(2);
      for (const b of sim.balls) {
        expect(Math.sqrt(b.x * b.x + b.y * b.y)).toBeLessThan(CORNER - BALL_RADIUS + 1e-6);
      }
    }
  });

  test('a still drum falls silent; a spinning one keeps playing, more the faster it turns', () => {
    const still = run(3, [0, 2, 4], 0, 128, true).decided;
    expect(hitSteps(still.slice(32))).toBe(0); // the balls settle
    const slow = hitSteps(run(3, [0, 2, 4], 0.3, 256).decided);
    const fast = hitSteps(run(3, [0, 2, 4], 1, 256).decided);
    expect(slow).toBeGreaterThan(0);
    expect(fast).toBeGreaterThan(slow);
    expect(fast).toBeLessThan(256); // not every step
  });

  test('balls can change while it turns: the others carry on', () => {
    const sim = new TombolaSim(5, [0, 2], 0);
    sim.advanceTo(10, 1);
    const kept = { ...sim.balls.find((b) => b.track === 2)! };
    sim.setBalls([2, 5]);
    expect(sim.balls.map((b) => b.track)).toEqual([2, 5]);
    expect(sim.balls[0]).toEqual(kept);
  });
});

describe('playing it live', () => {
  // 120 BPM (0.5 cycles a second), 16 steps a measure: a step is 1/8 s; the song's cycle 0 at 10 s
  const clock: LinearClock = { cycle: 0, seconds: 10, cps: 0.5 };
  const SPM = 16;
  const stepTime = (step: number) => secondsAt(clock, step / SPM);

  /** Frames every `dt` seconds from `from` to `to`; the notes scheduled, and when each was. */
  function play(player: TombolaPlayer, from: number, to: number, dt = 1 / 60, k = clock) {
    const out: (LiveNote & { at: number })[] = [];
    for (let now = from; now < to; now += dt)
      for (const n of player.update(k, now, SPM, 1)) out.push({ ...n, at: now });
    return out;
  }

  test('each note is snapped to its step and scheduled just ahead of it, never late', () => {
    const notes = play(new TombolaPlayer(9, [0, 2, 4]), 10, 18);
    expect(notes.length).toBeGreaterThan(10);
    for (const n of notes) {
      expect(n.seconds).toBeCloseTo(stepTime(n.step), 9);
      expect(n.seconds - n.at).toBeGreaterThan(0);
      expect(n.seconds - n.at).toBeLessThanOrEqual(PLAY_AHEAD_S + 1e-9);
    }
    // a ball plays once per step at most
    const keys = notes.map((n) => `${n.step}:${n.track}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('frame rate does not change what plays', () => {
    const at = (dt: number) =>
      play(new TombolaPlayer(11, [0, 3, 5]), 10, 14, dt).map((n) => `${n.step}:${n.track}`);
    expect(at(1 / 60)).toEqual(at(1 / 23));
  });

  test('it follows the song clock: a clock that jumps carries on from the new position', () => {
    const player = new TombolaPlayer(9, [0, 2]);
    play(player, 10, 11);
    const later = { ...clock, cycle: 40 }; // a resync moved the song 40 cycles on
    const notes = play(player, 11, 13, 1 / 60, later);
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(n.step).toBeGreaterThanOrEqual(40 * SPM);
  });

  test('a shake is heard a fraction of a second later', () => {
    // a drum that has stopped turning: the balls settle and fall silent
    const player = new TombolaPlayer(4, [0, 2, 4]);
    for (let now = 10; now < 20; now += 1 / 60) player.update(clock, now, SPM, 0);
    expect(player.update(clock, 20, SPM, 0)).toEqual([]);
    player.shake();
    const notes: LiveNote[] = [];
    for (let now = 20; now < 21; now += 1 / 60) notes.push(...player.update(clock, now, SPM, 0));
    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0].seconds - 20).toBeLessThan(PLAY_AHEAD_S + 2 / 8);
  });

  test('it draws the drum being heard, not the one ahead', () => {
    const player = new TombolaPlayer(9, [0, 2]);
    play(player, 10, 11);
    const pic = player.view(clock, 11, SPM)!;
    expect(pic.tick).toBe(Math.floor(cycleAt(clock, 11) * SPM * TICKS_PER_STEP));
    for (const b of pic.balls) expect(Math.abs(b.y)).toBeLessThan(APOTHEM);
  });
});
