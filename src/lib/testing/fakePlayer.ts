import { writable } from 'svelte/store';

/** Records what the audio engine was asked to do, so tests can assert on it without audio. */
export function fakePlayer() {
  const isPlaying = writable(false);
  const calls: string[] = [];
  return {
    isPlaying,
    time: writable(0),
    cps: 0.5,
    calls,
    toggle() {
      calls.push('toggle');
      isPlaying.update((x) => !x);
    },
    stop() {
      calls.push('stop');
      isPlaying.set(false);
    }
  };
}
