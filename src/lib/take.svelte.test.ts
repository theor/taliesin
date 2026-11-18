import { describe, expect, test } from 'vitest';
import { Take, beatsPerBar, loadTakeOptions, type TakeOptions } from './take.svelte';
import type { Command } from './commands';
import type { Quantize } from './recorder';

/**
 * A take over a fake song: 2 tracks, 4 steps per measure, 2 measures (8 steps). The song's cells are
 * a set the dispatched commands apply to, and the clock is whatever the test sets.
 */
function make(
  opts: Partial<TakeOptions> = {},
  quantize: Quantize = { resolution: 1, mode: 'floor' }
) {
  let t = 0;
  let playing = true;
  const cells = new Set<string>();
  const commands: Command[] = [];
  const options: TakeOptions = { oldNotes: 'replace', loop: false, ...opts };
  const take = new Take({
    instrumentId: 'i1',
    dispatch: (cmd) => {
      commands.push(cmd);
      if (cmd.type !== 'setCells') return;
      for (const c of cmd.cells) {
        if (c.on) cells.add(`${cmd.track}:${c.step}`);
        else cells.delete(`${cmd.track}:${c.step}`);
      }
    },
    now: () => t,
    playing: () => playing,
    length: () => ({ stepsPerMeasure: 4, measures: 2 }),
    quantize: () => quantize,
    tracks: () => 2,
    isOn: (track, step) => cells.has(`${track}:${step}`),
    options: () => options
  });
  /** Move the clock to song step `step` (a quarter of a cycle each) and tick, as each frame does. */
  const at = (step: number) => {
    t = step / 4;
    return take.tick();
  };
  const fill = () => {
    for (let s = 0; s < 8; s++) cells.add(`0:${s}`);
  };
  const on = () => [...cells].sort();
  return {
    take,
    at,
    fill,
    on,
    commands,
    options,
    stopSong: () => (playing = false)
  };
}

