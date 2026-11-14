import { describe, expect, test, vi } from 'vitest';
import { AppStore, createInstrument } from './Store.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';
import { getPart } from './instruments.js';
import { MonoSequence, PartTrackNotes } from './parts.svelte.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { fakePlayer } from './testing/fakePlayer.js';
import { randomizeCommands } from './commandBuilders.js';
import type { Command } from './commands.js';

// code generation reads the Svelte context (key / scale), which only exists inside a component
vi.mock('./context', () => ({
  getGlobalContext: () => ({ host: true, debug: false, roomId: 'r', scaleKey: 'A', scaleMode: 'minor' }),
  setGlobalContext: () => {}
}));

// Presets are created in this order: Piano (0), Bass (1), Drum (2)
const PIANO = 0;
const BASS = 1;
const DRUM = 2;

const snap = (s: AppStore) => JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData));
const idOf = (s: AppStore, index: number): string => s.instrumentsData.instrumentsData[index].id;
const setCells = (s: AppStore, index: number, track: number, cells: [number, boolean][]): Command => ({
  type: 'setCells',
  instrumentId: idOf(s, index),
  track,
  cells: cells.map(([step, on]) => ({ step, on }))
});
const drumNotes = (s: AppStore) =>
  getPart(PartTrackNotes, s.instrumentsData.instrumentsData[DRUM])!.notes as Record<string, number[]>;
const bassNotes = (s: AppStore) =>
  getPart(MonoSequence, s.instrumentsData.instrumentsData[BASS])!.notes as (number | undefined)[];

function solo() {
  return new AppStore(true, 'r', createFakeNetwork().join('host'), fakePlayer());
}
function trio(opts: { queued?: boolean } = {}) {
  const net = createFakeNetwork(opts);
  const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
  const a = new AppStore(false, 'r', net.join('a'), fakePlayer());
  const b = new AppStore(false, 'r', net.join('b'), fakePlayer());
  net.settle();
  net.flush(); // join-time state (no-op unless queued)
  return { net, host, a, b };
}

describe('dispatch: setCells', () => {
  test('turns cells on and off on a drum track', () => {
    const s = solo();
    expect(drumNotes(s).sd[1]).toBe(0);
    s.dispatch(setCells(s, DRUM, 1, [[1, true]])); // track 1 = snare
    expect(drumNotes(s).sd[1]).toBe(1);
    s.dispatch(setCells(s, DRUM, 1, [[1, false]]));
    expect(drumNotes(s).sd[1]).toBe(0);
  });

  test('sets the note of a step on a mono sequence', () => {
    const s = solo();
    s.dispatch(setCells(s, BASS, 7, [[3, true]]));
    expect(bassNotes(s)[3]).toBe(7);
  });

  test('is idempotent: applying the same command again changes nothing', () => {
    const s = solo();
    const cmd = setCells(s, DRUM, 0, [[1, true], [2, true]]);
    s.dispatch(cmd);
    const once = snap(s);
    s.dispatch(cmd);
    expect(snap(s)).toEqual(once);
  });

  test('unknown ids, bad tracks and malformed cells are ignored', () => {
    const s = solo();
    const before = snap(s);
    s.dispatch({ type: 'setCells', instrumentId: 'nope', track: 0, cells: [{ step: 0, on: true }] });
    s.dispatch(setCells(s, DRUM, 99, [[0, true]]));
    s.dispatch(setCells(s, DRUM, 0, [[-1, true]]));
    s.dispatch({ ...(setCells(s, DRUM, 0, []) as object), cells: 'x' } as unknown as Command);
    expect(snap(s)).toEqual(before);
  });
});

describe('command log and replay', () => {
  test('replaying a recorded session from the same starting state reproduces it', () => {
    const live = solo();
    const start = snap(live);

    live.dispatch(setCells(live, DRUM, 1, [[1, true], [3, true]]));
    live.dispatch(setCells(live, DRUM, 0, [[4, false]]));
    live.dispatch(setCells(live, BASS, 5, [[0, true], [6, true]]));
    live.dispatch(setCells(live, BASS, 2, [[6, false]]));
    live.dispatch({ type: 'transport', action: 'toggle' });
    expect(live.commandLog).toHaveLength(5);

    const replayed = solo();
    replayed.instrumentsData.instrumentsData = JSON.parse(JSON.stringify(start)); // same ids
    for (const { cmd } of live.commandLog) replayed.dispatch(cmd);

    expect(snap(replayed)).toEqual(snap(live));
    expect(replayed.code()).toBe(live.code());
    expect(replayed.transport.playing).toBe(true);
  });

  test('the log survives JSON, so a recorded session can be saved and replayed later', () => {
    const live = solo();
    live.dispatch(setCells(live, DRUM, 2, [[0, false], [5, true]]));
    const saved = JSON.stringify(live.commandLog.map((e) => e.cmd));

    const replayed = solo();
    replayed.instrumentsData.instrumentsData = JSON.parse(JSON.stringify(snap(live)));
    // wind the cells back, then replay the saved log: must land on the same state
    for (const c of JSON.parse(saved) as Command[]) replayed.dispatch(c);
    expect(snap(replayed)).toEqual(snap(live));
  });
});

