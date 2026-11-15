import { describe, expect, test, vi } from 'vitest';
import { AppStore } from './Store.svelte.js';
import { getPart, TrackState, type InstrumentData } from './instruments.js';
import { MonoSequence, PartSteps, PartTrackNotes } from './parts.svelte.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { fakePlayer } from './testing/fakePlayer.js';
import {
  canDoubleLoop,
  canHalveLoop,
  clearCommands,
  randomizeCommands,
  resizeLoopCommands,
  setTrackStateCommand
} from './commandBuilders.js';
import { commitStroke, playheadStep, previewStroke } from './gesture.js';
import { degreeName } from './scale.js';

// code generation reads the Svelte context (key / scale), which only exists inside a component
vi.mock('./context', () => ({
  getGlobalContext: () => ({
    host: true,
    debug: false,
    roomId: 'r',
    scaleKey: 'A',
    scaleMode: 'minor'
  }),
  setGlobalContext: () => {}
}));

// Presets are created in this order: Piano (0), Bass (1), Drum (2)
const BASS = 1;
const DRUM = 2;
const solo = () => new AppStore(true, 'r', createFakeNetwork().join('host'), fakePlayer());
const inst = (s: AppStore, i: number): InstrumentData => s.instrumentsData.instrumentsData[i];
const apply = (s: AppStore, cmds: Parameters<AppStore['dispatch']>[0][]) =>
  cmds.forEach(s.dispatch);
const bassNotes = (s: AppStore) => getPart(MonoSequence, inst(s, BASS))!.notes;
const drumNotes = (s: AppStore) =>
  getPart(PartTrackNotes, inst(s, DRUM))!.notes as Record<string, number[]>;

describe('mute and solo', () => {
  test('a state of 0, 1 or 2 is accepted, anything else is ignored', () => {
    const s = solo();
    const id = inst(s, 0).id;
    s.dispatch({
      type: 'setInstrumentFields',
      instrumentId: id,
      fields: { state: TrackState.Muted }
    });
    expect(inst(s, 0).state).toBe(TrackState.Muted);
    for (const state of [3, -1, 1.5, '1' as unknown as number]) {
      s.dispatch({ type: 'setInstrumentFields', instrumentId: id, fields: { state } });
      expect(inst(s, 0).state).toBe(TrackState.Muted);
    }
  });

  test('muted instruments are left out of the song', () => {
    const s = solo();
    const before = s.code();
    s.dispatch(setTrackStateCommand(inst(s, DRUM), TrackState.Muted));
    expect(s.code().match(/\$:/g)).toHaveLength(2);
    expect(s.code()).not.toContain('s("<'); // the drum pattern
    s.dispatch(setTrackStateCommand(inst(s, DRUM), TrackState.Muted)); // again: back to playing
    expect(s.code()).toBe(before);
  });

  test('a solo plays alone, and several solos play together', () => {
    const s = solo();
    s.dispatch(setTrackStateCommand(inst(s, DRUM), TrackState.Solo));
    expect(s.code().match(/\$:/g)).toHaveLength(1);
    s.dispatch(setTrackStateCommand(inst(s, 0), TrackState.Solo));
    expect(s.code().match(/\$:/g)).toHaveLength(2);
  });

  test('muting everything yields silence instead of an empty song (which strudel would ignore)', () => {
    const s = solo();
    for (let i = 0; i < 3; i++) s.dispatch(setTrackStateCommand(inst(s, i), TrackState.Muted));
    expect(s.code()).toBe('$: silence');
  });

  test('an empty song is silent too', () => {
    const s = solo();
    for (const { id } of [...s.instrumentsData.instrumentsData])
      s.dispatch({ type: 'removeInstrument', instrumentId: id });
    expect(s.code()).toBe('$: silence');
  });
});

describe('clear, double, halve', () => {
  test('clear turns every note off', () => {
    const s = solo();
    apply(s, clearCommands(inst(s, DRUM)));
    expect(
      Object.values(drumNotes(s))
        .flat()
        .every((x) => x === 0)
    ).toBe(true);
    apply(s, clearCommands(inst(s, BASS)));
    expect(bassNotes(s).every((x) => x === undefined)).toBe(true);
    expect(clearCommands(inst(s, BASS))).toEqual([]); // nothing left to clear
  });

  test('doubling repeats the pattern into the new half', () => {
    const s = solo();
    const before = [...drumNotes(s).sd];
    expect(before).toHaveLength(8);
    apply(s, resizeLoopCommands(inst(s, DRUM), 'double'));
    expect(getPart(PartSteps, inst(s, DRUM))!.measures).toBe(4);
    // steps that were never written read as off, like the grid does
    const read = (a: number[]) => Array.from({ length: 16 }, (_, i) => (a[i] ? 1 : 0));
    expect(read(drumNotes(s).sd)).toEqual(read([...before, ...before]));
  });

  test('halving keeps the first half; doubling again brings it back', () => {
    const s = solo();
    const before = [...bassNotes(s)];
    apply(s, resizeLoopCommands(inst(s, BASS), 'halve'));
    expect(getPart(PartSteps, inst(s, BASS))!.measures).toBe(1);
    apply(s, [
      { type: 'setCells', instrumentId: inst(s, BASS).id, track: 7, cells: [{ step: 2, on: true }] }
    ]);
    apply(s, resizeLoopCommands(inst(s, BASS), 'double'));
    const after = Array.from({ length: 16 }, (_, i) => bassNotes(s)[i]);
    expect(after.slice(8, 16)).toEqual(after.slice(0, 8)); // second half is a copy of the (edited) first
    expect(after[2]).toBe(7);
    expect(before.slice(0, 2)).toEqual(after.slice(0, 2));
  });

  test('limits: a one-measure loop cannot be halved, a 64-step loop cannot be doubled', () => {
    const s = solo();
    apply(s, resizeLoopCommands(inst(s, BASS), 'halve'));
    expect(canHalveLoop(inst(s, BASS))).toBe(false);
    expect(resizeLoopCommands(inst(s, BASS), 'halve')).toEqual([]);
    for (let i = 0; i < 6; i++) apply(s, resizeLoopCommands(inst(s, BASS), 'double'));
    expect(canDoubleLoop(inst(s, BASS))).toBe(false);
    expect(getPart(PartSteps, inst(s, BASS))!.measures * 8).toBeLessThanOrEqual(64);
  });
});

