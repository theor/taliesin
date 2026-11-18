import { describe, test, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';

// The page reads its role / room from the URL and joins a Trystero room on load.
vi.mock('$app/state', () => ({
  page: { url: new URL('http://localhost/?host=true&room=test') }
}));
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  beforeNavigate: vi.fn(),
  pushState: vi.fn(),
  replaceState: vi.fn()
}));
vi.mock('trystero', async () => {
  const { createFakeNetwork } = await import('$lib/testing/fakeRoom');
  const net = createFakeNetwork();
  return { joinRoom: () => net.join('host'), getRelaySockets: () => ({}) };
});
// the fake room already has the app's own room shape, so there is nothing to adapt
vi.mock('$lib/netRoom', () => ({ adaptRoom: (room: unknown) => room }));

import Page from './+page.svelte';

describe('/+page.svelte', () => {
  test('renders the app as host', () => {
    render(Page);
    expect(screen.getByText('Taliesin')).toBeInTheDocument();
  });
});
