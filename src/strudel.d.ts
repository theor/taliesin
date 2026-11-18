// @strudel/web ships no types. Only what we use is declared.
declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<any>;
  export function getAudioContext(): AudioContext;
  /** Turns Strudel code into plain JavaScript (mini-notation strings, a `return` on the last expression). */
  export function transpiler(
    code: string,
    options?: { emitMiniLocations?: boolean; emitWidgets?: boolean; addReturn?: boolean }
  ): { output: string };
  /** Plays one event's value `t` seconds from now (or at `"=<time>"`), for `duration` seconds. */
  export function superdough(
    value: Record<string, unknown>,
    t: number | string,
    duration: number
  ): Promise<void>;
}

/** Global injected by Strudel's `evalScope`, used in the prebake. */
declare function samples(...args: any[]): any;

declare module '@strudel/soundfonts' {
  export function registerSoundfonts(): void;
}

declare module 'vite-plugin-bundle-audioworklet' {
  import type { Plugin } from 'vite';
  export default function bundleAudioWorklet(): Plugin;
}
