/**
 * A tombola that is really simulated: balls in a spinning hexagonal drum, and a ball hitting a wall hard
 * enough plays its row. Meant to be deterministic, so the same seed and the same inputs (spin, shakes,
 * balls, at the same ticks) give the same hits on any device (only checked in V8 so far: the snapshot
 * test is the check to run elsewhere). Nothing relies on that yet: only the device spinning simulates,
 * and plays the hits itself (`TombolaPlayer`); a take turns them into ordinary edits. To get there:
 * - time is in ticks, a fixed number per step: the outcome does not depend on the tempo or the frame rate;
 * - only `+ - * /`, `Math.sqrt`, `Math.round`/`floor` and integer ops, which IEEE 754 and the spec pin
 *   down exactly. `Math.sin`/`cos` are implementation-defined (they differ in the last bit between
 *   engines, and a bouncing ball amplifies that), so the drum's angle goes through `dsin`/`dcos` here;
 * - the randomness is a seeded integer PRNG whose state is part of the simulation.
 * Units: the drum's inner walls are 1 from its centre, y points down (as in SVG), gravity pulls down.
 */
import type { LinearClock } from './strudel';

export const TICKS_PER_STEP = 6;
/** The inner distance from the centre to each wall. */
export const APOTHEM = 1;
/** The distance from the centre to a corner. */
export const CORNER = (2 * APOTHEM) / Math.sqrt(3);
export const BALL_RADIUS = 0.13;
const GRAVITY = 0.004; // per tick²: a ball falls across the drum in about 4 steps
/** Turn per tick at full spin: one turn every 16 steps. */
const MAX_TURN = (2 * Math.PI) / (16 * TICKS_PER_STEP);
const RESTITUTION = 0.6;
const FRICTION = 0.2; // share of the tangential speed (against the wall) lost per bounce
const MAX_SPEED = 0.15; // per tick, below a ball's diameter, so nothing tunnels through a wall
/** How hard a ball must meet a wall (normal speed per tick) to play: resting balls never do. */
const HIT_SPEED = 0.025;
const HIT_COOLDOWN = 3; // ticks before the same ball can play again (a ball rattling in a corner)
const SHAKE_SPEED = 0.09;

const PI = 3.141592653589793;
const TAU = 6.283185307179586;
const HALF_PI = 1.5707963267948966;

/** sin from arithmetic only (Taylor to x¹³ after folding into ±π/2: error below 1e-9). */
export function dsin(x: number): number {
  x -= Math.round(x / TAU) * TAU; // [-π, π]
  if (x > HALF_PI) x = PI - x;
  else if (x < -HALF_PI) x = -PI - x;
  const x2 = x * x;
  return (
    x *
    (1 -
      (x2 / 6) *
        (1 - (x2 / 20) * (1 - (x2 / 42) * (1 - (x2 / 72) * (1 - (x2 / 110) * (1 - x2 / 156))))))
  );
}
export const dcos = (x: number) => dsin(x + HALF_PI);

/** mulberry32: one 32-bit integer of state, integer maths only. */
function nextRandom(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [s, ((t ^ (t >>> 14)) >>> 0) / 4294967296];
}

export interface Ball {
  /** The row it plays. */
  track: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cooldown: number;
}
export interface Hit {
  tick: number;
  track: number;
}

/** The step a tick is heard on: the nearest one (step s plays at tick s × TICKS_PER_STEP). */
export const stepOfTick = (tick: number) =>
  Math.floor((tick + TICKS_PER_STEP / 2) / TICKS_PER_STEP);
/** The first tick snapped to `step`. */
export const firstTickOf = (step: number) => step * TICKS_PER_STEP - TICKS_PER_STEP / 2;

export class TombolaSim {
  /** The next tick to simulate (absolute: tick 0 is the song's step 0). */
  tick: number;
  /** The drum's turn, in radians (kept within one turn). */
  angle = 0;
  balls: Ball[] = [];
  private rng: number;

  constructor(seed: number, tracks: readonly number[], tick = 0) {
    this.rng = seed | 0;
    this.tick = tick;
    this.setBalls(tracks);
  }

  private random(): number {
    const [state, value] = nextRandom(this.rng);
    this.rng = state;
    return value;
  }

