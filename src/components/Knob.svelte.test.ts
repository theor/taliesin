import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Knob from './Knob.svelte';
import { KNOB_DRAG_RANGE_PX, KNOB_HOLD_MS } from '$lib/knob';

// jsdom has no PointerEvent, so testing-library would drop `pointerId` / `pointerType`: provide one
beforeAll(() => {
  if ('PointerEvent' in window) return;
  class FakePointerEvent extends MouseEvent {
    pointerType: string;
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? '';
      this.pointerId = init.pointerId ?? 1;
    }
  }
  (window as unknown as { PointerEvent: unknown }).PointerEvent = FakePointerEvent;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount() {
  const onchange = vi.fn<(v: number) => void>();
  render(Knob, { props: { label: 'Reverb', value: 0.5, min: 0, max: 1, step: 0.01, onchange } });
  return { knob: screen.getByRole('slider', { name: 'Reverb' }), onchange };
}
const at = (pointerType: string, x: number, y: number) => ({
  pointerType,
  pointerId: 7,
  button: 0,
  clientX: x,
  clientY: y
});

describe('Knob on a touch screen', () => {
  test('a finger held still for a moment turns it', async () => {
    vi.useFakeTimers();
    const { knob, onchange } = mount();
    await fireEvent.pointerDown(knob, at('touch', 100, 100));
    vi.advanceTimersByTime(KNOB_HOLD_MS + 10);
    await fireEvent.pointerMove(knob, at('touch', 100, 100 - KNOB_DRAG_RANGE_PX / 10));
    expect(onchange).toHaveBeenLastCalledWith(0.6);
    await fireEvent.pointerUp(knob, at('touch', 100, 82));
  });

  test('a finger that moves before the hold is scrolling, and the knob stays put', async () => {
    vi.useFakeTimers();
    const { knob, onchange } = mount();
    await fireEvent.pointerDown(knob, at('touch', 100, 100));
    await fireEvent.pointerMove(knob, at('touch', 60, 100)); // a sideways swipe along the strip
    vi.advanceTimersByTime(KNOB_HOLD_MS + 10);
    await fireEvent.pointerMove(knob, at('touch', 20, 60));
    expect(onchange).not.toHaveBeenCalled();
  });

  test('a quick tap does nothing', async () => {
    vi.useFakeTimers();
    const { knob, onchange } = mount();
    await fireEvent.pointerDown(knob, at('touch', 100, 100));
    await fireEvent.pointerUp(knob, at('touch', 100, 100));
    vi.advanceTimersByTime(KNOB_HOLD_MS + 10);
    await fireEvent.pointerMove(knob, at('touch', 100, 50));
    expect(onchange).not.toHaveBeenCalled();
  });
});

describe('Knob with a mouse', () => {
  test('grabs at once', async () => {
    const { knob, onchange } = mount();
    await fireEvent.pointerDown(knob, at('mouse', 100, 100));
    await fireEvent.pointerMove(knob, at('mouse', 100, 100 - KNOB_DRAG_RANGE_PX / 5));
    expect(onchange).toHaveBeenLastCalledWith(0.7);
  });
});
