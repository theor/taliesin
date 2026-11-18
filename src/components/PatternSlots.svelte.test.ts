import { afterEach, describe, expect, test } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { flushSync } from 'svelte';
import PatternSlots from './PatternSlots.svelte';
import CueBanner from './CueBanner.svelte';
import { AppStore } from '$lib/Store.svelte';
import { createFakeNetwork } from '$lib/testing/fakeRoom';
import { fakePlayer } from '$lib/testing/fakePlayer';
import { liveSlot } from '$lib/patterns';

afterEach(cleanup);

const BASS = 1;
function setup() {
  const net = createFakeNetwork();
  const store = new AppStore(true, 'r', net.join('host'), fakePlayer());
  const guest = new AppStore(false, 'r', net.join('guest'), fakePlayer());
  net.settle();
  const data = () => store.instrumentsData.instrumentsData[BASS];
  return { store, guest, data };
}
const states = () =>
  screen.getAllByRole('button', { name: /^Pattern/ }).map((b) => b.getAttribute('data-state'));

describe('PatternSlots', () => {
  test('one live slot to start with, and a way to open a new one', async () => {
    const { store, data } = setup();
    render(PatternSlots, { props: { data: data(), cues: store.cues, color: '#2DD4BF' } });
    expect(states()).toEqual(['live']);
    await fireEvent.click(screen.getByRole('button', { name: 'New pattern' }));
    expect(states()).toEqual(['live', 'cue']);
    expect(screen.getByRole('button', { name: /Pattern B/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(store.cues.slot(data())).toBe(1);
  });

  test("a launch waiting for the bar, and someone else's cue, show as such", async () => {
    const { store, guest, data } = setup();
    store.cues.pick(data(), 2);
    guest.cues.pick(guest.instrumentsData.instrumentsData[BASS], 1);
    store.transport.playing = true;
    store.cues.launch(data(), 2);
    render(PatternSlots, { props: { data: data(), cues: store.cues, color: '#2DD4BF' } });
    expect(states()).toEqual(['live', 'other', 'queued']);
    store.cues.cancelLaunch(data());
  });

  test('tapping the live slot goes back to it', async () => {
    const { store, data } = setup();
    store.cues.pick(data(), 1);
    render(PatternSlots, { props: { data: data(), cues: store.cues, color: '#2DD4BF' } });
    await fireEvent.click(screen.getByRole('button', { name: /Pattern A/ }));
    expect(store.cues.isCue(data())).toBe(false);
  });
});

describe('CueBanner', () => {
  test('choose what this device hears, then launch the cue for everyone', async () => {
    const { store, guest, data } = setup();
    store.cues.pick(data(), 1);
    render(CueBanner, { props: { data: data(), cues: store.cues, color: '#2DD4BF' } });
    expect(screen.getByTestId('cue-title')).toHaveTextContent('Only you hear B');

    await fireEvent.click(screen.getByRole('button', { name: 'Hear A (live)' }));
    expect(store.cues.heard(data())).toBe(0);
    expect(screen.getByTestId('cue-title')).toHaveTextContent('You hear A, like everyone');
    await fireEvent.click(screen.getByRole('button', { name: 'Hear B (cue)' }));
    expect(store.cues.heard(data())).toBe(1);

    // stopped: the launch goes at once, for everyone
    await fireEvent.click(screen.getByRole('button', { name: /Launch B/ }));
    flushSync();
    expect(liveSlot(data())).toBe(1);
    expect(liveSlot(guest.instrumentsData.instrumentsData[BASS])).toBe(1);
    expect(store.cues.isCue(data())).toBe(false);
  });

  test('a jam where only the host plays has no hear switch', () => {
    const { store, data } = setup();
    store.cues.pick(data(), 1);
    render(CueBanner, { props: { data: data(), cues: store.cues, color: '#000', hostOnly: true } });
    expect(screen.queryByRole('group', { name: 'This device hears' })).toBeNull();
    expect(screen.getByRole('button', { name: /Launch B/ })).toBeInTheDocument();
  });
});
