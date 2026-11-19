import { describe, expect, test, vi } from 'vitest';
import { AppStore, patternEdit, patternFor } from './Store.svelte.js';
import { copyPatternCommands } from './commandBuilders.js';
import { getPart, MonoSequence, PartTrackNotes } from './parts.svelte.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { fakePlayer } from './testing/fakePlayer.js';
import { PatternCues, type CueClock } from './cues.svelte.js';
import type { Command } from './commands.js';
import { liveSlot, shownSlots } from './patterns.js';

// Presets are created in this order: Piano (0), Bass (1), Drum (2)
const BASS = 1;
const DRUM = 2;

function solo() {
  return new AppStore(true, 'r', createFakeNetwork().join('host'), fakePlayer());
}
function duo() {
  const net = createFakeNetwork();
  const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
  const guest = new AppStore(false, 'r', net.join('guest'), fakePlayer());
  net.settle();
  return { net, host, guest };
}
const inst = (s: AppStore, i: number) => s.instrumentsData.instrumentsData[i];
const notes = (s: AppStore, i: number) => [...getPart(MonoSequence, inst(s, i))!.notes];
const cell = (s: AppStore, i: number, pattern: number, step: number, track: number): Command => ({
  type: 'setCells',
  instrumentId: inst(s, i).id,
  track,
  cells: [{ step, on: true }],
  pattern
});
const launch = (s: AppStore, i: number, pattern: number): Command => ({
  type: 'setLivePattern',
  instrumentId: inst(s, i).id,
  pattern
});

