import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  NavHistory,
  START,
  desktopIndex,
  desktopSelect,
  navIndex,
  phoneScreen,
  shouldConfirmLeave,
  type NavState
} from './nav.svelte';

const ids = ['a', 'b', 'c'];

describe('which page is shown', () => {
  test('the instrument is found by id, so removing another one does not change it', () => {
    expect(navIndex({ screen: 'edit', instrumentId: 'c' }, ids)).toBe(2);
    expect(navIndex({ screen: 'edit', instrumentId: 'c' }, ['a', 'c'])).toBe(1);
    expect(navIndex({ screen: 'edit', instrumentId: 'gone' }, ids)).toBe(0);
    expect(navIndex(START, ids)).toBe(0);
  });

  test("on the phone, a removed instrument's screens fall back to the session", () => {
    expect(phoneScreen({ screen: 'rack', instrumentId: 'b' }, ids)).toBe('rack');
    expect(phoneScreen({ screen: 'rack', instrumentId: 'gone' }, ids)).toBe('session');
    expect(phoneScreen({ screen: 'edit' }, [])).toBe('session');
    expect(phoneScreen({ screen: 'mixer', instrumentId: 'gone' }, ids)).toBe('mixer');
  });

  test('on the desktop, the mixer is index -1 and an instrument is opened by its index', () => {
    expect(desktopIndex({ screen: 'mixer', instrumentId: 'b' }, ids)).toBe(-1);
    expect(desktopIndex({ screen: 'session', instrumentId: 'b' }, ids)).toBe(1);
    expect(desktopSelect(-1, ids)).toEqual({ screen: 'mixer' });
    expect(desktopSelect(2, ids)).toEqual({ screen: 'edit', instrumentId: 'c' });
  });

  test('the pattern launcher is index -2 on the desktop, a screen of its own on the phone', () => {
    expect(desktopIndex({ screen: 'patterns', instrumentId: 'b' }, ids)).toBe(-2);
    expect(desktopSelect(-2, ids)).toEqual({ screen: 'patterns' });
    expect(phoneScreen({ screen: 'patterns', instrumentId: 'gone' }, ids)).toBe('patterns');
  });
});

describe('leaving the jam', () => {
  test('asks while the music plays or others are here, not when alone and stopped', () => {
    expect(shouldConfirmLeave({ playing: true, peers: 0 })).toBe(true);
    expect(shouldConfirmLeave({ playing: false, peers: 2 })).toBe(true);
    expect(shouldConfirmLeave({ playing: false, peers: 0 })).toBe(false);
  });
});

describe('history', () => {
  let push: ReturnType<typeof vi.fn<(s: NavState) => void>>;
  let replace: ReturnType<typeof vi.fn<(s: NavState) => void>>;
  let nav: NavHistory;
  beforeEach(() => {
    vi.useFakeTimers();
    push = vi.fn();
    replace = vi.fn();
    nav = new NavHistory(push, replace);
  });
  afterEach(() => vi.useRealTimers());

  test('each gesture pushes one entry', () => {
    nav.go({ screen: 'mixer' });
    vi.runAllTimers();
    nav.go({ screen: 'edit', instrumentId: 'b' });
    expect(push.mock.calls.map(([s]) => s)).toEqual([
      { screen: 'mixer' },
      { screen: 'edit', instrumentId: 'b' }
    ]);
  });

  test('changes in the same gesture share an entry', () => {
    nav.go({ instrumentId: 'b' });
    nav.go({ screen: 'edit' }); // opening a track sets both
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenLastCalledWith({ screen: 'edit', instrumentId: 'b' });
    expect(nav.current).toEqual({ screen: 'edit', instrumentId: 'b' });
  });

  test('going where it already is adds nothing', () => {
    nav.go({ screen: 'session' });
    expect(push).not.toHaveBeenCalled();
  });

  test('Back brings the entry back, and the first entry is the page as loaded', () => {
    nav.go({ screen: 'rack', instrumentId: 'a' });
    nav.restore(undefined);
    expect(nav.current).toEqual(START);
    nav.restore({ screen: 'rack', instrumentId: 'a' });
    expect(nav.current).toEqual({ screen: 'rack', instrumentId: 'a' });
    expect(push).toHaveBeenCalledTimes(1); // restoring never pushes
  });
});