  /** Change which balls are in the drum: the ones still in keep moving, new ones drop in from the top. */
  setBalls(tracks: readonly number[]) {
    const kept = this.balls.filter((b) => tracks.includes(b.track));
    const added = tracks
      .filter((t) => !kept.some((b) => b.track === t))
      .map((track, i) => ({
        track,
        x: (this.random() - 0.5) * 0.8,
        y: -0.5 + (i % 3) * 0.3 * BALL_RADIUS,
        vx: 0,
        vy: 0,
        cooldown: 0
      }));
    this.balls = [...kept, ...added].sort((a, b) => a.track - b.track);
  }

  /** Throw every ball in a random direction. */
  shake(strength = 1) {
    for (const b of this.balls) {
      const a = this.random() * TAU;
      const speed = SHAKE_SPEED * strength * (0.5 + 0.5 * this.random());
      b.vx += speed * dcos(a);
      b.vy += speed * dsin(a);
    }
  }

  /** One tick. `spin` (0-1) is how fast the drum turns. Returns the balls that hit a wall hard enough. */
  step(spin: number): Hit[] {
    const turn = MAX_TURN * (Number.isFinite(spin) ? Math.min(1, Math.max(0, spin)) : 0);
    this.angle += turn;
    if (this.angle >= TAU) this.angle -= TAU;
    const balls = this.balls;
    for (const b of balls) {
      b.vy += GRAVITY;
      const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (speed > MAX_SPEED) {
        b.vx *= MAX_SPEED / speed;
        b.vy *= MAX_SPEED / speed;
      }
      b.x += b.vx;
      b.y += b.vy;
      if (b.cooldown > 0) b.cooldown--;
    }
    // balls against each other (equal masses), in a fixed order
    const r2 = 2 * BALL_RADIUS;
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i];
        const b = balls[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r2 * r2) continue;
        const d = Math.sqrt(d2);
        // two balls on the same spot: push apart along x
        const nx = d > 1e-9 ? dx / d : 1;
        const ny = d > 1e-9 ? dy / d : 0;
        const push = (r2 - d) / 2;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const j2 = ((1 + RESTITUTION) * vn) / 2;
          a.vx += j2 * nx;
          a.vy += j2 * ny;
          b.vx -= j2 * nx;
          b.vy -= j2 * ny;
        }
      }
    }
    // the walls last, so they always hold the balls in; a turning wall drags the ball along
    const hits: Hit[] = [];
    const normals = Array.from({ length: 6 }, (_, k) => {
      const a = this.angle + (PI / 3) * k + PI / 6;
      return [dcos(a), dsin(a)] as const;
    });
    for (const b of balls) {
      let hit = false;
      for (const [nx, ny] of normals) {
        const pen = b.x * nx + b.y * ny + BALL_RADIUS - APOTHEM;
        if (pen <= 0) continue;
        b.x -= nx * pen;
        b.y -= ny * pen;
        const cx = b.x + nx * BALL_RADIUS;
        const cy = b.y + ny * BALL_RADIUS;
        const wx = -turn * cy;
        const wy = turn * cx;
        let rx = b.vx - wx;
        let ry = b.vy - wy;
        const vn = rx * nx + ry * ny;
        if (vn <= 0) continue;
        if (vn > HIT_SPEED) hit = true;
        rx -= (1 + RESTITUTION) * vn * nx;
        ry -= (1 + RESTITUTION) * vn * ny;
        const rn = rx * nx + ry * ny;
        b.vx = rn * nx + (rx - rn * nx) * (1 - FRICTION) + wx;
        b.vy = rn * ny + (ry - rn * ny) * (1 - FRICTION) + wy;
      }
      if (hit && b.cooldown === 0) {
        hits.push({ tick: this.tick, track: b.track });
        b.cooldown = HIT_COOLDOWN;
      }
    }
    this.tick++;
    return hits;
  }

  /**
   * Simulate every tick heard on or before `step`, returning each step's hits (every step, empty ones
   * too). `afterTick` sees the drum after each tick (for drawing it).
   */
  advanceTo(
    step: number,
    spin: number,
    afterTick?: (sim: TombolaSim, hits: Hit[]) => void
  ): { step: number; hits: Hit[] }[] {
    const out: { step: number; hits: Hit[] }[] = [];
    while (stepOfTick(this.tick) <= step) {
      const s = stepOfTick(this.tick);
      const hits = this.step(spin);
      if (out.at(-1)?.step === s) out.at(-1)!.hits.push(...hits);
      else out.push({ step: s, hits });
      afterTick?.(this, hits);
    }
    return out;
  }

  /** The whole state as a string: two sims that agree here will agree forever. */
  fingerprint(): string {
    return JSON.stringify([this.tick, this.angle, this.rng, this.balls]);
  }
}

