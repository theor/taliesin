import { describe, expect, test, vi } from 'vitest';
import { AppStore, createInstrument } from './Store.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';
import {
  getPart,
  makePartData,
  MonoSequence,
  PartChords,
  PartFilter,
  PartFm,
  PartTrackNotes,
  PartVoice
} from './parts.svelte.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { fakePlayer } from './testing/fakePlayer.js';
import { randomizeCommands } from './commandBuilders.js';
import type { Command } from './commands.js';

// Presets are created in this order: Piano (0), Bass (1), Drum (2)
const PIANO = 0;
const BASS = 1;
const DRUM = 2;

const snap = (s: AppStore) => JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData));
const idOf = (s: AppStore, index: number): string => s.instrumentsData.instrumentsData[index].id;
const setCells = (
  s: AppStore,
  index: number,
  track: number,
  cells: [number, boolean][]
): Command => ({
  type: 'setCells',
  instrumentId: idOf(s, index),
  track,
  cells: cells.map(([step, on]) => ({ step, on }))
});
const drumNotes = (s: AppStore) =>
  getPart(PartTrackNotes, s.instrumentsData.instrumentsData[DRUM])!.notes as Record<
    string,
    number[]
  >;
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
    const cmd = setCells(s, DRUM, 0, [
      [1, true],
      [2, true]
    ]);
    s.dispatch(cmd);
    const once = snap(s);
    s.dispatch(cmd);
    expect(snap(s)).toEqual(once);
  });

  test('unknown ids, bad tracks and malformed cells are ignored', () => {
    const s = solo();
    const before = snap(s);
    s.dispatch({
      type: 'setCells',
      instrumentId: 'nope',
      track: 0,
      cells: [{ step: 0, on: true }]
    });
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

    live.dispatch(
      setCells(live, DRUM, 1, [
        [1, true],
        [3, true]
      ])
    );
    live.dispatch(setCells(live, DRUM, 0, [[4, false]]));
    live.dispatch(
      setCells(live, BASS, 5, [
        [0, true],
        [6, true]
      ])
    );
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
    live.dispatch(
      setCells(live, DRUM, 2, [
        [0, false],
        [5, true]
      ])
    );
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

  test('a drum kit randomizes only its own tracks, as one absolute command', () => {
    const s = solo();
    const data = $state.snapshot(s.instrumentsData.instrumentsData[DRUM]) as any;
    const cmds = randomizeCommands(data);
    // (the odds of a random groove equalling the preset on all three tracks are negligible)
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ type: 'setPartFields', partName: 'PartTrackNotes' });
    expect(Object.keys((cmds[0] as any).fields.notes).sort()).toEqual(['bd', 'hh', 'sd']);
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
    switch (int(10)) {
      case 0:
      case 1:
      case 2:
        return {
          type: 'setCells',
          instrumentId: id,
          track: int(8),
          cells: Array.from({ length: 1 + int(3) }, () => ({ step: int(8), on: rand() < 0.5 })),
          // always a slot, as the views send it: sometimes the live one, sometimes one being launched
          // at the same time (without a slot, "the live one" depends on which launches arrived first)
          pattern: int(3)
        };
      case 8:
      case 9:
        return { type: 'setLivePattern', instrumentId: id, pattern: int(3) };
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
        expect(s.instrumentsData.volume, `seed ${seed}: master volume`).toBe(
          host.instrumentsData.volume
        );
      }
    }
  });
});

