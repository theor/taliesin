import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import RecordView from './RecordView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';
import type { Command } from '$lib/commands';

afterEach(cleanup);

// Drum: 4 steps per cycle, 2 cycles = 8 steps.
function mount(opts: { playing?: boolean; now?: () => number; piano?: boolean } = {}) {
  const instrumentData = opts.piano ? createInstrument(PianoScale) : createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const view = render(RecordView, {
    props: {
      index: 0,
      instrumentData,
      dispatch,
      playing: opts.playing ?? true,
      position: 0,
      now: opts.now ?? (() => 0.5)
    }
  });
  return { instrumentData, dispatch, ...view };
}

describe('RecordView', () => {
  test('pads are disabled, with a hint, while the song is stopped', async () => {
    const { dispatch, getByLabelText, getByTestId } = mount({ playing: false });
    expect(getByLabelText('Record bd')).toBeDisabled();
    expect(getByTestId('record-hint')).toBeInTheDocument();
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('pressing a drum pad records that track at the current quantized step', async () => {
    const { dispatch, instrumentData, getByLabelText } = mount();
    await fireEvent.pointerDown(getByLabelText('Record sd'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 1, // bd, sd, hh ...
      cells: [{ step: 2, on: true }] // 0.5 cycles * 4 steps
    });
  });

  test('every press reads the clock again', async () => {
    let t = 0;
    const { dispatch, getByLabelText } = mount({ now: () => t });
    t = 0.25;
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    t = 0.75;
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect(dispatch.mock.calls.map(([c]) => (c as any).cells[0].step)).toEqual([1, 3]);
  });

  test('pads show where they last recorded', async () => {
    const { getByLabelText } = mount();
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect(getByLabelText('Record bd')).toHaveTextContent('step 3');
  });

  test('a melodic instrument gets a pad per scale degree', async () => {
    const { dispatch, instrumentData } = mount({ piano: true });
    // the label is the note name; the pad's track is its scale degree
    const pads = document.querySelectorAll('[aria-label^="Record "]');
    expect(pads.length).toBe(8);
    await fireEvent.pointerDown(pads[3]);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'setCells', instrumentId: instrumentData.id, track: 3 })
    );
  });

  test('a coarser quantize snaps to every 2nd step', async () => {
    const { dispatch, getByLabelText, container } = mount({ now: () => 0.3 }); // 1.2 steps
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect((dispatch.mock.calls[0][0] as any).cells[0].step).toBe(1);
    const select = container.querySelector('select')!;
    await fireEvent.change(select, { target: { value: 'Every 2 steps' } });
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect((dispatch.mock.calls[1][0] as any).cells[0].step).toBe(2); // 0.6 -> 1 -> 2
  });

  test('never mutates the instrument itself', async () => {
    const { instrumentData, getByLabelText } = mount();
    const before = JSON.stringify(instrumentData);
    await fireEvent.pointerDown(getByLabelText('Record bd'));
    expect(JSON.stringify(instrumentData)).toBe(before);
  });
});