describe('pattern slots in the song', () => {
  test('editing a slot that is not live leaves the live notes, and what everyone hears, alone', () => {
    const s = solo();
    const before = notes(s, BASS);
    const code = s.code();
    s.dispatch(cell(s, BASS, 1, 0, 6));
    expect(notes(s, BASS)).toEqual(before);
    expect(s.code()).toBe(code);
    expect(inst(s, BASS).patterns?.[1]).toMatchObject({ partName: 'MonoSequence', notes: [6] });
  });

  test('launching swaps the slots: the old live notes wait in their slot', () => {
    const s = solo();
    const a = notes(s, BASS);
    s.dispatch(cell(s, BASS, 1, 0, 6));
    s.dispatch(launch(s, BASS, 1));
    expect(liveSlot(inst(s, BASS))).toBe(1);
    expect(notes(s, BASS)).toEqual([6]);
    expect(s.code()).toContain('n("<6');
    expect(inst(s, BASS).patterns?.[0]).toMatchObject({ notes: a });
    expect(inst(s, BASS).patterns?.[1]).toBeNull();
    // and back
    s.dispatch(launch(s, BASS, 0));
    expect(notes(s, BASS)).toEqual(a);
  });

  test('launching the live slot again changes nothing (the host echoes our own launch back)', () => {
    const s = solo();
    s.dispatch(launch(s, BASS, 2));
    const snap = JSON.stringify(inst(s, BASS));
    s.dispatch(launch(s, BASS, 2));
    expect(JSON.stringify(inst(s, BASS))).toBe(snap);
  });

  test('a new slot starts empty; an empty drum pattern still makes valid code', () => {
    const s = solo();
    s.dispatch(launch(s, DRUM, 3));
    expect(getPart(PartTrackNotes, inst(s, DRUM))!.notes).toEqual({});
    expect(s.code()).toContain('s("~")');
  });

  test('a slot out of range, or not a slot at all, is rejected', () => {
    const s = solo();
    const snap = JSON.stringify(s.instrumentsData);
    for (const pattern of [-1, 8, 1.5, '1', null] as unknown as number[]) {
      s.dispatch(cell(s, BASS, pattern, 0, 1));
      s.dispatch(launch(s, BASS, pattern));
    }
    expect(JSON.stringify(s.instrumentsData)).toBe(snap);
  });

  test('a slot only addresses the notes: other parts are shared by every pattern', () => {
    const s = solo();
    s.dispatch({
      type: 'setPartFields',
      instrumentId: inst(s, BASS).id,
      partName: 'PartEffects',
      fields: { reverb: 0.9 },
      pattern: 2
    });
    expect(s.code()).toContain('.room(0.9)');
    expect(inst(s, BASS).patterns).toBeUndefined();
  });

  test('slots reach the other peers, and so do launches', () => {
    const { host, guest } = duo();
    guest.dispatch(cell(guest, BASS, 1, 2, 4));
    guest.dispatch(launch(guest, BASS, 1));
    expect(JSON.parse(JSON.stringify(inst(host, BASS)))).toEqual(
      JSON.parse(JSON.stringify(inst(guest, BASS)))
    );
    expect(host.code()).toBe(guest.code());
  });

  test('restoring keeps good slots and drops bad ones (lenient, like any saved data)', () => {
    const s = solo();
    const bass = JSON.parse(JSON.stringify(inst(s, BASS)));
    bass.id = 'restored';
    bass.livePattern = 1;
    bass.patterns = [
      { partName: 'MonoSequence', notes: [3] },
      { partName: 'MonoSequence', notes: [5] }, // the live slot: its notes are in `parts`
      { partName: 'PartTrackNotes', notes: {} }, // not this instrument's input
      { partName: 'MonoSequence', notes: ['");evil("'] } // an invalid field: falls back to empty
    ];
    s.dispatch({ type: 'addInstrument', instrument: bass });
    const got = s.instrumentsData.instrumentsData.find((i) => i.id === 'restored')!;
    expect(got.livePattern).toBe(1);
    expect(got.patterns).toEqual([
      { partName: 'MonoSequence', notes: [3] },
      null,
      null,
      { partName: 'MonoSequence', notes: [] }
    ]);

    bass.id = 'bad-live';
    bass.livePattern = 99;
    s.dispatch({ type: 'addInstrument', instrument: bass });
    expect(s.instrumentsData.instrumentsData.find((i) => i.id === 'bad-live')!.livePattern).toBe(0);
  });

  test('copying a column copies every track onto the other slot, the same on every peer', () => {
    const { host, guest } = duo();
    guest.dispatch(cell(guest, BASS, 2, 1, 5));
    guest.dispatch(cell(guest, DRUM, 2, 3, 0));
    const liveBass = notes(guest, BASS);
    const cmds = copyPatternCommands(guest.instrumentsData.instrumentsData, 0, 2);
    cmds.forEach((c) => guest.dispatch(c));
    expect(cmds.every((c) => c.type === 'setPartFields' && c.pattern === 2)).toBe(true);
    for (const s of [host, guest]) {
      expect(getPart(MonoSequence, patternFor(inst(s, BASS), 2))!.notes).toEqual(liveBass);
      expect(getPart(PartTrackNotes, patternFor(inst(s, DRUM), 2))!.notes).toEqual(
        getPart(PartTrackNotes, inst(s, DRUM))!.notes
      );
    }
    expect(JSON.parse(JSON.stringify(host.instrumentsData))).toEqual(
      JSON.parse(JSON.stringify(guest.instrumentsData))
    );
    // nothing in either slot: nothing sent, no empty slot made
    expect(copyPatternCommands(guest.instrumentsData.instrumentsData, 5, 6)).toEqual([]);
    expect(copyPatternCommands(guest.instrumentsData.instrumentsData, 2, 2)).toEqual([]);
  });

  test('copying an empty slot onto notes clears them', () => {
    const s = solo();
    s.dispatch(cell(s, BASS, 3, 0, 6));
    copyPatternCommands([inst(s, BASS)], 4, 3).forEach((c) => s.dispatch(c));
    expect(getPart(MonoSequence, patternFor(inst(s, BASS), 3))!.notes.some((n) => n != null)).toBe(
      false
    );
  });

  test('which slots show: up to the last one in use or open here', () => {
    const s = solo();
    expect(shownSlots(inst(s, BASS))).toEqual([0]);
    expect(shownSlots(inst(s, BASS), 2)).toEqual([0, 1, 2]);
    s.dispatch(cell(s, BASS, 3, 0, 1));
    expect(shownSlots(inst(s, BASS))).toEqual([0, 1, 2, 3]);
  });
});

