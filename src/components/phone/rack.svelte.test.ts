import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import RackModules from './RackModules.svelte';
import QuickRack from './QuickRack.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { PianoScale } from '$lib/instruments/MonoSynth';
import {
  PartChords,
  PartEffects,
  PartEnvelope,
  PartFilter,
  PartVoice,
  makePartData
} from '$lib/parts.svelte';
import type { Command } from '$lib/commands';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function mount() {
  const instrumentData = $state(
    createInstrument(PianoScale, [
      makePartData(PartVoice),
      makePartData(PartEnvelope, { attack: 0.005, decay: 0.6, sustain: 0.3, release: 0.3 }),
      makePartData(PartChords),
      makePartData(PartEffects)
    ])
  );
  const dispatch = vi.fn<(cmd: Command) => void>();
  render(RackModules, { props: { instrumentData, dispatch } });
  return { instrumentData, dispatch };
}

describe('the phone rack', () => {
  test('"Add module" lists the parts it can still take, by role, and adds the one tapped', async () => {
    const { instrumentData, dispatch } = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Add module' }));
    const picker = screen.getByRole('region', { name: 'Add module' });
    // the rack already has voice, envelope, chords and effects
    expect(screen.queryByRole('button', { name: 'Add Voice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Chords' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add FM' })).toBeInTheDocument();
    expect(picker.textContent).toMatch(/Note FX.*Sound.*Sound FX/);
    await fireEvent.click(screen.getByRole('button', { name: 'Add Filter' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'addPart',
      instrumentId: instrumentData.id,
      partName: PartFilter.id
    });
    expect(screen.queryByRole('region', { name: 'Add module' })).toBeNull();
  });

  test('modules sit under a header per role, in signal order', () => {
    mount();
    const groups = [...document.querySelectorAll('[data-role]')];
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual([
      'Notes',
      'Note FX',
      'Sound',
      'Sound FX'
    ]);
    // chords before the voice, the voice and its envelope before the effects
    const titles = (role: string) =>
      [...document.querySelectorAll(`[data-role="${role}"] [data-part]`)].map((p) =>
        p.getAttribute('aria-label')
      );
    expect(titles('noteFx')).toContain('Chords');
    expect(titles('sound')).toHaveLength(2);
    expect(titles('soundFx')).toHaveLength(1);
  });

  test('sliders become knobs, and turning one with the keyboard sends the part change', async () => {
    const { instrumentData, dispatch } = mount();
    const attack = screen.getByRole('slider', { name: 'Attack' });
    expect(attack).toHaveAttribute('aria-valuenow', '0.005');
    await fireEvent.keyDown(attack, { key: 'ArrowUp' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setPartFields',
      instrumentId: instrumentData.id,
      partName: PartEnvelope.id,
      fields: { attack: 0.01 }
    });
    expect(screen.getByRole('img', { name: /Envelope: attack/ })).toBeInTheDocument();
  });

  test('a wave button picks the sound', async () => {
    const { dispatch } = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Square' }));
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ partName: PartVoice.id, fields: { sound: 'square' } })
    );
  });

  test('a part that can be switched off has its power switch in the header', async () => {
    const { dispatch } = mount();
    const power = screen.getByRole('button', { name: 'Chords on' });
    expect(power).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Enabled' })).toBeNull(); // not twice
    await fireEvent.click(power);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ partName: PartChords.id, fields: { enabled: true } })
    );
  });

  test('few options are chips; tapping one chooses it', async () => {
    const { dispatch } = mount();
    const group = screen.getByRole('group', { name: 'Chords' });
    const chip = group.querySelector('button[aria-pressed="false"]') as HTMLButtonElement;
    await fireEvent.click(chip);
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ partName: PartChords.id, fields: { mode: chip.textContent } })
    );
  });

  test('a module folds from its header, and stays folded on this device', async () => {
    mount();
    const header = screen.getByRole('button', { name: /^Effects/ });
    expect(header).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.click(header);
    expect(header).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('slider', { name: 'Reverb' })).toBeNull();
    cleanup();
    mount();
    expect(screen.getByRole('button', { name: /^Effects/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});

describe('the quick rack under the grid', () => {
  test('knobs send commands, and the last tile opens the full rack', async () => {
    const instrumentData = $state(createInstrument(PianoScale, [makePartData(PartEffects)]));
    const dispatch = vi.fn<(cmd: Command) => void>();
    const onOpenRack = vi.fn();
    render(QuickRack, { props: { instrumentData, dispatch, onOpenRack } });
    await fireEvent.keyDown(screen.getByRole('slider', { name: 'Volume' }), { key: 'Home' });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: instrumentData.id,
      fields: { volume: 0 }
    });
    await fireEvent.keyDown(screen.getByRole('slider', { name: 'Reverb' }), { key: 'End' });
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ partName: PartEffects.id, fields: { reverb: 1 } })
    );
    await fireEvent.click(screen.getAllByRole('button', { name: /All modules/ })[0]);
    expect(onOpenRack).toHaveBeenCalled();
  });
});
