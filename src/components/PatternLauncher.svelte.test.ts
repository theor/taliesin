import { afterEach, describe, expect, test } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import PatternLauncher from './PatternLauncher.svelte';
import { AppStore } from '$lib/Store.svelte';
import { createFakeNetwork } from '$lib/testing/fakeRoom';
import { fakePlayer } from '$lib/testing/fakePlayer';
import { liveSlot } from '$lib/patterns';
import type { Command } from '$lib/commands';

afterEach(cleanup);

// Presets: Piano (0), Bass (1), Drum (2)
const BASS = 1;
function setup(onEdit?: (i: number) => void) {
  const net = createFakeNetwork();
  const store = new AppStore(true, 'r', net.join('host'), fakePlayer());
  const guest = new AppStore(false, 'r', net.join('guest'), fakePlayer());
  net.settle();
  const tracks = () => store.instrumentsData.instrumentsData;
  const writeB = () =>
    store.dispatch({
      type: 'setCells',
      instrumentId: tracks()[BASS].id,
      track: 4,
      cells: [{ step: 0, on: true }],
      pattern: 1
    } satisfies Command);
  render(PatternLauncher, {
    props: {
      song: store.instrumentsData,
      cues: store.cues,
      dispatch: (c: Command) => store.dispatch(c),
      onEdit
    }
  });
  return { store, guest, tracks, writeB };
}
const column = (label: string) => screen.getByRole('columnheader', { name: `Column ${label}` });
const clipStates = (track: string) =>
  within(screen.getByRole('row', { name: track }))
    .getAllByTestId('clip')
    .map((c) => c.getAttribute('data-state'));

describe('PatternLauncher', () => {
  test('a row per track, a column per slot in use and one more', () => {
    const { writeB } = setup();
    expect(clipStates('Bass')).toEqual(['live', 'empty']);
    writeB();
    flushSync();
    expect(clipStates('Bass')).toEqual(['live', 'stopped', 'empty']);
    expect(clipStates('Piano')).toEqual(['live', 'empty', 'empty']);
    expect(column('A')).toHaveAttribute('data-state', 'live');
    expect(column('B')).toHaveAttribute('data-state', 'stopped');
    expect(column('C')).toHaveAttribute('data-state', 'empty');
  });

  test('launching a column (stopped: at once) makes its clips live for everyone', async () => {
    const { store, guest, tracks, writeB } = setup();
    writeB();
    flushSync();
    await fireEvent.click(within(column('B')).getByRole('button', { name: 'Launch column B' }));
    expect(liveSlot(tracks()[BASS])).toBe(1);
    expect(liveSlot(guest.instrumentsData.instrumentsData[BASS])).toBe(1);
    expect(liveSlot(tracks()[0])).toBe(0); // the piano has nothing in B
    void store;
  });

  test('cueing a column plays it on this device only', async () => {
    const { store, tracks, writeB } = setup();
    writeB();
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: 'Cue column B' }));
    expect(store.cues.heard(tracks()[BASS])).toBe(1);
    expect(liveSlot(tracks()[BASS])).toBe(0);
    expect(clipStates('Bass')[1]).toBe('cue');
    expect(screen.getByRole('button', { name: 'Cue column B' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await fireEvent.click(screen.getByRole('button', { name: 'Back to live' }));
    expect(store.cues.isCue(tracks()[BASS])).toBe(false);
  });

  test('copy a column onto another; replacing notes asks a second tap', async () => {
    const { tracks, writeB } = setup();
    writeB();
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: 'Copy column A' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Paste onto column C' }));
    expect(clipStates('Piano')).toEqual(['live', 'empty', 'stopped', 'empty']);
    expect(clipStates('Drum')[2]).toBe('stopped');

    // B holds the bass's notes: the first tap only asks
    await fireEvent.click(screen.getByRole('button', { name: 'Copy column A' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Paste onto column B' }));
    expect(clipStates('Piano')[1]).toBe('empty');
    await fireEvent.click(screen.getByRole('button', { name: 'Replace column B' }));
    expect(clipStates('Piano')[1]).toBe('stopped');
    expect(screen.queryByRole('button', { name: /Paste onto/ })).toBeNull();
    void tracks;
  });

  test('a clip launches on its own; an empty one opens the editor', async () => {
    const edited: number[] = [];
    const { tracks, writeB } = setup((i) => edited.push(i));
    writeB();
    flushSync();
    await fireEvent.click(screen.getByRole('button', { name: 'Launch Bass B' }));
    expect(liveSlot(tracks()[BASS])).toBe(1);
    await fireEvent.click(screen.getByRole('button', { name: /^Piano C, empty/ }));
    expect(edited).toEqual([0]);
  });
});