describe('Take', () => {
  test('arming waits for the next measure, then records for one loop and stops', () => {
    const { take, at } = make();
    at(1); // in measure 0
    expect(take.arm()).toBe(true);
    expect(take.phase).toBe('armed');
    expect(at(3)).toBe('armed');
    expect(take.hit(1)).toBeUndefined(); // before the take: not recorded
    expect(at(4)).toBe('recording'); // measure 1 starts
    expect(at(11)).toBe('recording');
    expect(at(12)).toBe('idle'); // one loop (8 steps) later
  });

  test('cannot arm while the song is stopped', () => {
    const { take, stopSong } = make();
    stopSong();
    expect(take.arm()).toBe(false);
    expect(take.phase).toBe('idle');
  });

  test('hits during the take land on loop steps, wrapped round the loop', () => {
    const { take, at, on } = make();
    at(1);
    take.arm(); // starts at song step 4, ends at 12
    at(5);
    expect(take.hit(1)).toBe(5);
    at(9);
    expect(take.hit(1)).toBe(1); // song step 9 is loop step 1
    expect(on()).toEqual(['1:1', '1:5']);
  });

  test('a hit on a known step (the tombola) is recorded if the take covers that step', () => {
    const { take, at, on } = make();
    at(1);
    take.arm(); // song steps 4 to 11
    at(4);
    expect(take.hitAt(0, 3)).toBeUndefined(); // before the take
    expect(take.hitAt(0, 4)).toBe(4);
    expect(take.hitAt(1, 10)).toBe(2); // ahead of the playhead, wrapped round the loop
    expect(take.hitAt(1, 12)).toBeUndefined(); // after it
    expect(on()).toEqual(['0:4', '1:2']);
  });

  test('an early hit that rounds into the first step counts', () => {
    const { take, at } = make({}, { resolution: 1, mode: 'nearest' });
    at(1);
    take.arm();
    at(3.8); // just before the take: rounds to step 4
    expect(take.hit(0)).toBe(4);
  });

  test('step by step: the old pattern is cleared just ahead of the playhead, not all at once', () => {
    const { take, at, fill, on } = make();
    fill(); // track 0 on everywhere
    at(1);
    take.arm();
    at(2); // two steps before the take: nothing yet
    expect(on()).toHaveLength(8);
    at(3); // one step before: the take's first step is cleared, so its old note never sounds
    expect(on()).not.toContain('0:4');
    expect(on()).toHaveLength(7);
    at(6); // steps 4..7 cleared
    expect(on()).toEqual(['0:0', '0:1', '0:2', '0:3']);
    at(12); // the whole loop by the end
    expect(on()).toEqual([]);
  });

  test('clearing never removes what the take recorded', () => {
    const { take, at, fill, on } = make({}, { resolution: 1, mode: 'nearest' });
    fill();
    at(1);
    take.arm();
    at(4);
    take.hit(1);
    at(5.8);
    take.hit(0); // early for step 6, before the playhead clears it
    at(12);
    expect(on()).toEqual(['0:6', '1:4']);
  });

  test('clear at start: the whole loop goes just before the take, in one command per track', () => {
    const { take, at, fill, on, commands } = make({ oldNotes: 'clearFirst' });
    fill();
    at(1);
    take.arm();
    at(2);
    expect(on()).toHaveLength(8);
    at(3);
    expect(on()).toEqual([]);
    expect(commands).toHaveLength(1); // only track 0 had cells on
    at(6);
    expect(commands).toHaveLength(1);
  });

  test('only cells that are on are turned off (no needless commands)', () => {
    const { take, at, commands } = make();
    at(1);
    take.arm();
    at(12);
    expect(commands).toEqual([]);
  });

  test('looping keeps recording pass after pass, adding to the first one without clearing', () => {
    const { take, at, fill, on, options } = make({ loop: true });
    fill();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    at(12); // the second pass
    expect(take.phase).toBe('recording');
    expect(take.pass).toBe(1);
    at(14);
    expect(take.hit(1)).toBe(6);
    at(20);
    expect(take.pass).toBe(2);
    expect(on()).toEqual(['1:5', '1:6']);
    options.loop = false; // turning it off ends the take at the end of this pass
    expect(at(28)).toBe('idle');
  });

  test('stopping the take, or the song, ends it', () => {
    const { take, at, stopSong } = make();
    at(1);
    take.arm();
    take.stop();
    expect(take.phase).toBe('idle');
    take.arm();
    at(5);
    stopSong();
    expect(at(6)).toBe('idle');
    expect(take.hit(0)).toBeUndefined();
  });

  test('progress runs from 0 to 1 over the take', () => {
    const { take, at } = make();
    at(1);
    take.arm();
    expect(take.measuresToStart()).toBeCloseTo(0.75);
    at(8);
    expect(take.progress()).toBeCloseTo(0.5);
  });

  test('keep (overdub): nothing is cleared, the take adds on top', () => {
    const { take, at, fill, on, commands } = make({ oldNotes: 'keep' });
    fill();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    at(12);
    expect(commands).toHaveLength(1);
    expect(on()).toHaveLength(9);
  });

  test('undo puts the loop back as it was, turning cells off before turning them on', () => {
    const { take, at, fill, on, commands } = make();
    fill();
    const before = on();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    at(9);
    take.hit(0); // re-records a cleared old note
    at(12);
    expect(take.canUndo).toBe(true);
    expect(take.result).toEqual({ notes: 2 });
    const sent = commands.length;
    expect(take.undo()).toBe(true);
    expect(on()).toEqual(before);
    const undo = commands.slice(sent) as Extract<Command, { type: 'setCells' }>[];
    expect(undo.map((c) => c.cells[0].on)).toEqual([false, true]); // track 1 off, then track 0 on
    expect(take.canUndo).toBe(false);
    expect(take.result).toBeUndefined();
  });

  test('nothing to undo after a take that changed nothing, or while it runs', () => {
    const { take, at } = make();
    at(1);
    take.arm();
    at(5);
    take.hit(0);
    expect(take.canUndo).toBe(false); // still recording
    take.stop();
    expect(take.canUndo).toBe(true);
    take.arm();
    at(9);
    take.stop(); // armed and stopped before it did anything
    expect(take.canUndo).toBe(false);
  });

  test('stopping mid-take keeps what was played', () => {
    const { take, at, on } = make();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    take.stop();
    expect(on()).toEqual(['1:5']);
    expect(take.result).toEqual({ notes: 1 });
  });

  test('cell states: old, cleared ahead of the playhead, new from the take', () => {
    const { take, at, fill } = make();
    fill();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    expect(take.cellState(1, 5)).toBe('new');
    expect(take.cellState(0, 6)).toBe('cleared'); // cleared one step ahead, not played yet
    expect(take.cellState(0, 4)).toBe('off'); // cleared and passed
    expect(take.cellState(0, 7)).toBe('old');
    at(12);
    expect(take.cellState(1, 5)).toBe('new');
  });

  test('a later pass shows no cleared notes: the first pass already replaced them', () => {
    const { take, at, fill } = make({ loop: true });
    fill();
    at(1);
    take.arm();
    at(6);
    expect(take.cellState(0, 7)).toBe('cleared');
    at(13); // pass 2, at loop step 5: steps 6, 7 are ahead again, but were cleared last pass
    expect(take.pass).toBe(1);
    expect(take.cellState(0, 7)).toBe('off');
  });

  test('a finished take still shows its notes, until the next take', () => {
    const { take, at } = make();
    at(1);
    take.arm();
    at(5);
    take.hit(1);
    at(12);
    expect(take.cellState(1, 5)).toBe('new'); // still shown as the take's after it ends
    take.arm();
    expect(take.cellState(1, 5)).toBe('old'); // a new take starts from scratch
  });

  test('the count-in counts a bar in whole beats', () => {
    expect([4, 8, 16, 6, 3, 2, 7].map(beatsPerBar)).toEqual([4, 4, 4, 3, 3, 2, 1]);
  });

  test('options saved before "keep" existed still load', () => {
    localStorage.setItem('taliesin:take', JSON.stringify({ clearAtStart: true, loop: true }));
    expect(loadTakeOptions()).toEqual({ oldNotes: 'clearFirst', loop: true });
    localStorage.setItem('taliesin:take', JSON.stringify({ oldNotes: 'nonsense' }));
    expect(loadTakeOptions()).toEqual({ oldNotes: 'replace', loop: false });
    localStorage.clear();
  });
});