describe('cues: a pattern heard on this device only', () => {
  test('the local code plays the open slot in place of the live one, for that instrument only', () => {
    const s = solo();
    s.dispatch(cell(s, BASS, 1, 0, 6));
    const shared = s.code();
    expect(s.localCode()).toBe(shared);
    s.cues.pick(inst(s, BASS), 1);
    expect(s.cues.isCue(inst(s, BASS))).toBe(true);
    expect(s.code()).toBe(shared); // the song itself has not changed
    expect(s.localCode()).not.toBe(shared);
    expect(s.localCode()).toContain('n("<6');
    // the other instruments are untouched
    const lines = (code: string) => code.split('$:').filter((l) => !l.includes('n("<6'));
    expect(lines(s.localCode()).length).toBe(lines(shared).length - 1);
    // hearing the live one instead
    s.cues.setHearLive(inst(s, BASS), true);
    expect(s.localCode()).toBe(shared);
  });

  test('an instrument played live here is left out here only, until that ends', () => {
    const s = solo();
    const shared = s.code();
    const count = shared.match(/\$:/g)!.length;
    s.cues.setPlayingHere(inst(s, BASS).id, true);
    expect(s.localCode().match(/\$:/g)).toHaveLength(count - 1);
    expect(s.code()).toBe(shared); // the room still hears it
    s.cues.setPlayingHere(inst(s, BASS).id, false);
    expect(s.localCode()).toBe(shared);
  });

  test('mute still applies to a cue', () => {
    const s = solo();
    s.cues.pick(inst(s, BASS), 1);
    s.dispatch({
      type: 'setInstrumentFields',
      instrumentId: inst(s, BASS).id,
      fields: { state: 1 }
    });
    expect(s.localCode().match(/\$:/g)).toHaveLength(2);
  });

  test('the edit views address their note edits to the open slot, the live one included', () => {
    const s = solo();
    const sent: Command[] = [];
    const live = patternEdit(inst(s, BASS), 0, (c) => sent.push(c));
    live.dispatch(cell(s, BASS, undefined as never, 0, 1));
    const other = patternEdit(inst(s, BASS), 2, (c) => sent.push(c));
    other.dispatch({
      type: 'setInstrumentFields',
      instrumentId: inst(s, BASS).id,
      fields: { volume: 0.5 }
    });
    other.dispatch({
      type: 'setPartFields',
      instrumentId: inst(s, BASS).id,
      partName: 'MonoSequence',
      fields: { notes: [1] }
    });
    other.dispatch({
      type: 'setPartFields',
      instrumentId: inst(s, BASS).id,
      partName: 'PartEffects',
      fields: { reverb: 1 }
    });
    expect(sent.map((c) => ('pattern' in c ? c.pattern : undefined))).toEqual([
      0,
      undefined,
      2,
      undefined
    ]);
    expect(getPart(MonoSequence, other.data)!.notes).toEqual([]); // a new slot is empty
  });

  test('launching while playing waits for the next bar; stopped, it goes at once', () => {
    const dispatch = vi.fn<(cmd: Command) => void>();
    const clock: CueClock = { playing: true, position: () => 3.2, cps: () => 0.5 };
    const data = {
      id: 'x',
      name: 'x',
      instrumentName: 'PianoScale',
      parts: [],
      volume: 1,
      state: 0
    };
    const cues = new PatternCues(createFakeNetwork().join('p'), dispatch, clock, () => data);
    cues.pick(data, 1);
    cues.launch(data, 1);
    expect(dispatch).not.toHaveBeenCalled();
    expect(cues.queued.x).toBe(1);
    clock.position = () => 3.95; // 0.1 s before the bar at 0.5 cycles per second
    cues.tick();
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setLivePattern',
      instrumentId: 'x',
      pattern: 1
    });
    expect(cues.queued.x).toBeUndefined();
    expect(cues.open.x).toBeUndefined(); // follows the live pattern again

    dispatch.mockClear();
    clock.playing = false;
    cues.launch(data, 2);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setLivePattern',
      instrumentId: 'x',
      pattern: 2
    });
  });

  test("the others see this device's cues, until it leaves", () => {
    const { net, host, guest } = duo();
    guest.cues.pick(inst(guest, BASS), 2);
    expect(host.cues.othersOn(inst(host, BASS))).toEqual([{ peerId: 'guest', slot: 2 }]);
    guest.cues.setHearLive(inst(guest, BASS), true); // not heard: not a cue
    expect(host.cues.othersOn(inst(host, BASS))).toEqual([]);
    guest.cues.setHearLive(inst(guest, BASS), false);
    host.peerLeft('guest');
    expect(host.cues.othersOn(inst(host, BASS))).toEqual([]);
    void net;
  });

  test('when someone else launches the slot open here, this device follows the live one again', () => {
    const { host, guest } = duo();
    guest.cues.pick(inst(guest, BASS), 1);
    host.dispatch(launch(host, BASS, 1));
    expect(guest.cues.isCue(inst(guest, BASS))).toBe(false);
    host.dispatch(launch(host, BASS, 2)); // and keeps following: no surprise cue of B later
    expect(guest.cues.slot(inst(guest, BASS))).toBe(2);
  });

  test('a column launches together: every track with notes there, sent in the same tick', () => {
    const s = solo();
    s.dispatch(cell(s, BASS, 1, 0, 6));
    s.dispatch(cell(s, DRUM, 1, 0, 0));
    const sent: Command[] = [];
    const clock: CueClock = { playing: true, position: () => 3.2, cps: () => 0.5 };
    const cues = new PatternCues(
      createFakeNetwork().join('p'),
      (c) => sent.push(c),
      clock,
      (id) => s.instrumentsData.instrumentsData.find((i) => i.id === id)
    );
    const all = s.instrumentsData.instrumentsData;
    cues.launchColumn(all, 1);
    expect(sent).toEqual([]);
    expect(cues.columnQueued(all, 1)).toBe(true);
    clock.position = () => 3.95;
    cues.tick();
    // the piano has nothing in B: it keeps playing what it plays
    expect(sent.map((c) => 'instrumentId' in c && c.instrumentId)).toEqual([
      inst(s, BASS).id,
      inst(s, DRUM).id
    ]);
  });

  test('cueing a column plays it here only; the tracks with nothing there stay live', () => {
    const s = solo();
    s.dispatch(cell(s, BASS, 2, 0, 6));
    const all = s.instrumentsData.instrumentsData;
    s.cues.cueColumn(all, 2);
    expect(s.cues.heard(inst(s, BASS))).toBe(2);
    expect(s.cues.isCue(inst(s, DRUM))).toBe(false);
    expect(s.cues.columnCued(all, 2)).toBe(true);
    expect(s.code()).not.toContain('n("<6');
    expect(s.localCode()).toContain('n("<6');
    s.cues.uncueAll(all);
    expect(s.localCode()).toBe(s.code());
  });

  test('a malformed cue announcement is ignored', () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const room = net.join('evil');
    const [send] = room.makeAction<unknown>('cue');
    net.settle();
    void send({ [inst(host, BASS).id]: 99, other: 'x' });
    void send(null);
    void send([1, 2]);
    expect(host.cues.othersOn(inst(host, BASS))).toEqual([]);
  });
});
