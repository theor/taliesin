import { describe, expect, test } from 'vitest';
import { applySongCommand, type Command, type Env, type SongCommand } from './commands';
import { createInstrument, getInstrument } from './Store.svelte';
import { Drum } from './instruments/Drum';
import { PianoScale } from './instruments/MonoSynth';
import {
  DEFAULT_SCALE,
  getPart,
  getPartType,
  makePartData,
  MonoSequence,
  PartTrackNotes
} from './parts.svelte';
import { defaultBalls, drawTombola, rollDue, tombolaCommands } from './tombola';

/** A seeded random source, so draws can be checked. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const env: Env = {
  sequencerFor: (data) => getInstrument(data)?.sequencer,
  instrumentInput: (name) => ({ PianoScale: 'MonoSequence', Drum: 'PartTrackNotes' })[name],
  partType: getPartType,
  canAddPart: () => false
};
const apply = (data: ReturnType<typeof createInstrument>, cmds: Command[]) => {
  const song = { instrumentsData: [data], volume: 1, scale: DEFAULT_SCALE };
  for (const cmd of cmds) expect(applySongCommand(song, cmd as SongCommand, env)).toBe(true);
  return song.instrumentsData[0];
};

describe('drawTombola', () => {
  test('only balls, one per step at most, about as often as the spin says', () => {
    const draw = drawTombola([0, 2, 4], 0.5, 4000, mulberry32(1));
    expect(draw).toHaveLength(4000);
    expect(new Set(draw.filter((d) => d !== undefined))).toEqual(new Set([0, 2, 4]));
    const hits = draw.filter((d) => d !== undefined).length / draw.length;
    expect(hits).toBeGreaterThan(0.45);
    expect(hits).toBeLessThan(0.55);
  });
  test('full spin hits every step; no spin or no balls rests', () => {
    expect(drawTombola([1], 1, 8)).toEqual(Array(8).fill(1));
    expect(drawTombola([1, 2], 0, 8)).toEqual(Array(8).fill(undefined));
    expect(drawTombola([], 1, 8)).toEqual(Array(8).fill(undefined));
  });
  test('more spin only adds hits to the same draw', () => {
    const low = drawTombola([0, 3, 5], 0.3, 64, mulberry32(7));
    const high = drawTombola([0, 3, 5], 0.8, 64, mulberry32(7));
    low.forEach((d, i) => d !== undefined && expect(high[i]).toBe(d));
  });
});

describe('tombolaCommands', () => {
  test('on a melody the draw becomes the whole loop', () => {
    const data = createInstrument(PianoScale, [
      makePartData(MonoSequence, { notes: [1, 6, 3, 2, 4, 5, 3, 6] })
    ]);
    const steps = 16; // the default loop: 8 steps, 2 measures
    const draw = drawTombola([0, 4], 0.6, steps, mulberry32(3));
    const seq = getInstrument(data)!.sequencer!;
    const after = apply(data, tombolaCommands(seq, data, [0, 4], draw));
    expect(getPart(MonoSequence, after)!.notes.slice(0, steps)).toEqual(draw);
  });
  test('on drums only the ball rows change', () => {
    const data = createInstrument(Drum);
    const kick = [...getPart(PartTrackNotes, data)!.notes.bd];
    const seq = getInstrument(data)!.sequencer!;
    const hh = seq.tracks.indexOf('hh');
    const sd = seq.tracks.indexOf('sd');
    const draw = [hh, sd, undefined, hh, hh, undefined, sd, hh];
    const after = apply(data, tombolaCommands(seq, data, [sd, hh], draw));
    const notes = getPart(PartTrackNotes, after)!.notes;
    expect(notes.bd).toEqual(kick);
    expect(notes.hh).toEqual([1, 0, 0, 1, 1, 0, 0, 1]);
    expect(notes.sd).toEqual([0, 1, 0, 0, 0, 0, 1, 0]);
  });
  test('sends nothing when the pattern already plays the draw', () => {
    const data = createInstrument(PianoScale, [
      makePartData(MonoSequence, { notes: [0, undefined, 4, 4] })
    ]);
    const seq = getInstrument(data)!.sequencer!;
    expect(tombolaCommands(seq, data, [0, 4], [0, undefined, 4, 4])).toEqual([]);
  });
});

describe('defaultBalls', () => {
  test('the rows the pattern uses, else a triad', () => {
    const synth = createInstrument(PianoScale, [
      makePartData(MonoSequence, { notes: [1, 3, 1, 5] })
    ]);
    expect(defaultBalls(getInstrument(synth)!.sequencer!, synth, 16)).toEqual([1, 3, 5]);
    const empty = createInstrument(PianoScale, [makePartData(MonoSequence, { notes: [] })]);
    expect(defaultBalls(getInstrument(empty)!.sequencer!, empty, 16)).toEqual([0, 2, 4]);
  });
});

describe('rollDue', () => {
  test('once per loop, on its last step', () => {
    // 4 steps a measure, 2 measures: the last step starts at 1.75 cycles
    expect(rollDue(1.7, 4, 2, undefined)).toBeUndefined();
    expect(rollDue(1.8, 4, 2, undefined)).toBe(0);
    expect(rollDue(1.9, 4, 2, 0)).toBeUndefined();
    expect(rollDue(3.8, 4, 2, 0)).toBe(1);
  });
});
