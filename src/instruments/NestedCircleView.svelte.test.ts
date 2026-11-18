import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import NestedCircleView from './NestedCircleView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import type { Command } from '$lib/commands';
import { euclid } from '$lib/euclid';

// Drum: 8 steps. bd (track 0) "x...x...", sd (1) "..x...x.", hh (2) all on; the rest are empty.
function mount() {
  const instrumentData = createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const view = render(NestedCircleView, { props: { index: 0, instrumentData, dispatch } });
  const ringTracks = () =>
    new Set([...view.container.querySelectorAll('[data-y]')].map((e) => e.getAttribute('data-y')));
  return { instrumentData, dispatch, ringTracks, ...view };
}
afterEach(cleanup);

describe('NestedCircleView', () => {
  test('draws a ring for each track that has hits', () => {
    const { ringTracks } = mount();
    expect([...ringTracks()].sort()).toEqual(['0', '1', '2']);
  });

  test('picking an empty track adds its ring', async () => {
    const { ringTracks, getByLabelText } = mount();
    await fireEvent.click(getByLabelText('Select cp'));
    expect(ringTracks().size).toBe(4);
  });

  test('the steppers act on the selected ring', async () => {
    const { dispatch, instrumentData, getByLabelText } = mount();
    await fireEvent.click(getByLabelText('Select sd'));
    await fireEvent.click(getByLabelText('Pulses up')); // sd is 2 pulses rotated by 2 -> 3 pulses, still rotated by 2
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 1,
      cells: euclid(3, 8, 2).map((on, step) => ({ step, on }))
    });
  });

  test('tapping a dot toggles that step and selects its ring', async () => {
    const { dispatch, instrumentData, container, getByLabelText } = mount();
    await fireEvent.click(container.querySelector('[aria-label="ring-2-3"]')!); // hh step 3: on -> off
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 2,
      cells: [{ step: 3, on: false }]
    });
    expect(getByLabelText('Select hh')).toHaveAttribute('aria-pressed', 'true');
  });

  test('never mutates the instrument itself', async () => {
    const { instrumentData, getByLabelText } = mount();
    const before = JSON.stringify(instrumentData);
    await fireEvent.click(getByLabelText('Pulses up'));
    expect(JSON.stringify(instrumentData)).toBe(before);
  });
});