/** The drum as drawn at one tick. */
export interface DrumPicture {
  tick: number;
  angle: number;
  balls: { track: number; x: number; y: number }[];
  /** The balls that hit a wall on this tick. */
  hit: number[];
}

/** Where a clock is at `seconds`, in cycles, and when it reaches `cycle`. */
export const cycleAt = (clock: LinearClock, seconds: number) =>
  clock.cycle + (seconds - clock.seconds) * clock.cps;
export const secondsAt = (clock: LinearClock, cycle: number) =>
  clock.seconds + (cycle - clock.cycle) / clock.cps;

/**
 * How far ahead of the audio a note is scheduled. The simulation runs this plus half a step ahead (a
 * step's hits are only all known once its last tick is simulated), which is how long a shake takes to
 * be heard; enough to ride over a dropped frame or two.
 */
export const PLAY_AHEAD_S = 0.12;
/** A note closer than this to now is not scheduled (it could not be heard on time). */
const MIN_AHEAD_S = 0.01;

/** A note the tombola plays: the row, the step it was snapped to, and when it sounds. */
export interface LiveNote {
  track: number;
  step: number;
  seconds: number;
}

/**
 * Plays the drum live, on one device: called every frame with the clock (the song's, or a free one
 * while it is stopped) and the audio time, it simulates just ahead of the audio and hands back the
 * notes to schedule, each snapped to its step. Nothing goes over the network: a take records what it
 * plays. What is drawn is the drum at the moment being heard, not the one ahead.
 */
export class TombolaPlayer {
  readonly sim: TombolaSim;
  /** The next step to decide; undefined until the first update. */
  private next: number | undefined;
  private pictures: DrumPicture[] = [];

  constructor(seed: number, balls: readonly number[]) {
    this.sim = new TombolaSim(seed, balls, 0);
  }

  update(clock: LinearClock, now: number, stepsPerMeasure: number, spin: number): LiveNote[] {
    const spm = stepsPerMeasure;
    if (!(spm > 0) || !(clock.cps > 0) || !Number.isFinite(now)) return [];
    const stepTime = (step: number) => secondsAt(clock, step / spm);
    let next = this.next;
    if (next === undefined || stepTime(next) < now - 0.5 || stepTime(next) > now + 2) {
      // starting, or the clock jumped (a hidden tab, a resync, a new tempo): carry on from now
      next = Math.ceil(cycleAt(clock, now + MIN_AHEAD_S) * spm);
      this.sim.tick = firstTickOf(next);
      this.pictures = [];
    }
    const notes: LiveNote[] = [];
    while (stepTime(next) <= now + PLAY_AHEAD_S) {
      for (const { step, hits } of this.sim.advanceTo(next, spin, (sim, hits) =>
        this.picture(sim, hits)
      )) {
        const seconds = stepTime(step);
        if (seconds < now + MIN_AHEAD_S) continue; // too late to be heard on its step
        for (const track of new Set(hits.map((h) => h.track))) notes.push({ track, step, seconds });
      }
      next++;
    }
    this.next = next;
    // forget what has been shown
    const keepFrom = Math.floor(cycleAt(clock, now) * spm * TICKS_PER_STEP) - 2 * TICKS_PER_STEP;
    const first = this.pictures.findIndex((p) => p.tick >= keepFrom);
    if (first > 0) this.pictures.splice(0, first);
    return notes;
  }

  private picture(sim: TombolaSim, hits: Hit[]) {
    this.pictures.push({
      tick: sim.tick - 1,
      angle: sim.angle,
      balls: sim.balls.map(({ track, x, y }) => ({ track, x, y })),
      hit: hits.map((h) => h.track)
    });
  }

  /** The drum at the moment being heard (`now`), or undefined before anything was simulated. */
  view(clock: LinearClock, now: number, stepsPerMeasure: number): DrumPicture | undefined {
    const pics = this.pictures;
    if (!pics.length) return undefined;
    const tick = Math.floor(cycleAt(clock, now) * stepsPerMeasure * TICKS_PER_STEP);
    const i = tick - pics[0].tick; // one picture per tick, in order
    return pics[Math.min(Math.max(i, 0), pics.length - 1)];
  }

  setBalls(balls: readonly number[]) {
    this.sim.setBalls(balls);
  }
  /** Throw the balls about, from the simulation's front: heard about PLAY_AHEAD_S later. */
  shake() {
    this.sim.shake();
  }
}