describe('untrusted part data', () => {
  test('a field that would break out of the generated code is rejected', () => {
    const s = solo();
    const before = snap(s);
    const bass = idOf(s, BASS);
    const drum = idOf(s, DRUM);
    const set = (instrumentId: string, partName: string, fields: object) =>
      s.dispatch({ type: 'setPartFields', instrumentId, partName, fields } as Command);
    set(bass, 'MonoSequence', { notes: ['1")+evil+("'] });
    set(bass, 'PartEffects', { reverb: '0);evil();(' });
    set(bass, 'PartOctave', { octave: '4");evil();("' });
    set(drum, 'PartTrackNotes', { notes: { 'bd")+evil+("': [1] } });
    set(bass, 'PartEffects', { reverb: 0.5, mystery: 1 }); // all or nothing
    expect(snap(s)).toEqual(before);
    expect(s.code()).not.toContain('evil');
  });

  test('hostile instruments never make the song unparseable', () => {
    const s = solo();
    const add = (instrumentName: string, parts: object[]) =>
      s.dispatch({
        type: 'addInstrument',
        instrument: {
          id: `x${parts.length}${instrumentName}`,
          name: 'x',
          instrumentName,
          volume: 1,
          state: 0,
          parts
        }
      } as Command);
    const before = snap(s).length;
    add('PianoScale', []); // no input: rejected
    add('PianoScale', [{ partName: 'PartSteps', stepsPerMeasure: 8, measures: 1 }]); // still no input
    add('Drum', [{ partName: 'MonoSequence', notes: [1] }]); // another instrument's input
    expect(snap(s)).toHaveLength(before);
    // two inputs: only the instrument's own one is kept
    add('PianoScale', [
      { partName: 'MonoSequence', notes: [1] },
      { partName: 'PartTrackNotes', notes: { bd: [1] } }
    ]);
    expect(
      snap(s)
        .at(-1)
        .parts.map((p: any) => p.partName)
    ).toEqual(['MonoSequence']);
    // `$:` is a label, so the song is plain JavaScript: it must parse (this does not run it)
    expect(() => new Function(s.code())).not.toThrow();
  });

  test('numbers are kept in range, so a huge loop cannot freeze the peers', () => {
    const s = solo();
    s.dispatch({
      type: 'setPartFields',
      instrumentId: idOf(s, BASS),
      partName: 'PartSteps',
      fields: { measures: 1e9 }
    });
    const steps = s.instrumentsData.instrumentsData[BASS].parts.find(
      (p) => p.partName === 'PartSteps'
    ) as any;
    expect(steps.measures).toBe(16);
  });
});

describe('the whole song over the network', () => {
  test('a client only takes the song from its host, and only what the reducer accepts', () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const a = new AppStore(false, 'r', net.join('a'), fakePlayer());
    net.settle();
    expect(snap(a)).toEqual(snap(host));

    const rogue = net.join('rogue');
    net.settle();
    const [sendState] = rogue.makeAction<any>('state');
    const evil = { ...snap(host)[BASS], id: 'evil' };
    evil.parts = evil.parts.map((p: any) =>
      p.partName === 'PartEffects' ? { ...p, reverb: '0);evil();(' } : p
    );
    sendState({ instruments: [evil], volume: 1, scale: host.scale }); // to everyone: the host and the client
    expect(snap(a)).toEqual(snap(host)); // not the host: ignored
    expect(host.instrumentsData.instrumentsData).toHaveLength(3); // the host never takes a song

    const [sendCmd] = rogue.makeAction<any>('cmd');
    sendCmd({ cmd: setCells(host, DRUM, 1, [[1, true]]), ordered: true }, 'a'); // pretending to be the host
    expect(drumNotes(a).sd[1]).toBe(0);
  });

  test("the host's song goes through the reducer: an invalid field gets its default", () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const effects = host.instrumentsData.instrumentsData[BASS].parts.find(
      (p) => p.partName === 'PartEffects'
    );
    (effects as any).reverb = '0);evil();(';
    const a = new AppStore(false, 'r', net.join('a'), fakePlayer());
    net.settle();
    expect(a.instrumentsData.instrumentsData).toHaveLength(3);
    expect(a.code()).not.toContain('evil');
  });
});

