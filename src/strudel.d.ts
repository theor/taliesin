// @strudel/web ships no types. Only what we use is declared.
declare module '@strudel/web' {
  export function initStrudel(options?: Record<string, unknown>): Promise<any>;
  export function getAudioContext(): AudioContext;
}

/** Global injected by Strudel's `evalScope`, used in the prebake. */
declare function samples(...args: any[]): any;
