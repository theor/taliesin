import { describe, expect, test } from 'vitest';
import './Store.svelte'; // load the store first: instruments and the store import each other
import { ArpeggiatorType, PartArpeggiator } from './parts.svelte';

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