describe('randomize', () => {
  test('the randomness is resolved into commands, so every peer gets the same notes', () => {
    const { host, a, b } = trio();
    const cmds = randomizeCommands($state.snapshot(a.instrumentsData.instrumentsData[BASS]) as any);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ type: 'setPartFields', partName: 'MonoSequence' });
    cmds.forEach(a.dispatch);

    const notes = bassNotes(a);
    expect(notes).toHaveLength(16);
    expect(notes.every((n) => Number.isInteger(n) && n! >= 0 && n! < 7)).toBe(true);
    expect(JSON.stringify(bassNotes(host))).toBe(JSON.stringify(notes));
    expect(JSON.stringify(bassNotes(b))).toBe(JSON.stringify(notes));
  });

  test('an instrument with nothing to randomize produces no commands', () => {
    const s = solo();
    expect(randomizeCommands($state.snapshot(s.instrumentsData.instrumentsData[DRUM]) as any)).toEqual([]);
  });
});

describe('commands over the network', () => {
  test('a client command reaches the host and the other client', () => {
    const { host, a, b } = trio();
    a.dispatch(setCells(a, DRUM, 1, [[1, true]]));
    for (const s of [host, a, b]) expect(drumNotes(s).sd[1]).toBe(1);
    expect(host.commandLog.map((e) => e.origin)).toEqual(['remote']);
    expect(a.commandLog.map((e) => e.origin)).toEqual(['local', 'remote']); // the host echoes it back
  });

  test('a host command reaches the clients', () => {
    const { host, a, b } = trio();
    host.dispatch(setCells(host, BASS, 4, [[0, true]]));
    for (const s of [host, a, b]) expect(bassNotes(s)[0]).toBe(4);
  });

  test('a command copied directly between clients is not trusted: only the host orders commands', () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const a = new AppStore(false, 'r', net.join('a'), fakePlayer());
    const rogueRoom = net.join('rogue');
    net.settle();
    const [send] = rogueRoom.makeAction<any>('cmd');
    const cmd = setCells(host, DRUM, 1, [[1, true]]);

    send({ cmd, ordered: false }, 'a'); // a client ignores anything the host did not order
    send({ cmd, ordered: true }, 'host'); // the host ignores "ordered" messages: it is the one ordering
    expect(drumNotes(a).sd[1]).toBe(0);
    expect(drumNotes(host).sd[1]).toBe(0);

    send({ cmd, ordered: false }, 'host'); // an unordered command is what a client sends the host
    expect(drumNotes(host).sd[1]).toBe(1);
    expect(drumNotes(a).sd[1]).toBe(1); // and the host rebroadcasts it, ordered
  });

  test('two peers writing the same cell at the same time converge', () => {
    const { net, host, a, b } = trio({ queued: true });
    a.dispatch(setCells(a, DRUM, 1, [[1, true]]));
    b.dispatch(setCells(b, DRUM, 1, [[1, false]])); // concurrent, opposite
    expect(drumNotes(a).sd[1]).toBe(1); // each applied its own optimistically
    expect(drumNotes(b).sd[1]).toBe(0);

    net.flush();
    const finals = [host, a, b].map((s) => drumNotes(s).sd[1]);
    expect(new Set(finals).size).toBe(1);
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });
});

// Property: whatever the interleaving of commands and (per-link ordered) deliveries, everyone converges.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('convergence (randomised)', () => {
  /** A random command of any kind, aimed at an instrument that exists or has existed. */
  function randomCommand(rand: () => number, known: string[]): Command {
    const int = (n: number) => Math.floor(rand() * n);
    const id = known[int(known.length)];
    switch (int(8)) {
      case 0:
      case 1:
      case 2:
        return {
          type: 'setCells',
          instrumentId: id,
          track: int(8),
          cells: Array.from({ length: 1 + int(3) }, () => ({ step: int(8), on: rand() < 0.5 }))
        };
      case 3:
        return { type: 'setInstrumentFields', instrumentId: id, fields: { volume: int(11) / 10 } };
      case 4:
        return { type: 'setInstrumentFields', instrumentId: id, fields: { name: `n${int(5)}` } };
      case 5:
        return {
          type: 'setPartFields',
          instrumentId: id,
          partName: 'PartEffects',
          fields: { reverb: int(11) / 10, delay: int(11) / 10 }
        };
      case 6: {
        const instrument = createInstrument(PianoScale, undefined, `i${int(100)}`);
        known.push(instrument.id);
        return { type: 'addInstrument', instrument: instrument as any };
      }
      default:
        return rand() < 0.5
          ? { type: 'removeInstrument', instrumentId: id }
          : { type: 'setMasterVolume', volume: int(11) / 10 };
    }
  }

  test('3 peers, random commands of every kind, random delivery order: all end up identical', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = mulberry32(seed);
      const { net, host, a, b } = trio({ queued: true });
      const peers = [host, a, b];
      const known = [PIANO, BASS, DRUM].map((i) => idOf(host, i));

      for (let step = 0; step < 50; step++) {
        if (rand() < 0.6) peers[Math.floor(rand() * 3)].dispatch(randomCommand(rand, known));
        else net.flushRandom(rand, 1 + Math.floor(rand() * 3));
      }
      net.flushRandom(rand);

      const expected = snap(host);
      expect(snap(a), `seed ${seed}: a differs from host`).toEqual(expected);
      expect(snap(b), `seed ${seed}: b differs from host`).toEqual(expected);
      for (const s of [a, b]) {
        expect(s.instrumentsData.volume, `seed ${seed}: master volume`).toBe(host.instrumentsData.volume);
      }
    }
  });
});
