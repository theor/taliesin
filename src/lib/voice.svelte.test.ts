import { describe, expect, it } from 'vitest';

import { createInstrument, getInstrument, presets } from './Store.svelte';
import { DEFAULT_SCALE, getPart, getPartType, PartVoice } from './parts.svelte';
import { applySongCommand, type Env } from './commands';
import type { InstrumentData } from './instruments';

const bass = () => {
  const p = presets.find((x) => x.name === 'Bass')!;
  const data = createInstrument(p.instrument, p.parts, p.name);
  return { data, inst: getInstrument(data)! };
};

describe('PartVoice', () => {
  it('plays the chosen sound', () => {
    const { data, inst } = bass();
    expect(inst.generate(data, DEFAULT_SCALE)).toContain('.sound("square")');
    getPart(PartVoice, data)!.sound = 'supersaw';
    expect(inst.generate(data, DEFAULT_SCALE)).toContain('.sound("supersaw")');
  });

  it('never puts an unknown name into the code', () => {
    const { data, inst } = bass();
    getPart(PartVoice, data)!.sound = '"); evil("';
    expect(inst.generate(data, DEFAULT_SCALE)).not.toContain('evil');
    expect(inst.generate(data, DEFAULT_SCALE)).toContain('.sound("sawtooth")');
  });

  it('keeps the sawtooth for instruments saved without a voice', () => {
    const { data, inst } = bass();
    data.parts = data.parts.filter((p) => p.partName !== PartVoice.id);
    expect(inst.generate(data, DEFAULT_SCALE)).toContain('.sound("sawtooth")');
  });
});

describe('FM and envelope', () => {
  const make = (name: string) => {
    const p = presets.find((x) => x.name === name)!;
    const data = createInstrument(p.instrument, p.parts, p.name);
    return { data, inst: getInstrument(data)! };
  };

  it('FM Bell modulates the pitch with a decaying modulator', () => {
    const { data, inst } = make('FM Bell');
    const code = inst.generate(data, DEFAULT_SCALE);
    expect(code).toContain('.fm(6).fmh(3.5).fmdecay(0.8).fmsustain(0)');
    expect(code).toContain('.decay(1.2).sustain(0)');
  });

  it('Pluck has no sustain', () => {
    const { data, inst } = make('Pluck');
    expect(inst.generate(data, DEFAULT_SCALE)).toMatch(
      /\.sound\("gm_acoustic_guitar_nylon"\)[\s\S]*\.sustain\(0\)/
    );
  });

  it('clamps numbers from peers', () => {
    const { data, inst } = make('FM Bell');
    const fm = data.parts.find((p) => p.partName === 'PartFm') as any;
    fm.index = 1e9;
    fm.ratio = NaN;
    const code = inst.generate(data, DEFAULT_SCALE);
    expect(code).toContain('.fm(32).fmh(1)');
    expect(code).not.toContain('NaN');
  });

  it('plain instruments get no FM', () => {
    const { data, inst } = make('Bass');
    expect(inst.generate(data, DEFAULT_SCALE)).not.toContain('.fm(');
  });
});

describe('presets', () => {
  it('every synth preset shapes its notes with an envelope', () => {
    for (const p of presets.filter((x) => x.instrument.name === 'PianoScale')) {
      const data = createInstrument(p.instrument, p.parts, p.name);
      expect(getInstrument(data)!.generate(data, DEFAULT_SCALE), p.name).toContain('.attack(');
    }
  });
});

describe('instruments from the network or a save', () => {
  const env: Env = {
    sequencerFor: () => undefined,
    instrumentInput: (n) => (n === 'PianoScale' ? 'MonoSequence' : undefined),
    partType: getPartType,
    canAddPart: () => false
  };
  const add = (instrument: unknown) => {
    const song = { instrumentsData: [] as InstrumentData[], volume: 1, scale: DEFAULT_SCALE };
    const ok = applySongCommand(
      song,
      { type: 'addInstrument', instrument: instrument as any },
      env
    );
    return ok ? song.instrumentsData[0] : undefined;
  };
  const base = { id: 'x', name: 'Piano', instrumentName: 'PianoScale', volume: 1, state: 0 };
  const melody = { partName: 'MonoSequence', notes: [1] };

  it('gives a part saved before a field existed that field, keeping what was saved; unknown parts are dropped', () => {
    const i = add({
      ...base,
      parts: [
        melody,
        { partName: 'PartChords', enabled: true, mode: 'root' },
        { partName: 'Mystery', a: 1 }
      ]
    });
    expect(i!.parts).toEqual([
      melody,
      { partName: 'PartChords', enabled: true, mode: 'root', hold: 'bar' }
    ]);
  });
  it('replaces a field that is not valid for its part by its default', () => {
    const i = add({
      ...base,
      parts: [
        melody,
        { partName: 'PartVoice', sound: 'nope' },
        { partName: 'PartEffects', reverb: '0);evil();(' }
      ]
    });
    expect(i!.parts).toEqual([
      melody,
      { partName: 'PartVoice', sound: 'sawtooth' },
      { partName: 'PartEffects', reverb: 0, delay: 0, chorus: 0 }
    ]);
  });
  it('rejects malformed instruments', () => {
    expect(add({ ...base, parts: 'nope' })).toBeUndefined();
    expect(add({ ...base, volume: 7, parts: [] })).toBeUndefined();
    expect(add({ ...base, instrumentName: 'Theremin', parts: [] })).toBeUndefined();
  });
});
