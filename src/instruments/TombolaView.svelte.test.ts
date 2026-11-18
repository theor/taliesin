import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import InputViewSwitcher from './InputViewSwitcher.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';
import { makePartData, MonoSequence } from '$lib/parts.svelte';
import type { Command } from '$lib/commands';
import { strudel } from '$lib/strudel';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const synth = () =>
  createInstrument(PianoScale, [makePartData(MonoSequence, { notes: [0, 2, 4, 2] })]);
async function open(instrumentData: ReturnType<typeof createInstrument>) {
  const dispatch = vi.fn<(cmd: Command) => void>();
  const view = render(InputViewSwitcher, { props: { index: 0, instrumentData, dispatch } });
  await fireEvent.click(view.getByLabelText('Tombola view'));
  return { dispatch, ...view };
}
const onCells = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.flatMap(([cmd]) =>
    cmd.type === 'setCells'
      ? cmd.cells.filter((c: { on: boolean }) => c.on).map(() => cmd.track)
      : []
  );

describe('tombola input view', () => {
  test('every instrument with a grid offers it', async () => {
    for (const data of [synth(), createInstrument(Drum)]) {
      const { getByTestId } = await open(data);
      expect(getByTestId('tombola')).toBeInTheDocument();
      cleanup();
    }
  });

  test('the balls start as the rows the pattern uses, named for people', async () => {
    const { getByLabelText } = await open(synth());
    expect(getByLabelText('Ball A')).toHaveAttribute('aria-pressed', 'true'); // degree 0 in A minor
    expect(getByLabelText('Ball C')).toHaveAttribute('aria-pressed', 'true');
    expect(getByLabelText('Ball B')).toHaveAttribute('aria-pressed', 'false');
  });

  test('a shake draws only the balls into the pattern', async () => {
    const { dispatch, getByLabelText } = await open(synth());
    await fireEvent.click(getByLabelText('Ball C')); // out: A and E stay
    await fireEvent.input(getByLabelText('Spin'), { target: { value: '1' } });
    await fireEvent.click(getByLabelText('Shake'));
    const tracks = onCells(dispatch);
    expect(tracks.length).toBeGreaterThan(0);
    expect(new Set(tracks).size).toBeLessThanOrEqual(2);
    for (const t of tracks) expect([0, 4]).toContain(t);
  });

  test('on drums it draws the chosen sounds only', async () => {
    const data = createInstrument(Drum);
    const { dispatch, getByLabelText } = await open(data);
    // the kit starts with its used rows (kick, snare, hats): take the kick out
    await fireEvent.click(getByLabelText('Ball bd'));
    await fireEvent.input(getByLabelText('Spin'), { target: { value: '1' } });
    await fireEvent.click(getByLabelText('Shake'));
    const cmds = dispatch.mock.calls.map(([c]) => c);
    expect(cmds.length).toBeGreaterThan(0);
    expect(cmds.every((c) => c.type === 'setCells' && c.track !== 0)).toBe(true);
  });

  describe('physics: the drum played on this device', () => {
    /**
     * The view with physics on, at full spin: animation frames, the audio clock and the song are the
     * test's. The song (when playing) has cycle 0 at audio time 0, at 0.5 cycles a second; the synth
     * has 8 steps a measure, so step n sounds at n / 4 seconds.
     */
    async function physics(playing: boolean, instrumentData = synth()) {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
      vi.stubGlobal('cancelAnimationFrame', () => {});
      vi.spyOn(Math, 'random').mockReturnValue(0.25); // the seed
      let audio = 0;
      vi.spyOn(strudel, 'audioNow').mockImplementation(() => audio);
      vi.spyOn(strudel, 'songClock').mockImplementation(() =>
        playing ? { cycle: 0, seconds: 0, cps: 0.5 } : undefined
      );
      const playOnce = vi.spyOn(strudel, 'playOnce');
      const dispatch = vi.fn<(cmd: Command) => void>();
      const view = render(InputViewSwitcher, {
        props: { index: 0, instrumentData, dispatch, playing, now: () => audio * 0.5 }
      });
      await fireEvent.click(view.getByLabelText('Tombola view'));
      await fireEvent.input(view.getByLabelText('Spin'), { target: { value: '1' } });
      await fireEvent.click(view.getByLabelText('Physics'));
      /** Run frames, 60 a second, until `to` seconds; each note played, and when it was asked for. */
      const run = async (to: number) => {
        const played: { at: number; asked: number; code: string }[] = [];
        for (; audio < to; audio += 1 / 60) {
          const before = playOnce.mock.calls.length;
          frames.splice(0).forEach((f) => f(0));
          await tick();
          for (const [code, , at] of playOnce.mock.calls.slice(before))
            played.push({ at: at!, asked: audio, code });
        }
        return played;
      };
      return { run, dispatch, ...view };
    }
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    test('with the song stopped it plays on its own, here only', async () => {
      const { run, dispatch, getByLabelText, queryByText } = await physics(false);
      expect(queryByText('Keep spinning')).toBeNull();
      expect(getByLabelText('Shake')).toBeEnabled();
      const played = await run(6);
      expect(played.length).toBeGreaterThan(0);
      for (const p of played) expect(p.at).toBeGreaterThan(p.asked); // scheduled, never late
      expect(dispatch).not.toHaveBeenCalled();
    });

    test('with the song playing, each note sounds on one of its steps', async () => {
      const { run, dispatch } = await physics(true);
      const played = await run(6);
      expect(played.length).toBeGreaterThan(0);
      for (const p of played) {
        expect(p.at * 4).toBeCloseTo(Math.round(p.at * 4), 9);
        expect(p.at - p.asked).toBeGreaterThan(0);
        expect(p.at - p.asked).toBeLessThan(0.2);
      }
      expect(dispatch).not.toHaveBeenCalled(); // nothing is sent until a take records it
    });

    test('a take records what it played, on the steps it played them', async () => {
      const { run, dispatch, getByLabelText } = await physics(true);
      await run(1); // half a measure in
      await fireEvent.click(getByLabelText('Record a take')); // from the next measure: 2 s to 6 s
      const played = await run(7);
      const inTake = new Set(
        played
          .map((p) => Math.round(p.at * 4))
          .filter((step) => step >= 8 && step < 24)
          .map((step) => step % 16)
      );
      expect(inTake.size).toBeGreaterThan(0);
      const recorded = new Set(
        dispatch.mock.calls.flatMap(([cmd]) =>
          cmd.type === 'setCells' ? cmd.cells.filter((c) => c.on).map((c) => c.step) : []
        )
      );
      expect(recorded).toEqual(inTake);
    });
  });

  test('its settings are this device’s, per instrument', async () => {
    const data = synth();
    const first = await open(data);
    await fireEvent.click(first.getByLabelText('Ball G'));
    first.unmount();
    const again = await open(data);
    expect(again.getByLabelText('Ball G')).toHaveAttribute('aria-pressed', 'true');
    expect(again.dispatch).not.toHaveBeenCalled(); // choosing balls is not an edit
  });
});
