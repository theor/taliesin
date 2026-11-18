import { get, writable } from 'svelte/store';

/**
 * Records what the audio engine was asked to do, so tests can assert on it without audio.
 * `now()` reads `time` (tests set it directly); with `{ clocked: true }` it instead models a real
 * scheduler: it advances with `performance.now()` while started (fake timers drive it in tests).
 * `{ locked: true }` models a browser that has not allowed audio yet: start() waits for `unlock()`.
 */
export function fakePlayer(
  opts: { clocked?: boolean; locked?: boolean; outputLatency?: number } = {}
) {
  const isPlaying = writable(false);
  const calls: string[] = [];
  let base = 0; // clocked mode: cycle at `since`
  let since = 0;
  let unlock: () => void = () => {};
  let unlocked = new Promise<void>((resolve) => (unlock = resolve));
  if (!opts.locked) unlock();
  const player = {
    isPlaying,
    time: writable(0),
    cps: 0.5,
    outputLatency: opts.outputLatency ?? 0,
    calls,
    /** every `start(target)` result, to assert where playback began */
    startedAt: [] as number[],
    unlock: () => unlock(),
    isPlayingNow: () => get(isPlaying),
    now(): number {
      if (!opts.clocked) return get(player.time);
      if (!get(isPlaying)) return 0;
      return base + ((performance.now() - since) / 1000) * player.cps;
    },
    /** clocked mode: move the scheduler by hand, as if it had drifted */
    drift(cycles: number) {
      base = player.now() + cycles;
      since = performance.now();
    },
    /** clocked mode: the cycle a toggle()/start from stopped begins at */
    startCycle: 0,
    toggle() {
      calls.push('toggle');
      if (!get(isPlaying)) {
        base = player.startCycle;
        since = performance.now();
      }
      isPlaying.update((x) => !x);
    },
    stop() {
      calls.push('stop');
      isPlaying.set(false);
    },
    async start(target: () => number | undefined) {
      calls.push('start');
      await unlocked;
      const at = target();
      if (at === undefined || get(isPlaying)) return;
      base = at;
      since = performance.now();
      player.startedAt.push(at);
      isPlaying.set(true);
    },
    shift(delta: number) {
      calls.push(`shift`);
      base += delta;
    },
    /** as Strudel's scheduler: the position carries on, then advances at the new rate */
    setCps(cps: number) {
      calls.push(`cps:${cps}`);
      if (opts.clocked && get(isPlaying)) {
        base = player.now();
        since = performance.now();
      }
      player.cps = cps;
    }
  };
  return player;
}
