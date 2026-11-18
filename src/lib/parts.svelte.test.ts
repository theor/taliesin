import { describe, expect, test } from 'vitest';
import { createInstrument, getInstrument, presets } from './Store.svelte';
import {
  ArpeggiatorType,
  ChordHold,
  DEFAULT_SCALE,
  FilterType,
  PartArpeggiator,
  PartChords,
  PartFilter,
  VoicingMode,
  getPartType,
  makePartData,
  PART_TYPES,
  type GenContext
} from './parts.svelte';

const ctx = (
  stepsPerMeasure: number,
  measures: number,
  degrees?: GenContext['degrees']
): GenContext => ({
  stepsPerMeasure,
  measures,
  ...DEFAULT_SCALE,
  degrees
});

describe('PartFilter', () => {
  const filter = new PartFilter();
  const gen = (data: Partial<PartFilter['dataType']>) =>
    filter.generate(undefined!, filter.createData(data));

  test('each type uses its own cutoff, resonance and envelope controls', () => {
    expect(gen({ type: FilterType.lowpass, freq: 800, res: 4, env: 2 })).toBe(
      '.lpf(800).lpq(4).lpenv(2)'
    );
    expect(gen({ type: FilterType.highpass, freq: 300, res: 1, env: 0 })).toBe('.hpf(300).hpq(1)');
    expect(gen({ type: FilterType.bandpass, freq: 1200, res: 8, env: 3 })).toBe(
      '.bpf(1200).bpq(8).bpenv(3)'
    );
  });

  test('a filter saved before the type and envelope existed sounds as it did', () => {
    const old = filter.normalize({ partName: PartFilter.id, freq: 400, res: 0.5 }, false)!;
    expect(old).toMatchObject({ type: FilterType.lowpass, env: 4 });
    expect(filter.generate(undefined!, old)).toBe('.lpf(400).lpq(0.5).lpenv(4)');
  });

  test('an unknown type or out-of-range values never reach the code', () => {
    expect(filter.normalize({ partName: PartFilter.id, type: 'notch' })).toBeNull();
    expect(gen({ type: '");evil(' as FilterType, res: 999, env: -1 })).toBe('.lpf(1000).lpq(50)');
  });
});

describe('PartArpeggiator.generate', () => {
  const gen = (type: ArpeggiatorType, enabled = true, speed = 2) =>
    new PartArpeggiator().generate(undefined!, {
      partName: 'PartArpeggiator',
      enabled,
      speed,
      arpeggiatorType: type
    });

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
      ctx(stepsPerMeasure, measures, notes)
    );

  test('nothing when disabled', () => {
    expect(
      new PartChords().generate(
        undefined!,
        { partName: 'PartChords', enabled: false, mode: VoicingMode.below, hold: ChordHold.bar },
        ctx(4, 1, [0])
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
      expect(gen([0, null, null, null, null, null, null, null], ChordHold.bar, [], 4, 2)).toContain(
        'n("<0 ~>")'
      );
    });
    test('half of an odd bar is the whole bar, so chords stay in line with the loop', () => {
      expect(PartChords.holdSteps(ChordHold.half, 7)).toBe(7);
      expect(PartChords.holdSteps(ChordHold.half, 8)).toBe(4);
      expect(PartChords.holdSteps(ChordHold.step, 8)).toBe(1);
    });
    test('the octave follows the melody', () => {
      expect(gen([0, 1], ChordHold.bar, [{ partName: 'PartOctave', octave: 3 }])).toContain(
        'anchor("A3")'
      );
    });
    test('the arpeggio plays the held chord at its usual rate, not the melody', () => {
      const arp = {
        partName: 'PartArpeggiator',
        enabled: true,
        speed: 2,
        arpeggiatorType: ArpeggiatorType.up
      };
      const data = {
        parts: [
          { partName: 'MonoSequence', notes: [0, 1, 2, 3] },
          { partName: 'PartChords', enabled: true, mode: VoicingMode.below, hold: ChordHold.bar },
          arp
        ]
      } as any;
      const c = { ...ctx(4, 1, [0, 1, 2, 3]), consumed: new Set<string>() };
      const code = new PartChords().generate(data, data.parts[1], c);
      expect(code).toContain('.voicing().arp("[0 1 2] * 8").velocity(0.6).slow(4)'); // 2 per step, 4 steps
      expect([...c.consumed]).toEqual(['PartArpeggiator']); // so the instrument does not apply it to the melody
    });
    test('the instrument applies the arpeggio once: on the held chord, not on the melody too', () => {
      const piano = presets.find((p) => p.name === 'Piano')!;
      const data = createInstrument(piano.instrument, [
        ...piano.parts,
        makePartData(PartChords, { enabled: true, hold: ChordHold.bar }),
        makePartData(PartArpeggiator, { enabled: true, speed: 2 })
      ]);
      const code = getInstrument(data)!.generate(data, DEFAULT_SCALE);
      expect(code.match(/\.arp\(/g)).toHaveLength(1);
      expect(code).toMatch(/\.voicing\(\)\.arp\([^)]*\)\.velocity/);
      // one chord per step: no held layer, so the arpeggio is on the chain
      const perStep = createInstrument(piano.instrument, [
        ...piano.parts,
        makePartData(PartChords, { enabled: true, hold: ChordHold.step }),
        makePartData(PartArpeggiator, { enabled: true, speed: 2 })
      ]);
      expect(getInstrument(perStep)!.generate(perStep, DEFAULT_SCALE)).toContain(
        '.voicing()\n  .arp('
      );
    });
  });
});

