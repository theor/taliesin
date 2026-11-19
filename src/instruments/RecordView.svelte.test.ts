import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import RecordView from './RecordView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';
import type { Command } from '$lib/commands';
import { strudel } from '$lib/strudel';

beforeEach(() => localStorage.clear()); // the take options and "hear notes" are saved per device
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Drum: 4 steps per cycle, 2 cycles = 8 steps.
function mount(opts: { playing?: boolean; piano?: boolean } = {}) {
  const instrumentData = opts.piano ? createInstrument(PianoScale) : createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const clock = { t: 0.1 };
  const view = render(RecordView, {
    props: {
      index: 0,
      instrumentData,
      dispatch,
      playing: opts.playing ?? true,
      position: 0,
      now: () => clock.t
    }
  });
  /** Arm a take now (in measure 0): it runs from cycle 1 to cycle 3. Then move the clock into it. */
  const recordFrom = async (cycle: number) => {
    await fireEvent.click(view.getByLabelText('Record a take'));
    clock.t = cycle;
  };
  /** The steps recorded (the take also clears the old pattern: those commands turn cells off). */
  const steps = () =>
    dispatch.mock.calls
      .map(([c]) => (c as Extract<Command, { type: 'setCells' }>).cells)
      .filter((cells) => cells[0].on)
      .map((cells) => cells[0].step);
  return { instrumentData, dispatch, clock, recordFrom, steps, ...view };
}

describe('RecordView', () => {
  test('pads and the record button are disabled, with a hint, while the song is stopped', async () => {
    const { dispatch, getByLabelText, getByTestId } = mount({ playing: false });
    expect(getByLabelText('Play bd')).toBeDisabled();
    expect(getByLabelText('Record a take')).toBeDisabled();
    expect(getByTestId('record-hint')).toBeInTheDocument();
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('"Live" leaves the pattern out on this device until the view closes; "Loop" is the default', async () => {
    const instrumentData = createInstrument(Drum);
    const playHere = vi.fn<(id: string, on: boolean) => void>();
    const view = render(RecordView, {
      props: { index: 0, instrumentData, dispatch: vi.fn(), playing: true, playHere }
    });
    expect(playHere).not.toHaveBeenCalled();
    expect(view.getByRole('button', { name: 'Loop' })).toHaveAttribute('aria-pressed', 'true');
    await fireEvent.click(view.getByRole('button', { name: 'Live' }));
    expect(playHere).toHaveBeenLastCalledWith(instrumentData.id, true);
    view.unmount();
    expect(playHere).toHaveBeenLastCalledWith(instrumentData.id, false);
  });

  test('outside a take the pads only play: nothing is recorded', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { dispatch, getByLabelText } = mount();
    await fireEvent.pointerDown(getByLabelText('Play sd'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
  });

  test('an armed take waits for the next measure', async () => {
    const { dispatch, getByLabelText, clock } = mount();
    await fireEvent.click(getByLabelText('Record a take'));
    expect(getByLabelText('Cancel the take')).toHaveAttribute('data-phase', 'armed');
    clock.t = 0.5; // still measure 0
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('during a take a pad records its track at the current quantized step', async () => {
    const { dispatch, instrumentData, getByLabelText, recordFrom } = mount();
    await recordFrom(1.5);
    await fireEvent.pointerDown(getByLabelText('Play sd'));
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 1, // bd, sd, hh ...
      cells: [{ step: 6, on: true }] // 1.5 cycles * 4 steps
    });
    expect(getByLabelText('Play sd')).toHaveTextContent('step 7');
  });

  test('every press reads the clock again', async () => {
    const { getByLabelText, recordFrom, clock, steps } = mount();
    await recordFrom(1.25);
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    clock.t = 1.75;
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    expect(steps()).toEqual([5, 7]);
  });

  test('a melodic instrument gets a pad per scale degree', async () => {
    const { dispatch, instrumentData, recordFrom } = mount({ piano: true });
    const pads = document.querySelectorAll('[aria-label^="Play "]');
    expect(pads.length).toBe(8);
    await recordFrom(1);
    await fireEvent.pointerDown(pads[3]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setCells', instrumentId: instrumentData.id, track: 3 })
    );
  });

  test('a coarser quantize snaps to every 2nd step', async () => {
    const { getByLabelText, getByRole, recordFrom, steps } = mount();
    await fireEvent.click(getByRole('button', { name: /^Take settings/ }));
    await fireEvent.click(getByRole('button', { name: '2 steps' }));
    await fireEvent.click(getByRole('button', { name: 'Done' }));
    await recordFrom(1.3); // 5.2 steps
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    expect(steps()).toEqual([6]); // 2.6 pairs of steps -> 3 -> step 6
  });

  test('a pad plays its sound here, unless hearing is off', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { getByLabelText, getByRole } = mount();
    await fireEvent.pointerDown(getByLabelText('Play sd'));
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0][0]).toContain('s("');
    await fireEvent.click(getByRole('button', { name: /^Take settings/ }));
    await fireEvent.click(getByRole('button', { name: /Hear notes as you play/ }));
    await fireEvent.pointerDown(getByLabelText('Play sd'));
    expect(play).toHaveBeenCalledTimes(1);
  });

  test('never mutates the instrument itself', async () => {
    const { instrumentData, getByLabelText, recordFrom } = mount();
    const before = JSON.stringify(instrumentData);
    await recordFrom(1.5);
    await fireEvent.pointerDown(getByLabelText('Play bd'));
    expect(JSON.stringify(instrumentData)).toBe(before);
  });
});
