import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Transport from './Transport.svelte';

afterEach(cleanup);

describe('Transport', () => {
  test('play dispatches a toggle, stop dispatches a stop', async () => {
    const dispatch = vi.fn();
    render(Transport, { props: { playing: false, position: 0, dispatch } });
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'transport', action: 'toggle' }],
      [{ type: 'transport', action: 'stop' }]
    ]);
  });

  test('shows the playing state and the position it is given', () => {
    render(Transport, { props: { playing: true, position: 1.5, dispatch: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByText('1.50')).toBeInTheDocument();
  });
});
