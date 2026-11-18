import { describe, expect, test, vi } from 'vitest';
import { monitorNote, previewCode, previewData } from './monitor';
import { PianoScale } from './instruments/MonoSynth';
import { Drum } from './instruments/Drum';
import {
  getPart,
  makePartData,
  MonoSequence,
  PartFilter,
  PartTrackNotes,
  PartVoice,
  DEFAULT_SCALE
} from './parts.svelte';

const piano = new PianoScale();
const drum = new Drum();

describe('previewData', () => {
  test('a melody holding only that note on its first step, with every other part kept', () => {
    const data = piano.createData();
    const one = previewData(piano, data, 5)!;
    expect(getPart(MonoSequence, one)!.notes).toEqual([5]);
    expect(getPart(PartVoice, one)).toEqual(getPart(PartVoice, data));
    expect(one.parts.map((p) => p.partName)).toEqual(data.parts.map((p) => p.partName));
  });
  test('a drum hit on that track only', () => {
    const one = previewData(drum, drum.createData(), 1)!; // bd, sd...
    const notes = getPart(PartTrackNotes, one)!.notes;
    expect(Object.entries(notes).filter(([, v]) => v.includes(1))).toEqual([['sd', [1]]]);
  });
  test('never touches the song', () => {
    const data = piano.createData();
    const before = JSON.stringify(data);
    previewData(piano, data, 2);
    expect(JSON.stringify(data)).toBe(before);
  });
  test('no note for a track that is not a row', () => {
    const data = piano.createData();
    expect(previewData(piano, data, -1)).toBeUndefined();
    expect(previewData(piano, data, 8)).toBeUndefined();
    expect(previewData(piano, data, 1.5)).toBeUndefined();
  });
});

describe('previewCode', () => {
  test('the instrument code with the one note, and the length of one step', () => {
    const data = piano.createData(); // 8 steps per measure, 2 measures
    data.parts.push(makePartData(PartFilter));
    const preview = previewCode(piano, data, DEFAULT_SCALE, 3)!;
    expect(preview.window).toBe(1 / 8);
    expect(preview.code).toContain(`n("<3 ${Array(15).fill('~').join(' ')}>")`);
    expect(preview.code).toContain('.lpf(');
    expect(preview.code).toContain('.sound("sawtooth")');
  });
});

describe('monitorNote', () => {
  test('hands the one-note code to the player', () => {
    const player = { playOnce: vi.fn() };
    expect(monitorNote(player, piano, piano.createData(), DEFAULT_SCALE, 0)).toBe(true);
    expect(player.playOnce).toHaveBeenCalledWith(expect.stringContaining('n("<0 '), 1 / 8);
  });
  test('plays nothing for a track that is not a row', () => {
    const player = { playOnce: vi.fn() };
    expect(monitorNote(player, piano, piano.createData(), DEFAULT_SCALE, 99)).toBe(false);
    expect(player.playOnce).not.toHaveBeenCalled();
  });
});