describe('drum randomize', () => {
  test('writes a new groove on the kit tracks, with a kick on every downbeat', () => {
    const s = solo();
    const cmds = randomizeCommands(inst(s, DRUM));
    for (let tries = 0; tries < 5 && cmds.length === 0; tries++)
      apply(s, randomizeCommands(inst(s, DRUM)));
    apply(s, cmds);
    const notes = drumNotes(s);
    expect(Object.keys(notes).sort()).toEqual(['bd', 'hh', 'sd']); // no new tracks invented
    for (const steps of Object.values(notes)) expect(steps).toHaveLength(8);
    expect([notes.bd[0], notes.bd[4]]).toEqual([1, 1]);
  });
});

describe('who is editing', () => {
  function trio() {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const a = new AppStore(false, 'r', net.join('a'), fakePlayer());
    const b = new AppStore(false, 'r', net.join('b'), fakePlayer());
    net.settle();
    host.selfPeerId = 'host';
    a.selfPeerId = 'a';
    b.selfPeerId = 'b';
    return { host, a, b };
  }
  const tap = (s: AppStore) =>
    s.dispatch({
      type: 'setCells',
      instrumentId: inst(s, DRUM).id,
      track: 0,
      cells: [{ step: 1, on: true }]
    });

  test('the others see an edit as activity on that instrument; the editor does not', () => {
    const { host, a, b } = trio();
    const id = inst(host, DRUM).id;
    expect(a.instrumentsData.instrumentsData.map((i) => i.id)).toEqual(
      host.instrumentsData.instrumentsData.map((i) => i.id)
    );
    tap(a);
    expect(host.activity[id]).toBeTypeOf('number');
    expect(b.activity[id]).toBeTypeOf('number');
    expect(a.activity[id]).toBeUndefined(); // its own edit came back from the host, and is not "someone else"
  });

  test('a host edit shows on the clients, not on the host', () => {
    const { host, a } = trio();
    const id = inst(host, DRUM).id;
    tap(host);
    expect(a.activity[id]).toBeTypeOf('number');
    expect(host.activity[id]).toBeUndefined();
  });
});

describe('gesture: erase by starting on a note', () => {
  const start = { step: 2, track: 0 };
  const last = { step: 5, track: 0 };
  test('a drag from an "on" cell turns every covered step off', () => {
    const { cells } = commitStroke({
      start,
      last,
      eraseEmpty: false,
      isOn: () => true,
      erase: true
    });
    expect(cells).toEqual([2, 3, 4, 5].map((step) => ({ step, on: false })));
    expect(previewStroke(start, last, false, true).every((p) => !p.on)).toBe(true);
  });
  test('a tap still toggles, and without erase a drag paints', () => {
    const tapped = commitStroke({
      start,
      last: start,
      eraseEmpty: false,
      isOn: () => true,
      erase: true
    });
    expect(tapped.cells).toEqual([{ step: 2, on: false }]);
    const painted = commitStroke({ start, last, eraseEmpty: false, isOn: () => false });
    expect(painted.cells.every((c) => c.on)).toBe(true);
  });
});

describe('playhead and scale names', () => {
  test('the step follows the position: one cycle is stepsPerMeasure steps, the loop wraps', () => {
    const length = { stepsPerMeasure: 8, measures: 2 };
    expect(playheadStep(0, true, length)).toBe(0);
    expect(playheadStep(0.5, true, length)).toBe(4);
    expect(playheadStep(1, true, length)).toBe(8);
    expect(playheadStep(2, true, length)).toBe(0);
    expect(playheadStep(0.5, false, length)).toBeUndefined();
    expect(playheadStep(NaN, true, length)).toBeUndefined();
  });
  test('degrees are named from the key and mode', () => {
    expect([0, 1, 2, 7].map((d) => degreeName('A', 'minor', d))).toEqual(['A', 'B', 'C', 'A↑']);
    expect(degreeName('C', 'major', 4)).toBe('G');
    expect(degreeName('C', 'unknown', 3)).toBe('3');
  });
});
