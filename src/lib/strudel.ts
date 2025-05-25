import { initStrudel, evaluate } from '@strudel/web';
import {
  getAudioContext,
  initAudioOnFirstClick,
} from '@strudel/webaudio';
import { writable, type Writable } from 'svelte/store';
import { webaudioRepl } from '@strudel/webaudio';

// initStrudel({
//     prebake: () => samples('github:tidalcycles/dirt-samples'),
//   });
const ctx = getAudioContext();
initAudioOnFirstClick();

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
  evaluate(code: string): Promise<void> {
    if (code === '') return Promise.resolve();
    console.log('Strudel evaluate!', code);
    // console.log(
    return evaluate(`samples('github:tidalcycles/dirt-samples')\n${code}`);
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
