import { expect, test, describe, vi, afterEach } from 'vitest';
import { AppStore, createInstrument, makePartData } from './Store.svelte.js';
import { PartEffects, PartSteps } from './parts.svelte.js';
import { getPart } from './instruments.js';
import { presetCommands } from './commandBuilders.js';
import type { Command } from './commands.js';
import { PianoScale } from './instruments/MonoSynth.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { Status } from './interfaces.js';
import { writable } from 'svelte/store';

/** Records what the audio engine was asked to do, so tests can assert "clients never play". */
function fakePlayer() {
  const isPlaying = writable(false);
  const calls: string[] = [];
  return {
    isPlaying,
    time: writable(0),
    cps: 0.5,
    calls,
    toggle() {
      calls.push('toggle');
      isPlaying.update((x) => !x);
    },
    stop() {
      calls.push('stop');
      isPlaying.set(false);
    }
  };
}

function setup(
  opts: { queued?: boolean; latency?: { host?: number; a?: number; b?: number } } = {}
) {
  const net = createFakeNetwork({ queued: opts.queued });
  const l = opts.latency ?? {};
  const players = { host: fakePlayer(), a: fakePlayer(), b: fakePlayer() };
  const host = new AppStore(true, 'r', net.join('host', { latencyMs: l.host }), players.host);
  const a = new AppStore(false, 'r', net.join('a', { latencyMs: l.a }), players.a);
  const b = new AppStore(false, 'r', net.join('b', { latencyMs: l.b }), players.b);
  net.settle();
  return { net, host, a, b, players };
}
// JSON round-trip: the wire format turns `undefined` (rests in note arrays) into `null`
const snap = (s: AppStore) => JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData));

const idOf = (s: AppStore, index: number): string => s.instrumentsData.instrumentsData[index].id;
const rename = (s: AppStore, index: number, name: string): Command => ({
  type: 'setInstrumentFields',
  instrumentId: idOf(s, index),
  fields: { name }
});
const effects = (s: AppStore, index: number) =>
  getPart(PartEffects, s.instrumentsData.instrumentsData[index])!;

test('creating an instrument', () => {
  makePartData(PartSteps);
  const i = createInstrument(PianoScale);
  expect(i).toBeDefined();
  expect(i.name).toBe('PianoScale');
  expect(i.id).toBeTruthy();
});

