import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import SequencerView from './SequencerView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import type { Command } from '$lib/commands';


// The view in isolation: no store, no network, no audio. It is handed state and a spy `dispatch`, and
// the tests check which commands a gesture produces. Drum starts as
//   bd (track 0): X . . . X . . .     sd (track 1): . . X . . . X .     hh (track 2): all on
// jsdom has no PointerEvent, so testing-library would drop `pointerType`: provide a minimal one
if (!('PointerEvent' in window)) {
  class FakePointerEvent extends MouseEvent {
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
    }
  }
  (window as any).PointerEvent = FakePointerEvent;
}

let over: Element | null = null;
let surface: HTMLElement;
const mountSurface = () => mount();
function mount() {
  const instrumentData = createInstrument(Drum);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const { container } = render(SequencerView, { props: { index: 0, instrumentData, dispatch } });
  surface = container.querySelector('[data-testid="sequencer-grid"]') as HTMLElement;
  const cell = (step: number, track: number) =>
    container.querySelector(`[data-x="${step}"][data-y="${track}"]`) as HTMLElement;

  // jsdom has no hit testing: point the "pointer" at whichever cell the test says it is over
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
    await gesture([[1, 0], [3, 0], [5, 1]]); // starts on an empty cell, so it paints
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      track: 0,
      cells: [1, 3, 5].map((step) => ({ step, on: true }))
    });
  });

  test('a drag that starts on a lit cell erases everything it covers', async () => {
    const { dispatch, cell, gesture } = mount();
    await gesture([[4, 0], [5, 0], [6, 0]], false); // the kick is on at step 4
    expect(cell(5, 0).firstElementChild).toHaveClass('cell-erasing'); // erase preview
    await gesture([], true);
    expect(dispatch.mock.calls[0][0]).toMatchObject({
      track: 0,
      cells: [4, 5, 6].map((step) => ({ step, on: false }))
    });
  });

  test('every step of the loop is shown, without paging', () => {
    const { container } = mount();
    expect(container.querySelectorAll('[data-y="0"]')).toHaveLength(8);
    expect(container.querySelector('nav[aria-label="pagination"], [data-part="root"]')).toBeNull();
  });

  test('nothing is dispatched until the pointer is released, but the stroke is previewed', async () => {
    const { dispatch, cell, gesture } = mount();
    await gesture([[1, 1], [2, 1], [3, 1]], false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(cell(2, 1).firstElementChild).toHaveClass('cell-preview'); // preview colour
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
    expect(cell(0, 0).firstElementChild).toHaveClass('cell-on'); // kick on step 0
    expect(cell(1, 0).firstElementChild).toHaveClass('cell-off'); // off
  });

  describe('with a finger (hold to paint, otherwise the page scrolls)', () => {
    const touch = (x = 0, y = 0) => ({ pointerType: 'touch', clientX: x, clientY: y });
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test('a quick tap still toggles the cell', async () => {
      const { dispatch, instrumentData, cell } = mountSurface();
      over = cell(1, 0);
      await fireEvent.pointerDown(surface, touch());
      await fireEvent.pointerUp(surface, touch());
      expect(dispatch).toHaveBeenCalledWith({
        type: 'setCells',
        instrumentId: instrumentData.id,
        track: 0,
        cells: [{ step: 1, on: true }]
      });
    });

    test('moving before the hold elapses is a scroll: nothing is painted', async () => {
      const { dispatch, cell } = mountSurface();
      over = cell(1, 0);
      await fireEvent.pointerDown(surface, touch());
      over = cell(2, 0);
      await fireEvent.pointerMove(surface, touch(0, 40));
      await vi.advanceTimersByTimeAsync(400);
      await fireEvent.pointerCancel(surface, touch());
      expect(dispatch).not.toHaveBeenCalled();
    });

    test('holding, then dragging, paints and blocks scrolling', async () => {
      const { dispatch, cell } = mountSurface();
      over = cell(1, 0);
      await fireEvent.pointerDown(surface, touch());
      await vi.advanceTimersByTimeAsync(300);
      over = cell(2, 0);
      await fireEvent.pointerMove(surface, touch(20, 0));
      over = cell(3, 0);
      await fireEvent.pointerMove(surface, touch(40, 0));
      const move = new Event('touchmove', { cancelable: true, bubbles: true });
      surface.dispatchEvent(move);
      expect(move.defaultPrevented).toBe(true);
      over = null;
      await fireEvent.pointerUp(surface, touch(40, 0));
      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch.mock.calls[0][0]).toMatchObject({ type: 'setCells', track: 0 });
    });
  });
});
