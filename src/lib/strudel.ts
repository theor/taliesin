import { initStrudel, evaluate } from '@strudel/web';
import {
  webaudioRepl,
  getAudioContext,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import {Pattern} from '@strudel/core';
import { writable, type Writable } from 'svelte/store';


// initStrudel({
//     prebake: () => samples('github:tidalcycles/dirt-samples'),
//   });
const ctx = getAudioContext();
initAudioOnFirstClick();


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

if (import.meta.hot) {
  // HMR specific stuff...
  console.log('Strudel HMR enabled!', import.meta.hot);

  import.meta.hot.on('vite:beforeUpdate', () => {
    console.log('Strudel HMR dispose  !');
    // increment the value on HMR update (for illustration purpose)
    // NOTE mutate the passed data object
    strudel.repls.stop();
  });
}
class StrudelWrapper {
  repls: webaudioRepl;
  async evaluate(code: string): Promise<void> {
    if (code === '') return Promise.resolve();
    // console.log(
console.log('Strudel evaluate!', this.repls);
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

console.log('Strudel evaluate!', this.repls.state.code);
    // return repls.evaluate(`${code}`)
    // );
  }
  isPlaying: Writable<boolean> = writable(false);
  /**
   *
   */
  constructor() {
    (async () => {
        this.repls = await initStrudel({
            prebake: () => samples('github:tidalcycles/dirt-samples')
          });
    })();
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
export const strudel = new StrudelWrapper();
