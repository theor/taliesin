import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import Mixer from './Mixer.svelte';
import type { Command } from '$lib/commands';

afterEach(cleanup);

describe('Mixer', () => {
  test('the key and the mode of the song are changed by command', async () => {
    const dispatch = vi.fn<(cmd: Command) => void>();
    const song = { instrumentsData: [], volume: 1, scale: { scaleKey: 'A', scaleMode: 'minor' } };
    render(Mixer, { props: { song, dispatch } });
    expect(screen.getByLabelText('Key')).toHaveValue('A');

    await fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'D' } });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setScale',
      scaleKey: 'D',
      scaleMode: 'minor'
    });
    await fireEvent.change(screen.getByLabelText('Mode'), { target: { value: 'dorian' } });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setScale',
      scaleKey: 'A',
      scaleMode: 'dorian'
    });
  });
});
