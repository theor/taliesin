import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import InputViewSwitcher from './InputViewSwitcher.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const mount = (instrumentData: ReturnType<typeof createInstrument>) =>
  render(InputViewSwitcher, { props: { index: 0, instrumentData, dispatch: vi.fn() } });

describe('instrument input view switch', () => {
  test('drums offer grid and circle, starting on the grid', () => {
    const { getByLabelText, getByTestId } = mount(createInstrument(Drum));
    expect(getByLabelText('Circle view')).toBeInTheDocument();
    expect(getByTestId('sequencer-grid')).toBeInTheDocument();
  });

  test('choosing the circle shows it and is remembered for that instrument', async () => {
    const data = createInstrument(Drum);
    const first = mount(data);
    await fireEvent.click(first.getByLabelText('Circle view'));
    expect(first.getByTestId('circle-view')).toBeInTheDocument();
    first.unmount();
    expect(mount(data).getByTestId('circle-view')).toBeInTheDocument();
  });

  test('drums can switch to the nested rings too', async () => {
    const { getByLabelText, getByTestId } = mount(createInstrument(Drum));
    await fireEvent.click(getByLabelText('Nested rings view'));
    expect(getByTestId('nested-view')).toBeInTheDocument();
  });

  test('instruments with only a grid show no switch', () => {
    const { queryByLabelText } = mount(createInstrument(PianoScale));
    expect(queryByLabelText('Circle view')).toBeNull();
  });

  test('switching to a drum from another instrument in the same view shows the switch', async () => {
    const { queryByLabelText, rerender } = mount(createInstrument(PianoScale));
    expect(queryByLabelText('Circle view')).toBeNull();
    await rerender({ index: 1, instrumentData: createInstrument(Drum), dispatch: vi.fn() });
    expect(queryByLabelText('Circle view')).toBeInTheDocument();
  });
});
