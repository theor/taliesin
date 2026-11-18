/**
 * Which page the app shows (screen and instrument), kept in the browser's history so Back and Forward
 * move between pages. Not song state: it is this device's, and never synced.
 */

/** The phone's screens; the desktop tells the mixer and the pattern launcher apart from an instrument. */
export type Screen = 'session' | 'edit' | 'rack' | 'mixer' | 'patterns';

export interface NavState {
  screen: Screen;
  /** The instrument shown, by id: indices shift when instruments are added or removed. */
  instrumentId?: string;
}

export const START: NavState = { screen: 'session' };
/** `selectedIndex` of the desktop's mixer (`Store.mixerIndex`) and pattern launcher (`Store.patternsIndex`). */
const MIXER_INDEX = -1;
const PATTERNS_INDEX = -2;

const same = (a: NavState, b: NavState) =>
  a.screen === b.screen && a.instrumentId === b.instrumentId;

/** The instrument shown: the state's if it still exists, otherwise the first. */
export function navIndex(nav: NavState, ids: readonly string[]): number {
  const i = nav.instrumentId === undefined ? -1 : ids.indexOf(nav.instrumentId);
  return i >= 0 ? i : 0;
}

/** The phone's screen: an instrument's screens fall back to the session once it is gone. */
export function phoneScreen(nav: NavState, ids: readonly string[]): Screen {
  if (nav.screen !== 'edit' && nav.screen !== 'rack') return nav.screen;
  const gone =
    ids.length === 0 || (nav.instrumentId !== undefined && !ids.includes(nav.instrumentId));
  return gone ? 'session' : nav.screen;
}

/** The desktop's selection: the mixer, the pattern launcher, or an instrument's index. */
export function desktopIndex(nav: NavState, ids: readonly string[]): number {
  if (nav.screen === 'mixer') return MIXER_INDEX;
  if (nav.screen === 'patterns') return PATTERNS_INDEX;
  return navIndex(nav, ids);
}

/** The state after the desktop selects index `i` (an instrument, the mixer or the pattern launcher). */
export function desktopSelect(i: number, ids: readonly string[]): Partial<NavState> {
  if (i === MIXER_INDEX) return { screen: 'mixer' };
  if (i === PATTERNS_INDEX) return { screen: 'patterns' };
  return { screen: 'edit', instrumentId: ids[i] };
}

/**
 * Whether leaving the jam (closing the tab, reloading, Back past its first page, a link away) should
 * ask first: when it would stop the music or drop the others. Alone and stopped, nothing is lost (the
 * host's song is autosaved), so it just leaves.
 */
export function shouldConfirmLeave(jam: { playing: boolean; peers: number }): boolean {
  return jam.playing || jam.peers > 0;
}

/**
 * The current page, with one history entry per user gesture: changes made in the same task (a tap
 * that opens an instrument sets both its id and the screen, or an effect that follows) are merged into
 * the entry the first one pushed.
 */
export class NavHistory {
  current = $state<NavState>(START);
  private merging = false;

  constructor(
    private readonly push: (state: NavState) => void,
    private readonly replace: (state: NavState) => void
  ) {}

  go(next: Partial<NavState>) {
    const target = { ...this.current, ...next };
    if (same(target, this.current)) return;
    this.current = target;
    if (this.merging) {
      this.replace(target);
      return;
    }
    this.push(target);
    this.merging = true;
    setTimeout(() => (this.merging = false), 0);
  }

  /** Back or Forward: the browser brought back an entry (none: the page as first loaded). */
  restore(state: NavState | undefined) {
    const s = state ?? START;
    if (!same(s, this.current)) this.current = { ...s };
  }
}
