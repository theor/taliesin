import { describe, expect, test, vi } from 'vitest';
import './Store.svelte'; // load the store first: instruments and the store import each other
import { ArpeggiatorType, ChordHold, PartArpeggiator, PartChords, VoicingMode } from './parts.svelte';

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
  const gen = (
    notes: (number | null | undefined)[],
    hold = ChordHold.step,
    extra: object[] = [],
    stepsPerMeasure = notes.length,
    measures = 1
  ) =>
    new PartChords().generate(
      { parts: [{ partName: 'MonoSequence', notes }, ...extra] } as any,
      { partName: 'PartChords', enabled: true, mode: VoicingMode.below, hold },
      { stepsPerMeasure, measures } as any
    );

  test('nothing when disabled', () => {
    expect(
      new PartChords().generate(
        undefined!,
        { partName: 'PartChords', enabled: false, mode: VoicingMode.below, hold: ChordHold.bar },
        {} as any
      )
    ).toBe('');
  });
  test('new chords default to holding a bar under the melody, melody on top', () => {
    expect(new PartChords().defaultData()).toEqual({ enabled: false, mode: 'below', hold: 'bar' });
  });

  describe('one chord per step', () => {
    test('qualities are spelled the way the triad dictionary knows them, and it is used', () => {
      // A minor: i m, ii° o, III M, iv m
      const code = gen([0, 1, 2, 3]);
      expect(code).toContain('.asChords("<m o M m>")');
      expect(code).toContain(".dict('triads')");
      expect(code).not.toContain('dim'); // "Bdim" is an unknown chord to Strudel: silent, and an error in the log
    });
    test('rests get a filler quality', () => {
      expect(gen([0, undefined])).toContain('.asChords("<m m>")');
      expect(gen([0, null])).toContain('.asChords("<m m>")'); // saved songs turn undefined into null
    });
  });

  describe('held chords', () => {
    test('a bar: one chord per bar from its first note, held under the melody, around a fixed anchor', () => {
      // 4 steps a bar, 2 bars; the first bar starts on a rest, so its chord comes from its first note (1)
      const code = gen([null, 1, 2, null, 4, null, null, 0], ChordHold.bar, [], 4, 2);
      expect(code).toBe(
        `.stack(n("<1 4>").scale("A4:minor").asChords("<o m>").dict('triads').anchor("A4").mode('below').voicing().velocity(0.6).slow(4))`
      );
    });
    test('a half bar', () => {
      expect(gen([0, 1, 2, 3], ChordHold.half)).toContain('n("<0 2>")');
      expect(gen([0, 1, 2, 3], ChordHold.half)).toContain('.slow(2)');
    });
    test('a bar with no note has no chord', () => {
      expect(gen([0, null, null, null, null, null, null, null], ChordHold.bar, [], 4, 2)).toContain('n("<0 ~>")');
    });
    test('half of an odd bar is the whole bar, so chords stay in line with the loop', () => {
      expect(PartChords.holdSteps(ChordHold.half, 7)).toBe(7);
      expect(PartChords.holdSteps(ChordHold.half, 8)).toBe(4);
      expect(PartChords.holdSteps(ChordHold.step, 8)).toBe(1);
    });
    test('the octave follows the melody', () => {
      expect(gen([0, 1], ChordHold.bar, [{ partName: 'PartOctave', octave: 3 }])).toContain('anchor("A3")');
    });
    test('the arpeggio plays the held chord at its usual rate, not the melody', () => {
      const arp = { partName: 'PartArpeggiator', enabled: true, speed: 2, arpeggiatorType: ArpeggiatorType.up };
      const data = {
        parts: [
          { partName: 'MonoSequence', notes: [0, 1, 2, 3] },
          { partName: 'PartChords', enabled: true, mode: VoicingMode.below, hold: ChordHold.bar },
          arp
        ]
      } as any;
      const code = new PartChords().generate(data, data.parts[1], { stepsPerMeasure: 4, measures: 1 } as any);
      expect(code).toContain('.voicing().arp("[0 1 2] * 8").velocity(0.6).slow(4)'); // 2 per step, 4 steps
      expect(new PartArpeggiator().generate(data, arp, { stepsPerMeasure: 4, measures: 1 } as any)).toBe('');
    });
  });
});
