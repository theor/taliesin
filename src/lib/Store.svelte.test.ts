import { expect, test, describe } from 'vitest';
import { AppStore, makePartData } from './Store.svelte.js';
import { PartSteps } from './parts.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';
import { createFakeNetwork } from './testing/fakeRoom.js';
import { Status } from './interfaces.js';

function setup(opts: { queued?: boolean } = {}) {
  const net = createFakeNetwork(opts);
  const host = new AppStore(true, 'r', net.join('host'));
  const a = new AppStore(false, 'r', net.join('a'));
  const b = new AppStore(false, 'r', net.join('b'));
  net.settle();
  return { net, host, a, b };
}
// JSON round-trip: the wire format turns `undefined` (rests in note arrays) into `null`
const snap = (s: AppStore) => JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData));

test('Multiplier', () => {
  makePartData(PartSteps);
  const store = new AppStore(true, 'r', createFakeNetwork().join('host'));
  const i = store.createInstrument(PianoScale);
  expect(i).toBeDefined();
  expect(i.name).toBe('PianoScale');
});

describe('instrument sync', () => {
  test('clients receive the host state on join', () => {
    const { host, a, b } = setup();
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });

  test('edit propagates host -> clients', () => {
    const { host, a, b } = setup();
    const inst = { ...snap(host)[0], name: 'renamed' };
    host.setInstrument(0, inst);
    expect(snap(a)[0].name).toBe('renamed');
    expect(snap(b)[0].name).toBe('renamed');
  });

  test('edit propagates client -> host and other clients', () => {
    const { host, a, b } = setup();
    a.setInstrument(0, { ...snap(a)[0], name: 'from-a' });
    expect(snap(host)[0].name).toBe('from-a');
    expect(snap(b)[0].name).toBe('from-a');
  });

  // Regression: isReceiving was set on the first remote update and never cleared,
  // so every later local edit was silently not sent.
  test('local edit is still sent after receiving a remote update', () => {
    const { host, a } = setup();
    host.setInstrument(0, { ...snap(host)[0], name: 'remote' });
    expect(snap(a)[0].name).toBe('remote');

    a.setInstrument(0, { ...snap(a)[0], name: 'local-after-remote' });
    expect(snap(host)[0].name).toBe('local-after-remote');
  });

  test('randomize (setInstrumentPartial) propagates', () => {
    const { host, a } = setup();
    a.setInstrumentPartial(1, { volume: 0.123 });
    expect(snap(host)[1].volume).toBe(0.123);
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
    const created = a.createInstrument(PianoScale);
    for (const s of [host, a, b]) expect(snap(s).length).toBe(before + 1);
    expect(snap(host)[before].id).toBe(created.id);
    expect(snap(b)).toEqual(snap(host));
  });

  test('preset propagates', () => {
    const { host, b } = setup();
    host.createInstrumentPreset(host.getPreset('Drum')!);
    expect(snap(b)).toEqual(snap(host));
  });

  test('remove propagates from a client', () => {
    const { host, a, b } = setup();
    const removedId = snap(a)[0].id;
    a.removeInstrument(0);
    for (const s of [host, a, b]) {
      expect(snap(s).some((i: any) => i.id === removedId)).toBe(false);
    }
    expect(snap(b)).toEqual(snap(host));
  });

  test('concurrent remove + edit: the edit lands on the right instrument (addressed by id)', () => {
    const { net, host, a, b } = setup({ queued: true });
    net.flush(); // deliver the join-time state
    expect(snap(b)).toEqual(snap(host));
    const targetId = snap(b)[2].id;

    a.removeInstrument(0); // shifts every index on a and, once delivered, on everyone else
    b.setInstrument(2, { ...snap(b)[2], name: 'edited' });
    net.flush();

    for (const s of [host, a, b]) {
      const list = snap(s);
      expect(list.length).toBe(2);
      expect(list.find((i: any) => i.id === targetId)?.name).toBe('edited');
    }
    expect(snap(a)).toEqual(snap(host));
    expect(snap(b)).toEqual(snap(host));
  });
});

describe('robustness', () => {
  test('unknown instrument id appends instead of overwriting something', () => {
    const { host, a } = setup();
    const before = snap(host).length;
    a.setInstrument(0, { ...snap(a)[0], id: 'brand-new', name: 'new' });
    // setInstrument replaces local index 0 (same slot) but peers only know the new id:
    expect(snap(host).length).toBe(before + 1);
  });

  test('malformed payloads are ignored', async () => {
    const net = createFakeNetwork();
    const host = new AppStore(true, 'r', net.join('host'));
    const rogueRoom = net.join('rogue');
    net.settle();
    const [sendState] = rogueRoom.makeAction<any>('state');
    const [sendInstrument] = rogueRoom.makeAction<any>('instrument');
    const [sendRemove] = rogueRoom.makeAction<any>('remove');
    const before = snap(host);

    await sendState('nope' as any);
    await sendInstrument({} as any);
    await sendInstrument({ id: 'x' } as any);
    await sendRemove({} as any);
    await sendRemove({ id: 'missing' } as any);

    expect(snap(host)).toEqual(before);
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