describe('instrument sync', () => {
  test('clients receive the host state on join', () => {
    const { host, a, b } = setup();
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });

  test('edit propagates host -> clients', () => {
    const { host, a, b } = setup();
    host.dispatch(rename(host, 0, 'renamed'));
    expect(snap(a)[0].name).toBe('renamed');
    expect(snap(b)[0].name).toBe('renamed');
  });

  test('edit propagates client -> host and other clients', () => {
    const { host, a, b } = setup();
    a.dispatch(rename(a, 0, 'from-a'));
    expect(snap(host)[0].name).toBe('from-a');
    expect(snap(b)[0].name).toBe('from-a');
  });

  // Regression: a flag set on the first remote update was never cleared,
  // so every later local edit was silently not sent.
  test('local edit is still sent after receiving a remote update', () => {
    const { host, a } = setup();
    host.dispatch(rename(host, 0, 'remote'));
    expect(snap(a)[0].name).toBe('remote');

    a.dispatch(rename(a, 0, 'local-after-remote'));
    expect(snap(host)[0].name).toBe('local-after-remote');
  });

  test('part fields propagate (what a slider or randomize produces)', () => {
    const { host, a, b } = setup();
    a.dispatch({
      type: 'setPartFields',
      instrumentId: idOf(a, 1),
      partName: 'PartEffects',
      fields: { reverb: 0.9, delay: 0.25 }
    });
    for (const s of [host, a, b]) {
      expect(effects(s, 1).reverb).toBe(0.9);
      expect(effects(s, 1).delay).toBe(0.25);
    }
  });

  test('instrument and master volume propagate', () => {
    const { host, a, b } = setup();
    b.dispatch({ type: 'setInstrumentFields', instrumentId: idOf(b, 1), fields: { volume: 0.25 } });
    a.dispatch({ type: 'setMasterVolume', volume: 0.5 });
    for (const s of [host, a, b]) {
      expect(snap(s)[1].volume).toBe(0.25);
      expect(s.instrumentsData.volume).toBe(0.5);
    }
  });

  test('instruments get distinct stable ids', () => {
    const { host } = setup();
    const ids = snap(host).map((i: any) => i.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('structural sync', () => {
  test('add propagates from a client to host and peers, at the end', () => {
    const { host, a, b } = setup();
    const before = snap(host).length;
    const created = createInstrument(PianoScale);
    a.dispatch({ type: 'addInstrument', instrument: created as any });
    for (const s of [host, a, b]) expect(snap(s).length).toBe(before + 1);
    expect(snap(host)[before].id).toBe(created.id);
    expect(snap(b)).toEqual(snap(host));
  });

  test('preset propagates', () => {
    const { host, b } = setup();
    presetCommands(['Drum']).forEach(host.dispatch);
    expect(snap(b)).toEqual(snap(host));
    expect(snap(b).at(-1).instrumentName).toBe('Drum');
  });

  test('remove propagates from a client', () => {
    const { host, a, b } = setup();
    const removedId = idOf(a, 0);
    a.dispatch({ type: 'removeInstrument', instrumentId: removedId });
    for (const s of [host, a, b]) {
      expect(snap(s).some((i: any) => i.id === removedId)).toBe(false);
    }
    expect(snap(b)).toEqual(snap(host));
  });

  test('a command added to the added instrument can follow it immediately', () => {
    const { host, a } = setup();
    const created = createInstrument(PianoScale);
    a.dispatch({ type: 'addInstrument', instrument: created as any });
    a.dispatch({ type: 'setInstrumentFields', instrumentId: created.id, fields: { name: 'mine' } });
    expect(snap(host).at(-1).name).toBe('mine');
  });

  test('concurrent remove + edit: the edit lands on the right instrument (addressed by id)', () => {
    const { net, host, a, b } = setup({ queued: true });
    net.flush(); // deliver the join-time state
    expect(snap(b)).toEqual(snap(host));
    const targetId = idOf(b, 2);

    a.dispatch({ type: 'removeInstrument', instrumentId: idOf(a, 0) }); // shifts every index
    b.dispatch(rename(b, 2, 'edited'));
    net.flush();

    for (const s of [host, a, b]) {
      const list = snap(s);
      expect(list.length).toBe(2);
      expect(list.find((i: any) => i.id === targetId)?.name).toBe('edited');
    }
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });

  test('two clients adding at the same time end up with the same order everywhere', () => {
    const { net, host, a, b } = setup({ queued: true });
    net.flush();
    const x = createInstrument(PianoScale, undefined, 'X');
    const y = createInstrument(PianoScale, undefined, 'Y');
    a.dispatch({ type: 'addInstrument', instrument: x as any });
    b.dispatch({ type: 'addInstrument', instrument: y as any });
    net.flush();

    const order = (s: AppStore) => snap(s).map((i: any) => i.name).slice(-2);
    expect(order(a)).toEqual(order(host));
    expect(order(b)).toEqual(order(host));
    expect(new Set(order(host))).toEqual(new Set(['X', 'Y']));
  });
});

describe('robustness', () => {
  test('edits for an unknown instrument are ignored, not appended', () => {
    const { host, a } = setup();
    const before = snap(host);
    a.dispatch({ type: 'setInstrumentFields', instrumentId: 'ghost', fields: { name: 'boo' } });
    expect(snap(host)).toEqual(before);
    expect(snap(a)).toEqual(before);
  });

  test('malformed or hostile payloads are ignored', async () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'), fakePlayer());
    const rogueRoom = net.join('rogue');
    net.settle();
    const [sendState] = rogueRoom.makeAction<any>('state');
    const [sendCmd] = rogueRoom.makeAction<any>('cmd');
    const target = idOf(host, 1);
    const before = snap(host);
    const send = (cmd: any) => sendCmd({ cmd, ordered: false }, 'host');

    await sendState('nope' as any);
    await sendCmd({} as any);
    await sendCmd({ cmd: 'x', ordered: false } as any);
    await send({ type: 'setCells', instrumentId: target, track: 0, cells: 'x' });
    await send({ type: 'removeInstrument' });
    await send({ type: 'removeInstrument', instrumentId: 'missing' });
    await send({ type: 'addInstrument', instrument: {} });
    await send({ type: 'addInstrument', instrument: { ...snap(host)[0], instrumentName: 'Nope' } });
    await send({ type: 'setInstrumentFields', instrumentId: target, fields: { volume: 5 } });
    await send({ type: 'setInstrumentFields', instrumentId: target, fields: { id: 'stolen' } });
    await send({ type: 'setMasterVolume', volume: 'loud' });
    // parts: unknown key, wrong type, partName rewrite, prototype poisoning
    const part = (fields: any) => ({ type: 'setPartFields', instrumentId: target, partName: 'PartEffects', fields });
    await send(part({ evil: 1 }));
    await send(part({ reverb: 'wet' }));
    await send(part({ partName: 'Other' }));
    await send(JSON.parse('{"type":"setPartFields","instrumentId":"' + target + '","partName":"PartEffects","fields":{"__proto__":{"polluted":true}}}'));

    expect(snap(host)).toEqual(before);
    expect(({} as any).polluted).toBeUndefined();
  });

  test('state without ids (older peers) gets ids assigned', async () => {
    const net = createFakeNetwork();
    const client = new AppStore(false, 'r', net.join('c'));
    const old = net.join('old');
    net.settle();
    const [sendState] = old.makeAction<any>('state');
    const legacy = snap(client).map(({ id, ...rest }: any) => rest);
    await sendState(legacy);
    expect(snap(client).every((i: any) => !!i.id)).toBe(true);
  });
});

describe('status', () => {
  test('reflects connected peers', () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'));
    expect(host.status()).toBe(Status.disconnected);
    const roomA = net.join('a');
    const a = new AppStore(false, 'r', roomA);
    net.settle();
    expect(host.status()).toBe(Status.connected);
    expect(a.status()).toBe(Status.connected);
    roomA.leave();
    expect(host.status()).toBe(Status.disconnected);
    expect(host.peers).toEqual([]);
  });
});

describe('transport sync', () => {
  test('host play/stop is mirrored by clients, which never touch their own player', async () => {
    const { host, a, b, players } = setup();
    expect([host, a, b].map((s) => s.transport.playing)).toEqual([false, false, false]);

    await host.transport.toggle();
    expect([host, a, b].map((s) => s.transport.playing)).toEqual([true, true, true]);

    host.transport.stop();
    expect([host, a, b].map((s) => s.transport.playing)).toEqual([false, false, false]);

    expect(players.a.calls).toEqual([]);
    expect(players.b.calls).toEqual([]);
  });

  test('a client request is executed by the host and mirrored everywhere', async () => {
    const { host, a, b, players } = setup();
    await a.transport.toggle();
    expect(players.host.calls).toEqual(['toggle']);
    expect([host, a, b].map((s) => s.transport.playing)).toEqual([true, true, true]);

    b.transport.stop();
    expect(players.host.calls).toEqual(['toggle', 'stop']);
    expect([host, a, b].map((s) => s.transport.playing)).toEqual([false, false, false]);
    expect(players.a.calls).toEqual([]);
    expect(players.b.calls).toEqual([]);
  });

  test('a client toggling does not flip its own state before the host confirms', async () => {
    const { net, a, host } = setup({ queued: true });
    net.flush();
    await a.transport.toggle();
    expect(a.transport.playing).toBe(false); // optimistic updates would desync if the host is slow
    net.flush(); // request -> host
    net.flush(); // host broadcast -> clients
    expect(host.transport.playing).toBe(true);
    expect(a.transport.playing).toBe(true);
  });

  test('a late joiner learns the current state', async () => {
    const { net, host } = setup();
    await host.transport.toggle();
    const late = new AppStore(false, 'r', net.join('late'), fakePlayer());
    net.settle();
    expect(late.transport.playing).toBe(true);
  });

  test('state changes that bypass toggle()/stop() are still broadcast', () => {
    const { host, a, players } = setup();
    players.host.isPlaying.set(true); // e.g. something calling the player directly
    expect(a.transport.playing).toBe(true);
    expect(host.transport.playing).toBe(true);
  });

  test('requests sent to a client are ignored; malformed transport payloads are ignored', async () => {
    const net = createFakeNetwork();
    const players = { host: fakePlayer(), a: fakePlayer() };
    const host = new AppStore(true, 'r', net.join('host'), players.host);
    const a = new AppStore(false, 'r', net.join('a'), players.a);
    const rogue = net.join('rogue');
    net.settle();
    const [sendReq] = rogue.makeAction<any>('transportReq');
    const [sendState] = rogue.makeAction<any>('transport');
    await sendReq({ action: 'toggle' }, 'a'); // only the host honours requests
    await sendReq({ action: 'explode' }, 'host');
    await sendState({ playing: 'yes' }, 'a');
    await sendState(undefined as any, 'a');
    expect(players.a.calls).toEqual([]);
    expect(players.host.calls).toEqual([]);
    expect(a.transport.playing).toBe(false);
    expect(host.transport.playing).toBe(false);
  });
});

describe('playhead sync', () => {
  afterEach(() => vi.useRealTimers());

  test('a client extrapolates the host position from the last message', async () => {
    vi.useFakeTimers();
    const { host, a, players } = setup();
    players.host.time.set(10);
    await host.transport.toggle();
    expect(a.transport.position()).toBeCloseTo(10);

    vi.advanceTimersByTime(2000); // 2s at 0.5 cycles/s = 1 cycle
    expect(a.transport.position()).toBeCloseTo(11);
  });

  test('uses the host tempo', async () => {
    vi.useFakeTimers();
    const { host, a, players } = setup();
    players.host.cps = 2;
    await host.transport.toggle();
    vi.advanceTimersByTime(1500);
    expect(a.transport.position()).toBeCloseTo(3);
  });

  test('position is frozen while stopped', async () => {
    vi.useFakeTimers();
    const { host, a, players } = setup();
    await host.transport.toggle();
    players.host.time.set(7);
    host.transport.stop();
    vi.advanceTimersByTime(5000);
    expect(a.transport.position()).toBeCloseTo(7);
  });

  test('clients with very different latencies all converge on the host position', async () => {
    vi.useFakeTimers();
    const { host, a, b, players } = setup({ latency: { host: 20, a: 100, b: 400 } });
    await vi.advanceTimersByTimeAsync(2000); // join-time messages + pings settle
    players.host.time.set(10);
    await host.transport.toggle();
    await vi.advanceTimersByTimeAsync(0);
    // let the message arrive and each client's ping resolve; stay under the 4s host resync
    await vi.advanceTimersByTimeAsync(2000);

    // The host started at 10 two seconds ago, at 0.5 cycles/s -> 11 now. Delivery took 120ms (a) and
    // 420ms (b), but each client adds its own measured one-way delay back, so they agree.
    expect(a.transport.position()).toBeCloseTo(11, 2);
    expect(b.transport.position()).toBeCloseTo(11, 2);
  });

  test('the latency measured on an earlier message is already applied when the next one arrives', async () => {
    vi.useFakeTimers();
    const { host, b, players } = setup({ latency: { b: 400 } });
    await vi.advanceTimersByTimeAsync(5000); // the join-time message let b measure its latency
    players.host.time.set(10);
    await host.transport.toggle();
    await vi.advanceTimersByTimeAsync(400); // message arrives after 400ms
    // truth is 10 + 0.4s * 0.5 = 10.2, and b already compensates for the 400ms in flight
    expect(b.transport.position()).toBeCloseTo(10.2, 2);
    await vi.advanceTimersByTimeAsync(800);
    expect(b.transport.position()).toBeCloseTo(10.6, 2); // 10 + 1.2s * 0.5
  });

  test('a stale transport message that arrives late does not override a newer one', async () => {
    vi.useFakeTimers();
    const { net, host, a } = setup({ latency: { a: 500 } });
    await vi.advanceTimersByTimeAsync(2000);

    await host.transport.toggle(); // "playing" - takes 500ms to reach a
    net.setLatency('a', 0); // the network recovers...
    host.transport.stop(); // ..."stopped" overtakes it
    await vi.advanceTimersByTimeAsync(0);
    expect(a.transport.playing).toBe(false);

    await vi.advanceTimersByTimeAsync(1000); // the stale "playing" finally arrives
    expect(a.transport.playing).toBe(false);
  });

  test('a restarted host is not ignored because of an earlier session', async () => {
    vi.useFakeTimers();
    const net = createFakeNetwork();
    const hostRoom1 = net.join('host');
    const first = new AppStore(true, 'r', hostRoom1, fakePlayer());
    const client = new AppStore(false, 'r', net.join('c'), fakePlayer());
    net.settle();
    for (let i = 0; i < 5; i++) await first.transport.toggle();
    hostRoom1.leave();
    vi.advanceTimersByTime(5000); // the page reload takes a while

    // host reloads the page: a new Transport starts counting from scratch
    const player = fakePlayer();
    const second = new AppStore(true, 'r', net.join('host'), player);
    net.settle();
    await second.transport.toggle();
    expect(client.transport.playing).toBe(true);
  });

  test('host re-announces its position while playing, so clients correct drift', async () => {
    vi.useFakeTimers();
    const { host, a, players, net } = setup();
    await host.transport.toggle();
    players.host.time.set(12); // host is actually ahead of what the client extrapolates
    await vi.advanceTimersByTimeAsync(4000);
    expect(a.transport.last?.cycle).toBe(12);
    expect(a.transport.position()).toBeCloseTo(12);

    // and stops announcing once stopped
    host.transport.stop();
    const sent = net.log.length;
    await vi.advanceTimersByTimeAsync(20000);
    expect(net.log.length).toBe(sent);
  });

  test('a client with no message yet reports 0', () => {
    const { a } = setup();
    expect(a.transport.position()).toBe(0);
  });
});
