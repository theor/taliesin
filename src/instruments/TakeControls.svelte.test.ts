import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/svelte';
import RecordView from './RecordView.svelte';
import { createInstrument, getInstrument } from '$lib/Store.svelte';
import { PianoScale } from '$lib/instruments/MonoSynth';
import { getPart, MonoSequence } from '$lib/parts.svelte';
import type { Command } from '$lib/commands';

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * The take card, through the pads view of a piano (8 steps a bar, 2 bars; its melody is
 * 1 2 3 - 4 5 3 - on the first bar). Commands are applied to the instrument, as the store would.
 */
function mount() {
  // reactive, as the store's song is: the view must see the edits the take dispatches
  const instrumentData = $state(createInstrument(PianoScale));
  const seq = getInstrument(instrumentData)!.sequencer!;
  const dispatch = vi.fn((cmd: Command) => {
    if (cmd.type !== 'setCells') return;
    for (const c of cmd.cells) seq.setCell(instrumentData, cmd.track, c.step, c.on);
  });
  const clock = { t: 1.1 }; // in bar 2: a take armed now starts at the next loop, on step 1
  const view = render(RecordView, {
    props: { index: 0, instrumentData, dispatch, playing: true, position: 0, now: () => clock.t }
  });
  const pad = (track: number) => view.container.querySelectorAll('[aria-label^="Play "]')[track];
  const notes = () => [...getPart(MonoSequence, instrumentData)!.notes];
  const stateAt = (step: number) =>
    [...view.container.querySelectorAll(`[data-step="${step}"] [data-state]`)].map((n) =>
      n.getAttribute('data-state')
    );
  return { instrumentData, dispatch, clock, pad, notes, stateAt, ...view };
}

describe('the take card', () => {
  test('armed: counts the beats down to the next bar', async () => {
    const { getByLabelText, getByTestId, clock } = mount();
    clock.t = 1.1; // 0.9 bars to go: 4 beats
    await fireEvent.click(getByLabelText('Record a take'));
    expect(getByTestId('take-status')).toHaveTextContent('Armed');
    expect(getByLabelText('Cancel the take')).toBeInTheDocument();
    expect(getByTestId('take-controls')).toHaveTextContent('Starts in 4 beats');
    expect(getByTestId('count-in').children).toHaveLength(4);
  });

  test('the strip shows old notes, the ones cleared ahead, and the take’s own', async () => {
    const { getByLabelText, clock, pad, stateAt } = mount();
    expect(stateAt(0)).toEqual(['old']);
    await fireEvent.click(getByLabelText('Record a take'));
    clock.t = 2.025; // song step 16.2: loop step 0, and step 1 cleared just ahead
    await fireEvent.pointerDown(pad(4));
    expect(stateAt(0)).toEqual(['new']);
    expect(stateAt(1)).toEqual(['cleared']);
    expect(stateAt(2)).toEqual(['old']);
  });

  test('stopping gives a summary, and Undo take puts the melody back', async () => {
    const { getByLabelText, getByRole, queryByRole, getByTestId, clock, pad, notes } = mount();
    const before = notes();
    await fireEvent.click(getByLabelText('Record a take'));
    clock.t = 2.025;
    await fireEvent.pointerDown(pad(4));
    await fireEvent.click(getByLabelText('Stop recording'));
    expect(getByTestId('take-status')).toHaveTextContent('Take recorded');
    expect(getByTestId('take-controls')).toHaveTextContent('1 note');
    expect(notes()).not.toEqual(before);

    await fireEvent.click(getByRole('button', { name: /Undo take/ }));
    expect(notes().slice(0, 8)).toEqual(before.slice(0, 8));
    expect(getByTestId('take-status')).toHaveTextContent('Record a take');
    expect(queryByRole('button', { name: /Undo take/ })).toBeNull();
  });

  test('settings: a summary that opens a sheet; choices are saved per device', async () => {
    const { getByRole, queryByRole } = mount();
    const summary = getByRole('button', { name: /^Take settings/ });
    expect(summary).toHaveTextContent('Replace as it plays · stop after 1 loop · hear on');
    await fireEvent.click(summary);
    const sheet = getByRole('dialog', { name: 'Take settings' });
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Keep' }));
    await fireEvent.click(within(sheet).getByRole('button', { name: 'Keep layering' }));
    expect(within(sheet).getByRole('button', { name: 'Keep' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await fireEvent.keyDown(sheet, { key: 'Escape' });
    expect(queryByRole('dialog')).toBeNull();
    expect(getByRole('button', { name: /^Take settings/ })).toHaveTextContent(
      'Keep old notes · keep layering · hear on'
    );
    expect(JSON.parse(localStorage.getItem('taliesin:take')!)).toEqual({
      oldNotes: 'keep',
      loop: true
    });
  });

  test('keep: the take adds without clearing anything', async () => {
    const { getByLabelText, getByRole, clock, pad, notes } = mount();
    await fireEvent.click(getByRole('button', { name: /^Take settings/ }));
    await fireEvent.click(getByRole('button', { name: 'Keep' }));
    await fireEvent.click(getByRole('button', { name: 'Done' }));
    await fireEvent.click(getByLabelText('Record a take'));
    clock.t = 2.025;
    await fireEvent.pointerDown(pad(4)); // replaces step 0's note: a melody holds one per step
    expect(notes().slice(0, 8)).toEqual([4, 2, 3, null, 4, 5, 3, null].map((n) => n ?? undefined));
  });
});
