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
