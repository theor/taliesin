import { expect, test, describe } from 'vitest';
import { AppStore, makePartData } from './Store.svelte.js';
import { PartSteps } from './parts.svelte.js';
import { PianoScale } from './instruments/MonoSynth.js';
import { createFakeNetwork } from './testing/fakeRoom.js';

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
});
