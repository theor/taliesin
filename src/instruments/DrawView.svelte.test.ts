import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import DrawView from './DrawView.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { PianoScale } from '$lib/instruments/MonoSynth';
import type { Command } from '$lib/commands';
import { strudel } from '$lib/strudel';
import { tick } from 'svelte';

// The surface is 100 x 80 px: 8 lanes of 10 px, the top one the highest (track 7).
const RECT = { left: 0, top: 0, width: 100, height: 80, right: 100, bottom: 80, x: 0, y: 0 };
/** The y in the middle of a track's lane. */
const laneY = (track: number) => (7 - track) * 10 + 5;

// jsdom has no PointerEvent: without one, fireEvent drops clientX/clientY and pointerId
class FakePointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  localStorage.clear(); // hearing notes is a saved per-device choice
  if (typeof PointerEvent === 'undefined') vi.stubGlobal('PointerEvent', FakePointerEvent);
  // jsdom has no 2D canvas (it logs an error and returns null): the ink is not tested here
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
/** Runs the frames queued so far (as the browser would on its next frame). */
function nextFrame() {
  const run = frames;
  frames = [];
  run.forEach((cb) => cb(performance.now()));
}

// PianoScale: 8 steps per cycle, 2 cycles (16 steps).
function mount(opts: { playing?: boolean } = {}) {
  const instrumentData = createInstrument(PianoScale);
  const dispatch = vi.fn<(cmd: Command) => void>();
  const clock = { t: 0.1 };
  const view = render(DrawView, {
    props: {
      index: 0,
      instrumentData,
      dispatch,
      playing: opts.playing ?? true,
      position: 0,
      now: () => clock.t
    }
  });
  const surface = view.getByTestId('draw-surface');
  surface.getBoundingClientRect = () => ({ ...RECT, toJSON: () => RECT }) as DOMRect;
  /** The notes recorded, as [track, step] (the take's clearing commands turn cells off: left out). */
  const recorded = () =>
    dispatch.mock.calls
      .map(([c]) => c as Extract<Command, { type: 'setCells' }>)
      .filter((c) => c.cells[0].on)
      .map((c) => [c.track, c.cells[0].step]);
  /** Arm a take now (in measure 0): it runs from cycle 1 to cycle 3. Then move the clock into it. */
  const recordFrom = async (cycle: number) => {
    await fireEvent.click(view.getByLabelText('Record a take'));
    clock.t = cycle;
  };
  return { instrumentData, dispatch, surface, recorded, clock, recordFrom, ...view };
}
const press = (surface: HTMLElement, track: number, clientX = 50) =>
  fireEvent.pointerDown(surface, { pointerId: 1, clientX, clientY: laneY(track) });
const moveTo = (surface: HTMLElement, track: number, clientX = 50) =>
  fireEvent.pointerMove(surface, { pointerId: 1, clientX, clientY: laneY(track) });

