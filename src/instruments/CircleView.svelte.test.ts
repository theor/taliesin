import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import CircleView from './CircleView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import type { Command } from '$lib/commands';

// Drum starts with 8 steps: bd (track 0) "x...x...", sd "..x...x.", hh all on; the other tracks are empty.
function mount() {
  const instrumentData = createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const view = render(CircleView, { props: { index: 0, instrumentData, dispatch } });
  return { instrumentData, dispatch, ...view };
}
afterEach(cleanup);

describe('CircleView', () => {
  test('shows a ring per track with the pulses it finds in the cells', () => {
    const { getAllByLabelText } = mount();
    const pulses = getAllByLabelText('Pulses');
    expect(pulses.slice(0, 3).map((e) => e.textContent)).toEqual(['2', '2', '8']);
  });

  test('more pulses dispatches the whole Euclidean pattern for that track', async () => {
    const { dispatch, instrumentData, getAllByLabelText } = mount();
    await fireEvent.click(getAllByLabelText('Pulses up')[0]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 0,
      cells: [true, false, false, true, false, false, true, false].map((on, step) => ({ step, on }))
    });
  });

  test('rotating shifts the pattern', async () => {
    const { dispatch, getAllByLabelText } = mount();
    await fireEvent.click(getAllByLabelText('Rotate up')[0]); // kick x...x... -> .x...x..
    const cmd = dispatch.mock.calls[0][0] as Extract<Command, { type: 'setCells' }>;
    expect(cmd.cells.map((c) => (c.on ? 1 : 0)).join('')).toBe('01000100');
  });

  test('tapping a dot toggles just that step', async () => {
    const { dispatch, instrumentData, container } = mount();
    await fireEvent.click(container.querySelector('[aria-label="circle-0-1"]')!);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 0,
      cells: [{ step: 1, on: true }]
    });
  });

  test('never mutates the instrument itself', async () => {
    const { instrumentData, getAllByLabelText } = mount();
    const before = JSON.stringify(instrumentData);
    await fireEvent.click(getAllByLabelText('Pulses up')[1]);
    expect(JSON.stringify(instrumentData)).toBe(before);
  });
});
