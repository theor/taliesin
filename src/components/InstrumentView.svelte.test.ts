import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import InstrumentView from './InstrumentView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';
import { TrackState, type Constructor, type Instrument as InstrumentBase } from '$lib/instruments';
import type { Command } from '$lib/commands';

// The view in isolation, like SequencerView: it gets state and a spy `dispatch`, and the tests check
// which commands the controls produce.
function mount(Instrument: Constructor<InstrumentBase> = PianoScale, extra: object = {}) {
  const instrumentData = $state(createInstrument(Instrument)); // reactive, like the store's songs
  const dispatch = vi.fn<(cmd: Command) => void>();
  render(InstrumentView, { props: { index: 0, instrumentData, dispatch, ...extra } });
  return { instrumentData, dispatch };
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('InstrumentView', () => {
  test('the grid and the quick controls are on screen together, without switching views', () => {
    mount();
    expect(document.querySelector('[data-x="0"][data-y="0"]')).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Reverb' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Octave' })).toBeInTheDocument();
  });

  test('a drum kit only offers the controls it has', () => {
    mount(Drum);
    expect(screen.getByRole('slider', { name: 'Volume' })).toBeInTheDocument();
    expect(screen.queryByRole('slider', { name: 'Reverb' })).toBeNull();
  });

  test('a macro slider dispatches an absolute value for the right part', async () => {
    const { dispatch, instrumentData } = mount();
    await fireEvent.input(screen.getByRole('slider', { name: 'Reverb' }), {
      target: { value: '0.7' }
    });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setPartFields',
      instrumentId: instrumentData.id,
      partName: 'PartEffects',
      fields: { reverb: 0.7 }
    });
    await fireEvent.input(screen.getByRole('slider', { name: 'Volume' }), {
      target: { value: '0.4' }
    });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: instrumentData.id,
      fields: { volume: 0.4 }
    });
  });

  test('mute and solo send absolute states, and pressing the active one goes back to playing', async () => {
    const { dispatch, instrumentData } = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: instrumentData.id,
      fields: { state: TrackState.Muted }
    });
    instrumentData.state = TrackState.Muted;
    await fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: instrumentData.id,
      fields: { state: TrackState.Playing }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Solo' }));
    expect(dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ fields: { state: TrackState.Solo } })
    );
  });

  test('randomize works on a drum kit too', async () => {
    const { dispatch } = mount(Drum);
    // a random groove can, with tiny odds, equal the kit's: try a few times
    for (let i = 0; i < 5 && dispatch.mock.calls.length === 0; i++)
      await fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: 'setPartFields',
      partName: 'PartTrackNotes'
    });
  });

  test('removing needs a second, explicit confirmation', async () => {
    const { dispatch, instrumentData } = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Instrument menu' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Remove instrument' }));
    expect(dispatch).not.toHaveBeenCalled(); // one mis-tap is not enough
    await fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(dispatch).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Remove instrument' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'removeInstrument',
      instrumentId: instrumentData.id
    });
  });

  test('the menu clears the pattern and changes the loop length', async () => {
    const { dispatch, instrumentData } = mount();
    await fireEvent.click(screen.getByRole('button', { name: 'Instrument menu' }));
    await fireEvent.click(screen.getByRole('button', { name: /clear pattern/i }));
    expect(dispatch.mock.calls.length).toBeGreaterThan(0);
    expect(dispatch.mock.calls.every(([c]) => c.type === 'setCells')).toBe(true);

    dispatch.mockClear();
    await fireEvent.click(screen.getByRole('button', { name: 'Instrument menu' }));
    await fireEvent.click(screen.getByRole('button', { name: /shorter loop/i }));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setPartFields',
      instrumentId: instrumentData.id,
      partName: 'PartSteps',
      fields: { measures: 1 }
    });
  });

  test('the whole loop is shown, with the playhead on the right step', () => {
    mount(PianoScale, { playing: true, position: 0.5 }); // 8 steps per cycle: half a cycle is step 4
    expect(document.querySelectorAll('[data-y="0"]')).toHaveLength(16);
    expect(document.querySelector('[data-x="4"][data-y="0"]')).toHaveAttribute('data-now');
    expect(document.querySelector('[data-x="5"][data-y="0"]')).not.toHaveAttribute('data-now');
  });

  test('grid rows are named after the notes of the scale', () => {
    mount();
    expect(screen.getAllByText('A').length).toBeGreaterThan(0);
    expect(screen.getByText('A↑')).toBeInTheDocument();
  });
});