describe('DrawView', () => {
  test('outside a take, drawing plays but records nothing', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { surface, dispatch } = mount();
    await press(surface, 5);
    expect(dispatch).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledTimes(1);
  });

  test('during a take, pressing records the lane under the finger at the current step', async () => {
    const { surface, dispatch, instrumentData, recordFrom } = mount();
    await recordFrom(1.3); // 10.4 steps -> 10
    await press(surface, 5);
    expect(dispatch).toHaveBeenCalledWith({
      type: 'setCells',
      instrumentId: instrumentData.id,
      track: 5,
      cells: [{ step: 10, on: true }]
    });
  });

  test('the top of the surface is the highest note, the bottom the lowest', async () => {
    const { surface, recorded, recordFrom } = mount();
    await recordFrom(1.3);
    await fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 0 });
    await fireEvent.pointerUp(surface, { pointerId: 1 });
    await fireEvent.pointerDown(surface, { pointerId: 1, clientX: 50, clientY: 80 });
    expect(recorded()).toEqual([
      [7, 10],
      [0, 10]
    ]);
  });

  test('moving inside one lane and step sends nothing more; a new lane re-records the step', async () => {
    const { surface, recorded, recordFrom } = mount();
    await recordFrom(1.3);
    await press(surface, 3, 10);
    await fireEvent.pointerMove(surface, { pointerId: 1, clientX: 90, clientY: laneY(3) + 2 });
    expect(recorded()).toEqual([[3, 10]]);
    await moveTo(surface, 4, 90);
    expect(recorded()).toEqual([
      [3, 10],
      [4, 10]
    ]);
  });

  test('a finger held still keeps recording as the song moves on', async () => {
    const { surface, recorded, recordFrom, clock } = mount();
    await recordFrom(1.3);
    await press(surface, 6);
    clock.t = 1.32; // still step 10
    nextFrame();
    clock.t = 1.4; // step 11.2
    nextFrame();
    clock.t = 1.5; // step 12
    nextFrame();
    expect(recorded()).toEqual([
      [6, 10],
      [6, 11],
      [6, 12]
    ]);
    await fireEvent.pointerUp(surface, { pointerId: 1 });
    clock.t = 1.7;
    nextFrame();
    expect(recorded()).toHaveLength(3);
  });

  test('a stroke started before the take records once the take starts', async () => {
    const { surface, recorded, recordFrom, clock } = mount();
    await recordFrom(0.9); // still armed
    await press(surface, 2);
    expect(recorded()).toEqual([]);
    clock.t = 1;
    nextFrame();
    expect(recorded()).toEqual([[2, 8]]);
  });

  test('the take clears the old melody ahead of the playhead', async () => {
    const { surface, dispatch, recordFrom, clock } = mount();
    // the default melody fills steps 0-7: arm in measure 1, so the take wraps round onto them
    clock.t = 1.1;
    await recordFrom(2);
    await press(surface, 2);
    clock.t = 2.2; // song step 17.6: loop step 1
    nextFrame();
    const cleared = dispatch.mock.calls
      .map(([c]) => c as Extract<Command, { type: 'setCells' }>)
      .flatMap((c) => c.cells.filter((x) => !x.on).map((x) => x.step));
    expect(cleared).toEqual([0, 1, 2]); // the playhead's step and the next one, not the whole loop
  });

  test('the surface shows a running take: border and REC badge', async () => {
    const { surface, recordFrom, queryByTestId, clock } = mount();
    expect(queryByTestId('rec-badge')).toBeNull();
    clock.t = 0.1;
    await recordFrom(0.9);
    nextFrame();
    expect(surface).toHaveAttribute('data-phase', 'armed');
    clock.t = 1.1;
    nextFrame();
    await tick(); // the frame changed state outside an event: let the view redraw
    expect(surface).toHaveAttribute('data-phase', 'recording');
    expect(queryByTestId('rec-badge')).toBeInTheDocument();
  });

  test('the horizontal axis is velocity: shown, not recorded', async () => {
    const { surface, dispatch, getByTestId, recordFrom } = mount();
    await recordFrom(1.3);
    await press(surface, 2, 75);
    expect(getByTestId('draw-readout')).toHaveTextContent('velocity 75%');
    expect(JSON.stringify(dispatch.mock.calls)).not.toContain('velocity');
  });

  test('nothing plays or records while the song is stopped', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { surface, dispatch, getByTestId } = mount({ playing: false });
    expect(getByTestId('draw-hint')).toBeInTheDocument();
    await press(surface, 2);
    nextFrame();
    expect(dispatch).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  test('each note is played here once per step, not every pointer move', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { surface, recordFrom } = mount();
    await recordFrom(1.3);
    await press(surface, 5);
    await moveTo(surface, 5, 60);
    await moveTo(surface, 2, 60);
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.calls[0][0]).toContain('n("<5 ');
    expect(play.mock.calls[1][0]).toContain('n("<2 ');
  });

  test('hearing the notes can be turned off', async () => {
    const play = vi.spyOn(strudel, 'playOnce');
    const { surface, recorded, getByRole, recordFrom } = mount();
    await fireEvent.click(getByRole('button', { name: /^Take settings/ }));
    await fireEvent.click(getByRole('button', { name: /Hear notes as you play/ }));
    await fireEvent.click(getByRole('button', { name: 'Done' }));
    await recordFrom(1.3);
    await press(surface, 5);
    expect(recorded()).toHaveLength(1);
    expect(play).not.toHaveBeenCalled();
  });

  test('never mutates the instrument itself', async () => {
    const { surface, instrumentData, recordFrom } = mount();
    const before = JSON.stringify(instrumentData);
    await recordFrom(1.3);
    await press(surface, 2);
    await moveTo(surface, 5);
    expect(JSON.stringify(instrumentData)).toBe(before);
  });
});
