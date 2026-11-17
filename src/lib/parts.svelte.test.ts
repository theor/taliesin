import { describe, expect, test, vi } from 'vitest';
import './Store.svelte'; // load the store first: instruments and the store import each other
import { ArpeggiatorType, PartArpeggiator, PartChords, VoicingMode } from './parts.svelte';

vi.mock('./context', () => ({
  getGlobalContext: () => ({ host: true, debug: false, roomId: 'r', scaleKey: 'A', scaleMode: 'minor' }),
  setGlobalContext: () => {}
}));

describe('PartArpeggiator.generate', () => {
  const gen = (type: ArpeggiatorType, enabled = true, speed = 2) =>
    new PartArpeggiator().generate(
      undefined!,
      { partName: 'PartArpeggiator', enabled, speed, arpeggiatorType: type },
      { stepsPerMeasure: 4, measures: 1 } as any
    );

  test('nothing when disabled', () => {
    expect(gen(ArpeggiatorType.up, false)).toBe('');
  });
  test('the type decides the order of the chord notes', () => {
    expect(gen(ArpeggiatorType.up)).toBe('.arp("[0 1 2] * 2")');
    expect(gen(ArpeggiatorType.down)).toBe('.arp("[2 1 0] * 2")');
    expect(gen(ArpeggiatorType.upDown)).toBe('.arp("[0 1 2 1] * 2")');
    expect(gen(ArpeggiatorType.random)).toBe('.arp("[0|1|2] * 2")');
  });
  test('an unknown type falls back to up', () => {
    expect(gen('sideways' as ArpeggiatorType)).toBe('.arp("[0 1 2] * 2")');
  });
});

describe('PartChords.generate', () => {
  const gen = (notes: (number | undefined)[]) =>
    new PartChords().generate(
      { parts: [{ partName: 'MonoSequence', notes }] } as any,
      { partName: 'PartChords', enabled: true, mode: VoicingMode.root },
      { stepsPerMeasure: notes.length, measures: 1 } as any
    );

  test('nothing when disabled', () => {
    expect(
      new PartChords().generate(undefined!, { partName: 'PartChords', enabled: false, mode: VoicingMode.root }, {} as any)
    ).toBe('');
  });
  test('qualities are spelled the way the triad dictionary knows them, and it is used', () => {
    // A minor: i m, ii° o, III M, iv m
    const code = gen([0, 1, 2, 3]);
    expect(code).toContain('.asChords("<m o M m>")');
    expect(code).toContain(".dict('triads')");
    expect(code).not.toContain('dim'); // "Bdim" is an unknown chord to Strudel: it stays silent and logs an error
  });
  test('rests get a filler quality', () => {
    expect(gen([0, undefined])).toContain('.asChords("<m m>")');
  });
});
