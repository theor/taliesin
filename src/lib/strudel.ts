import { initStrudel, getAudioContext } from '@strudel/web';
// import { webaudioRepl,  initAudioOnFirstClick } from '@strudel/webaudio';
import { get, writable, type Writable } from 'svelte/store';

// initStrudel({
//     prebake: () => samples('github:tidalcycles/dirt-samples'),
//   });
// initAudioOnFirstClick();

// const asChords  = function(triads:any, pat:any) {
//     return pat.fmap( (x:any)=> {
//       const [pc,acc,oct] =  tokenizeNote(x.note)
//       const {note,  ...prev} = x;
//       return {...prev, chord:pc+acc+triads, anchor: x.note}
//     })
//   }
// Pattern.prototype.asChords = function(...args:any[])  { return asChords(...args,this);  }
// let repls : Repl;

// async function initStrudel() {

//     await evalScope(import('@strudel/core'), import('@strudel/mini'), import('@strudel/webaudio'), import('@strudel/tonal'));
//     repls = repl({

//       defaultOutput: webaudioOutput,
//       getTime: () => ctx.currentTime,
//       transpiler,
//     });
//     console.log(repls);

//     console.log('Strudel initialized!');
// }

export const VITEST = import.meta.env?.VITEST || false;
let clear: NodeJS.Timeout;
function setupInterval() {
  if (!VITEST)
    clear = setInterval(() => {
      strudel.updateTime();
    }, 250);
}
setupInterval();

if (import.meta.hot) {
  // HMR specific stuff...
  // console.log('Strudel HMR enabled!', import.meta.hot);

  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('Strudel HMR dispose  !');
    // increment the value on HMR update (for illustration purpose)
    // NOTE mutate the passed data object
    strudel.repls.stop();
    clearInterval(clear);
    setupInterval();
  });
}
class StrudelWrapper {
  repls: webaudioRepl;
  private initPromise: Promise<void>;
  async evaluate(code: string): Promise<void> {
    if (code === '') return Promise.resolve();
    await this.initPromise;
    // console.log(
    // console.log('Strudel evaluate!', this.repls);
    // Strudel's evaluate() starts playback by default. Only (re)start when we are meant to be playing,
    // otherwise loading the page or editing while stopped would play audio while the UI says "stopped".
    // Only the very first successful evaluation unblocks start(): it needs a pattern.
    const done = await this.repls.evaluate(
      `samples('github:tidalcycles/dirt-samples')
const asChords = register("asChords", function(triads, pat) {
  return pat.fmap( x=> {
    const [pc,acc,oct] =  tokenizeNote(x.note)
    const {note,  ...prev} = x;
    return {...prev, chord:pc+acc+triads, anchor: x.note}
  })
});
Pattern.prototype.asChords = function(...args)  { return asChords(...args,this);  }
${code}`,
      get(this.isPlaying)
    );
    if (done) this.resolveFirstEval();

    // console.log('Strudel evaluate!', this.repls.state.code);
    // return repls.evaluate(`${code}`)
    // );
  }
  isPlaying: Writable<boolean> = writable(false);
  /** False while the browser keeps the AudioContext suspended (before the first user gesture). */
  audioRunning: Writable<boolean> = writable(false);
  private firstEval: Promise<void>;
  private resolveFirstEval!: () => void;
  // set when the scheduler is started, so now() can tell "no tick yet" from a real position
  private startedAt = 0;
  private startCycle = 0;
  /**
   *
   */
  constructor() {
    this.firstEval = new Promise((resolve) => (this.resolveFirstEval = resolve));
    this.initPromise = (async () => {
      this.repls = await initStrudel({
        prebake: () => samples('github:tidalcycles/dirt-samples')
      });
      const ctx = getAudioContext();
      const update = () => this.audioRunning.set(ctx.state === 'running');
      ctx.addEventListener('statechange', update);
      update();
      console.log('Strudel initialized!', this.repls);
    })();
  }

  /** Browsers only allow audio after a user gesture; call this from a click handler. */
  async unlockAudio() {
    await this.initPromise;
    await getAudioContext().resume();
  }
  /** Audio output delay in seconds (speakers vs bluetooth differ a lot). */
  get outputLatency(): number {
    try {
      const ctx = getAudioContext();
      return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
    } catch {
      return 0;
    }
  }
  /**
   * The scheduler's current cycle: read live, and the same quantity on every peer (Strudel's lookahead
   * cancels out when peers compare it). 0 when stopped.
   */
  now(): number {
    const s = this.repls?.scheduler;
    if (!s?.started) return 0;
    // between start() and the first tick, scheduler.now() still reflects the previous run
    if (s.lastTick < this.startedAt) return this.startCycle;
    return s.now();
  }
  private markStart(cycle: number) {
    this.startedAt = getAudioContext().currentTime;
    this.startCycle = cycle;
  }
  /**
   * Start playing at the cycle `target()` returns, once the audio is running and a pattern exists.
   * `target` is evaluated at the last moment (after waiting for the audio unlock), and may return
   * undefined to cancel (e.g. the host stopped meanwhile).
   */
  async start(target: () => number | undefined): Promise<void> {
    await this.initPromise;
    await this.firstEval;
    await getAudioContext().resume(); // pending until the user has interacted with the page
    const cycle = target();
    const s = this.repls.scheduler;
    if (cycle === undefined || s.started) return;
    s.stop(); // resets the scheduler; the first tick after start() begins at lastEnd
    s.lastEnd = s.lastBegin = cycle;
    this.markStart(cycle);
    await s.start();
    this.isPlaying.set(true);
  }
  /** Jump the running scheduler by `delta` cycles (keeps already-scheduled notes consistent). */
  shift(delta: number) {
    const s = this.repls?.scheduler;
    if (!s?.started) return;
    s.num_cycles_at_cps_change += delta;
    s.lastEnd += delta;
    s.lastBegin += delta;
  }
  time = writable(0);
  /** Cycles per second of the running scheduler (Strudel's default is 0.5). */
  get cps(): number {
    return this.repls?.scheduler?.cps ?? 0.5;
  }
  updateTime() {
    // return ctx.currentTime;
    if (!this.repls?.scheduler) return;
    const sched = this.repls.scheduler;
    this.time.set(this.now());
    // return this.repls.scheduler.clock.getPhase();
    // return this.repls.scheduler.getTime();
  }

  stop() {
    console.log('Strudel stopped!');
    this.repls.stop();
    this.isPlaying.set(false);
  }
  // get isPlaying(): boolean { return repls.state.started}
  async toggle() {
    console.log('Strudel toggled!', this.repls);
    if (this.repls.state.started) {
      this.repls.stop();
      this.isPlaying.set(false);
    } else {
      if (!this.repls.state.pattern) await this.repls.evaluate(`note("c a f e g a")`);
      this.markStart(this.repls.scheduler.lastEnd);
      this.repls.start();
      this.isPlaying.set(true);
    }
  }
}
export const strudel = VITEST
  ? ({
      time: writable(0),
      isPlaying: writable(false),
      audioRunning: writable(true),
      cps: 0.5,
      outputLatency: 0,
      now: () => 0,
      start: async () => {},
      shift: () => {},
      unlockAudio: async () => {},
      evaluate: async () => {},
      stop() {
        (this as any).isPlaying.set(false);
      },
      async toggle() {
        const p = (this as any).isPlaying;
        p.update((x: boolean) => !x);
      }
    } as unknown as StrudelWrapper)
  : new StrudelWrapper();
