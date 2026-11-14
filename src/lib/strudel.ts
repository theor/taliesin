import { initStrudel  } from '@strudel/web';
// import { webaudioRepl,  initAudioOnFirstClick } from '@strudel/webaudio';
import { writable, type Writable } from 'svelte/store';

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
    await this.repls.evaluate(`samples('github:tidalcycles/dirt-samples')
const asChords = register("asChords", function(triads, pat) {
  return pat.fmap( x=> {
    const [pc,acc,oct] =  tokenizeNote(x.note)
    const {note,  ...prev} = x;
    return {...prev, chord:pc+acc+triads, anchor: x.note}
  })
});
Pattern.prototype.asChords = function(...args)  { return asChords(...args,this);  }
${code}`);

    // console.log('Strudel evaluate!', this.repls.state.code);
    // return repls.evaluate(`${code}`)
    // );
  }
  isPlaying: Writable<boolean> = writable(false);
  /**
   *
   */
  constructor() {
    this.initPromise = (async () => {
      this.repls = await initStrudel({
        prebake: () => samples('github:tidalcycles/dirt-samples')
      });
      console.log('Strudel initialized!', this.repls);
    })();
  }
  time = writable(0);
  /** Cycles per second of the running scheduler (Strudel's default is 0.5). */
  get cps(): number {
    return this.repls?.scheduler?.cps ?? 0.5;
  }
  updateTime() {
    // return ctx.currentTime;
    if(!this.repls?.scheduler) return;
    const sched = this.repls.scheduler;
    const duration = sched.clock.duration;
    const seconds_since_cps_change = sched.num_ticks_since_cps_change * duration;
    const num_cycles_since_cps_change = seconds_since_cps_change * sched.cps;
    this.time.set(num_cycles_since_cps_change);
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
      this.repls.start();
      this.isPlaying.set(true);
    }
  }
}
export const strudel = VITEST ? {
  time: writable(0),
  isPlaying: writable(false),
  cps: 0.5,
  evaluate: async () => {},
  stop() { (this as any).isPlaying.set(false); },
  async toggle() { const p = (this as any).isPlaying; p.update((x: boolean) => !x); },
} as unknown as StrudelWrapper : new StrudelWrapper();
