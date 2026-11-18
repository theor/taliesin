import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import TempoControl from './TempoControl.svelte';
import Transport from './Transport.svelte';

afterEach(cleanup);

function mount(bpm = 120) {
  const dispatch = vi.fn();
  const clock = { t: 0 };
  render(TempoControl, { props: { bpm, dispatch, now: () => clock.t } });
  return {
    dispatch,
    clock,
    open: () => fireEvent.click(screen.getByLabelText(`Tempo ${bpm} BPM`))
  };
}

describe('TempoControl', () => {
  test('shows the BPM; nudging dispatches the absolute tempo', async () => {
    const { dispatch, open } = mount(120);
    expect(screen.getByTestId('tempo')).toHaveTextContent('120');
    await open();
    await fireEvent.click(screen.getByLabelText('Faster'));
    await fireEvent.click(screen.getByLabelText('Slower'));
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'setTempo', bpm: 121 }],
      [{ type: 'setTempo', bpm: 119 }]
    ]);
  });

  test('never asks for a tempo out of range', async () => {
    const { dispatch, open } = mount(240);
    await open();
    await fireEvent.click(screen.getByLabelText('Faster'));
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('the slider sets the tempo', async () => {
    const { dispatch, open } = mount();
    await open();
    await fireEvent.input(screen.getByLabelText('Tempo slider'), { target: { value: '87' } });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTempo', bpm: 87 });
  });

  test('tapping along sets the tempo from the second tap', async () => {
    const { dispatch, clock, open } = mount();
    await open();
    const tap = screen.getByRole('button', { name: 'Tap along' });
    await fireEvent.pointerDown(tap);
    expect(dispatch).not.toHaveBeenCalled();
    clock.t = 600;
    await fireEvent.pointerDown(tap);
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTempo', bpm: 100 });
  });

  test('the transport shows it when given a tempo, in both sizes', () => {
    for (const size of ['lg', 'md'] as const) {
      render(Transport, {
        props: { playing: false, position: 0, dispatch: vi.fn(), tempo: 95, size }
      });
      expect(screen.getByTestId('tempo')).toHaveTextContent('95');
      cleanup();
    }
  });
});
