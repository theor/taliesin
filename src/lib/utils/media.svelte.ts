/**
 * Whether a CSS media query matches, as reactive state. Where `matchMedia` does not exist (jsdom, SSR)
 * it reports `fallback`, so tests render the desktop layout.
 */
export class Media {
  matches = $state(false);
  constructor(query: string, fallback = false) {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      this.matches = fallback;
      return;
    }
    const mql = window.matchMedia(query);
    this.matches = mql.matches;
    mql.addEventListener?.('change', (e) => (this.matches = e.matches));
  }
}

/** Phones get their own layout (Tailwind's `md` breakpoint is 768px). */
export const PHONE_QUERY = '(max-width: 767.98px)';