describe('part validation', () => {
  test('ids are stable strings, not class names', () => {
    expect(PART_TYPES.map((P) => P.id)).toEqual([
      'MonoSequence',
      'PartTrackNotes',
      'PartVoice',
      'PartFm',
      'PartEnvelope',
      'PartChords',
      'PartArpeggiator',
      'PartFilter',
      'PartOctave',
      'PartSteps',
      'PartEffects'
    ]);
  });
  test('every default is valid for its own part', () => {
    for (const P of PART_TYPES) {
      const part = getPartType(P.id)!;
      expect(part.normalize(part.createData()), P.id).toEqual(part.createData());
    }
  });
  test('numbers are clamped, wrong types and unknown values rejected', () => {
    const steps = getPartType('PartSteps')!;
    expect(
      steps.normalize({ stepsPerMeasure: 1e9, measures: 0, oddSignature: false })
    ).toMatchObject({
      stepsPerMeasure: 64,
      measures: 1
    });
    expect(steps.normalize({ stepsPerMeasure: '8' })).toBeNull();
    expect(getPartType('PartChords')!.normalize({ mode: 'sideways' })).toBeNull();
    expect(getPartType('PartChords')!.normalize({ mode: 'sideways' }, false)).toMatchObject({
      mode: 'below'
    });
  });
  test('melody steps are integers or rests', () => {
    const seq = getPartType('MonoSequence')!;
    expect(seq.normalize({ notes: [1, null, undefined, 7] })).toEqual({
      partName: 'MonoSequence',
      notes: [1, undefined, undefined, 7]
    });
    expect(seq.normalize({ notes: ['1")+evil+("'] })).toBeNull();
    expect(seq.normalize({ notes: [1.5] })).toBeNull();
  });
  test('drum tracks are known sounds with hits', () => {
    const drums = getPartType('PartTrackNotes')!;
    expect(drums.normalize({ notes: { bd: [1, 0] } })).toEqual({
      partName: 'PartTrackNotes',
      notes: { bd: [1, 0] }
    });
    expect(drums.normalize({ notes: { 'bd")+evil+("': [1] } })).toBeNull();
    expect(drums.normalize({ notes: { bd: ['x'] } })).toBeNull();
  });
});
