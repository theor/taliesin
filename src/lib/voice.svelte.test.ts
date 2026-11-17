import { describe, expect, it, vi } from 'vitest';

vi.mock('./context', () => ({
  getGlobalContext: () => ({ host: true, debug: false, roomId: 'r', scaleKey: 'A', scaleMode: 'minor' }),
  setGlobalContext: () => {}
}));
import { createInstrument, getInstrument, presets } from './Store.svelte';
import { getPart } from './instruments';
import { PartVoice } from './parts.svelte';

const bass = () => {
  const p = presets.find((x) => x.name === 'Bass')!;
  const data = createInstrument(p.instrument, p.parts, p.name);
  return { data, inst: getInstrument(data)! };
};

describe('PartVoice', () => {
  it('plays the chosen sound', () => {
    const { data, inst } = bass();
    expect(inst.generate(data)).toContain('.sound("square")');
    getPart(PartVoice, data)!.sound = 'supersaw';
    expect(inst.generate(data)).toContain('.sound("supersaw")');
  });

  it('never puts an unknown name into the code', () => {
    const { data, inst } = bass();
    getPart(PartVoice, data)!.sound = '"); evil("';
    expect(inst.generate(data)).not.toContain('evil');
    expect(inst.generate(data)).toContain('.sound("sawtooth")');
  });

  it('keeps the sawtooth for instruments saved without a voice', () => {
    const { data, inst } = bass();
    data.parts = data.parts.filter((p) => p.partName !== PartVoice.name);
    expect(inst.generate(data)).toContain('.sound("sawtooth")');
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
    const code = inst.generate(data);
    expect(code).toContain('.fm(6).fmh(3.5).fmdecay(0.8).fmsustain(0)');
    expect(code).toContain('.decay(1.2).sustain(0)');
  });

  it('Pluck has no sustain', () => {
    const { data, inst } = make('Pluck');
    expect(inst.generate(data)).toMatch(/\.sound\("gm_acoustic_guitar_nylon"\)[\s\S]*\.sustain\(0\)/);
  });

  it('clamps numbers from peers', () => {
    const { data, inst } = make('FM Bell');
    const fm = data.parts.find((p) => p.partName === 'PartFm') as any;
    fm.index = 1e9;
    fm.ratio = NaN;
    const code = inst.generate(data);
    expect(code).toContain('.fm(32).fmh(1)');
    expect(code).not.toContain('NaN');
  });

  it('plain instruments get no FM', () => {
    const { data, inst } = make('Bass');
    expect(inst.generate(data)).not.toContain('.fm(');
  });
});

describe('presets', () => {
  it('every synth preset shapes its notes with an envelope', () => {
    for (const p of presets.filter((x) => x.instrument.name === 'PianoScale')) {
      const data = createInstrument(p.instrument, p.parts, p.name);
      expect(getInstrument(data)!.generate(data), p.name).toContain('.attack(');
    }
  });
});
