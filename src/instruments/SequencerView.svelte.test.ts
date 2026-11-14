import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import SequencerView from './SequencerView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import type { Command } from '$lib/commands';

// A cursor-following debug popover that listens to global pointer events; not part of what's under test.
vi.mock('../components/AppTooltip.svelte', () => ({ default: () => {} }));

// The view in isolation: no store, no network, no audio. It is handed state and a spy `dispatch`, and
// the tests check which commands a gesture produces. Drum starts as
//   bd (track 0): X . . . X . . .     sd (track 1): . . X . . . X .     hh (track 2): all on
function mount() {
  const instrumentData = createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const { container } = render(SequencerView, { props: { index: 0, instrumentData, dispatch } });
  const surface = container.querySelector('.touch-none') as HTMLElement;
  const cell = (step: number, track: number) =>
    container.querySelector(`[data-x="${step}"][data-y="${track}"]`) as HTMLElement;

  // jsdom has no hit testing: point the "pointer" at whichever cell the test says it is over
  let over: Element | null = null;
  document.elementFromPoint = () => over;

  /** Press on the first cell, move through the rest, release (or not). */
  async function gesture(path: [number, number][], release = true) {
    for (const [i, [step, track]] of path.entries()) {
      over = cell(step, track);
      if (i === 0) await fireEvent.pointerDown(surface);
      else await fireEvent.pointerMove(surface);
    }
    if (release) {
      over = null;
      await fireEvent.pointerUp(surface);
    }
  }
  return { instrumentData, dispatch, cell, gesture, container };
}

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SequencerView', () => {
  test('tapping an empty cell dispatches setCells on', async () => {
    const { dispatch, instrumentData, gesture } = mount();
    await gesture([[1, 0]]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 0,
      cells: [{ step: 1, on: true }]
    });
  });

  test('tapping a cell that is on dispatches setCells off', async () => {
    const { dispatch, gesture } = mount();
    await gesture([[0, 0]]);
    expect(dispatch.mock.calls[0][0]).toMatchObject({ track: 0, cells: [{ step: 0, on: false }] });
  });

  test('dragging along a row dispatches one command covering the whole stroke', async () => {
    const { dispatch, gesture } = mount();
    await gesture([[1, 1], [2, 1], [3, 1], [4, 1]]);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      track: 1,
      cells: [1, 2, 3, 4].map((step) => ({ step, on: true }))
    });
  });

  test('moving a row away while dragging sets a stride of 2', async () => {
    const { dispatch, gesture } = mount();
    await gesture([[0, 0], [2, 0], [4, 1]]);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      track: 0,
      cells: [0, 2, 4].map((step) => ({ step, on: true }))
    });
  });

  test('nothing is dispatched until the pointer is released, but the stroke is previewed', async () => {
    const { dispatch, cell, gesture } = mount();
    await gesture([[1, 1], [2, 1], [3, 1]], false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(cell(2, 1).firstElementChild).toHaveClass('preset-filled-secondary-500'); // preview colour
  });

  test('the view never mutates the instrument itself', async () => {
    const { instrumentData, gesture } = mount();
    const before = JSON.stringify(instrumentData);
    await gesture([[1, 1], [2, 1], [3, 1]]);
    expect(JSON.stringify(instrumentData)).toBe(before);
  });

  test('releasing the pointer without touching a cell dispatches nothing', async () => {
    const { dispatch, gesture } = mount();
    await gesture([]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  test('renders the cells that are on', () => {
    const { cell } = mount();
    expect(cell(0, 0).firstElementChild).toHaveClass('preset-filled-primary-500'); // kick on step 0
    expect(cell(1, 0).firstElementChild).toHaveClass('preset-outlined-primary-500'); // off
  });
});
