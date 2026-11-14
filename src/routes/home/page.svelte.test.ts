import { describe, test, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';

const goto = vi.fn();
vi.mock('$app/navigation', () => ({ goto: (...a: unknown[]) => goto(...a) }));
vi.mock('$app/paths', () => ({ base: '' }));

import Page from './+page.svelte';

beforeEach(() => goto.mockClear());

describe('/home', () => {
  test('"Start a jam" opens a new room as host, with a short code', async () => {
    render(Page);
    await userEvent.click(screen.getByRole('button', { name: 'Start a jam' }));
    expect(goto).toHaveBeenCalledTimes(1);
    expect(goto.mock.calls[0][0]).toMatch(/^\/\?host&room=[A-Z2-9]{6}$/);
  });

  test('joining works with a pasted share link and with a bare code', async () => {
    render(Page);
    const input = screen.getByLabelText('Jam link or code');
    const join = screen.getByRole('button', { name: 'Join' });
    expect(join).toBeDisabled();

    await userEvent.type(input, 'http://localhost/?join=true&room=K7P2QD');
    expect(join).toBeEnabled();
    await userEvent.click(join);
    expect(goto).toHaveBeenLastCalledWith('/?join&room=K7P2QD');

    await userEvent.clear(input);
    await userEvent.type(input, 'ABC234{Enter}');
    expect(goto).toHaveBeenLastCalledWith('/?join&room=ABC234');
  });

  test('garbage is rejected with a message and cannot be submitted', async () => {
    render(Page);
    await userEvent.type(screen.getByLabelText('Jam link or code'), 'two words');
    expect(screen.getByText(/doesn't look like/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    expect(goto).not.toHaveBeenCalled();
  });
});