describe('the tempo', () => {
  test('is song state: whole BPM in range only (it is network input)', () => {
    const { host, a, b } = trio();
    expect(a.tempo).toBe(120);
    a.dispatch({ type: 'setTempo', bpm: 133 });
    for (const bad of [39, 241, 120.5, NaN, '120', null] as unknown[])
      a.dispatch({ type: 'setTempo', bpm: bad as number });
    expect([host.tempo, a.tempo, b.tempo]).toEqual([133, 133, 133]);
  });
});

describe('the scale', () => {
  test('is song state: set by command, synced, and only known keys and modes', () => {
    const { host, a, b } = trio();
    expect(a.scale).toEqual({ scaleKey: 'A', scaleMode: 'minor' });
    a.dispatch({ type: 'setScale', scaleKey: 'D', scaleMode: 'dorian' });
    for (const s of [host, a, b]) {
      expect(s.scale).toEqual({ scaleKey: 'D', scaleMode: 'dorian' });
      expect(s.code()).toContain(':dorian")');
    }
    a.dispatch({ type: 'setScale', scaleKey: 'H")+evil+("', scaleMode: 'dorian' });
    a.dispatch({ type: 'setScale', scaleKey: 'C', scaleMode: 'bebop' });
    expect(host.scale).toEqual({ scaleKey: 'D', scaleMode: 'dorian' });
  });

  test('a peer that joins later gets the scale and master volume with the song', () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    host.dispatch({ type: 'setScale', scaleKey: 'F#', scaleMode: 'lydian' });
    host.dispatch({ type: 'setMasterVolume', volume: 0.3 });
    const late = new AppStore(false, 'r', net.join('late'), fakePlayer());
    net.settle();
    expect(late.scale).toEqual({ scaleKey: 'F#', scaleMode: 'lydian' });
    expect(late.instrumentsData.volume).toBe(0.3);
    expect(late.code()).toBe(host.code());
  });
});

describe('addPart', () => {
  const addPart = (s: AppStore, index: number, partName: string): Command => ({
    type: 'addPart',
    instrumentId: idOf(s, index),
    partName
  });
  const partNames = (s: AppStore, index: number) =>
    s.instrumentsData.instrumentsData[index].parts.map((p) => p.partName);

  test('gives an instrument a part it lacks, with its defaults, on every peer', () => {
    const { host, a, b } = trio();
    expect(partNames(host, BASS)).not.toContain(PartFm.id);
    a.dispatch(addPart(a, BASS, PartFm.id));
    for (const s of [host, a, b]) {
      expect(getPart(PartFm, s.instrumentsData.instrumentsData[BASS])).toEqual(
        makePartData(PartFm)
      );
    }
  });

  test('two peers adding the same part at once end up with one', () => {
    const { net, host, a, b } = trio({ queued: true });
    a.dispatch(addPart(a, BASS, PartFm.id));
    b.dispatch(addPart(b, BASS, PartFm.id));
    net.flush();
    for (const s of [host, a, b])
      expect(partNames(s, BASS).filter((n) => n === PartFm.id)).toHaveLength(1);
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });

  test('only parts the instrument kind allows: no voice on drums, no second input, nothing unknown', () => {
    const s = solo();
    const before = snap(s);
    for (const cmd of [
      addPart(s, DRUM, PartVoice.id), // would replace the drum samples
      addPart(s, DRUM, PartChords.id), // needs melody notes
      addPart(s, BASS, MonoSequence.id), // input parts are not added
      addPart(s, BASS, PartTrackNotes.id),
      addPart(s, BASS, 'PartNope'),
      { type: 'addPart', instrumentId: 'nobody', partName: PartFm.id } as Command
    ])
      s.dispatch(cmd);
    expect(snap(s)).toEqual(before);
  });

  test('drums can take a filter', () => {
    const s = solo();
    s.dispatch(addPart(s, DRUM, PartFilter.id));
    expect(partNames(s, DRUM)).toContain(PartFilter.id);
  });
});
