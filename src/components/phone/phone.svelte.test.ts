import { afterEach, describe, expect, test, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import SessionView from './SessionView.svelte';
import Mixer from '../Mixer.svelte';
import { createInstrument } from '$lib/Store.svelte';
import { Drum } from '$lib/instruments/Drum';
import { PianoScale } from '$lib/instruments/MonoSynth';
import { TrackState } from '$lib/instruments';
import type { Command, Song } from '$lib/commands';
import { trackColor, trackInitials } from '$lib/trackColors';

afterEach(cleanup);

function makeSong(): Song {
  const drums = createInstrument(Drum);
  drums.name = 'Drums';
  const lead = createInstrument(PianoScale);
  lead.name = 'Lead';
  const song: Song = $state({
    instrumentsData: [drums, lead],
    volume: 0.8,
    scale: { scaleKey: 'D', scaleMode: 'dorian' }
  });
  return song;
}

function mountSession(song = makeSong(), extra: object = {}) {
  const dispatch = vi.fn<(cmd: Command) => void>();
  const onSelect = vi.fn<(i: number) => void>();
  const onAdd = vi.fn();
  render(SessionView, {
    props: {
      song,
      dispatch,
      position: 0,
      playing: false,
      selectedIndex: 0,
      onSelect,
      onAdd,
      ...extra
    }
  });
  return { song, dispatch, onSelect, onAdd };
}

describe('SessionView (phone)', () => {
  test('one card per instrument, each with a glance at its pattern', () => {
    const { song } = mountSession();
    expect(screen.getByRole('button', { name: 'Edit Drums' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Lead' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mini-pattern')).toHaveLength(song.instrumentsData.length);
    expect(screen.getByText('D')).toBeInTheDocument(); // the song's key in the transport
  });

  test('tapping a card opens that instrument', async () => {
    const { onSelect } = mountSession();
    await fireEvent.click(screen.getByRole('button', { name: 'Edit Lead' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  test('mute and solo are absolute commands for that card’s instrument', async () => {
    const { song, dispatch } = mountSession();
    await fireEvent.click(screen.getByRole('button', { name: 'Mute Lead' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: song.instrumentsData[1].id,
      fields: { state: TrackState.Muted }
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Solo Drums' }));
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: song.instrumentsData[0].id,
      fields: { state: TrackState.Solo }
    });
  });

  test('the transport plays and stops the song', async () => {
    const { dispatch } = mountSession();
    await fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'transport', action: 'toggle' });
    await fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'transport', action: 'stop' });
  });

  test('while playing, the toggle pauses and the position shows bar.beat', () => {
    mountSession(makeSong(), { playing: true, position: 2.5 });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(screen.getByTestId('position')).toHaveTextContent('3.3');
  });

  test('an empty song offers a beat to start from, and Add opens the dialog', async () => {
    const empty: Song = {
      instrumentsData: [],
      volume: 1,
      scale: { scaleKey: 'A', scaleMode: 'minor' }
    };
    const { dispatch, onAdd } = mountSession(empty);
    await fireEvent.click(screen.getByRole('button', { name: 'Start with a beat' }));
    expect(dispatch.mock.calls.map(([c]) => c.type)).toContain('addInstrument');
    await fireEvent.click(screen.getByRole('button', { name: 'Add instrument' }));
    expect(onAdd).toHaveBeenCalled();
  });
});

describe('Mixer', () => {
  test('each strip’s fader sets that instrument’s volume; the master sets the song’s', async () => {
    const song = makeSong();
    const dispatch = vi.fn<(cmd: Command) => void>();
    render(Mixer, { props: { song, dispatch } });
    await fireEvent.input(screen.getByRole('slider', { name: 'Lead volume' }), {
      target: { value: '0.25' }
    });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setInstrumentFields',
      instrumentId: song.instrumentsData[1].id,
      fields: { volume: 0.25 }
    });
    await fireEvent.input(screen.getByRole('slider', { name: 'Master Volume' }), {
      target: { value: '0.5' }
    });
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'setMasterVolume', volume: 0.5 });
  });

  test('the key is changed by command', async () => {
    const song = makeSong();
    const dispatch = vi.fn<(cmd: Command) => void>();
    render(Mixer, { props: { song, dispatch } });
    await fireEvent.change(screen.getByLabelText('Key'), { target: { value: 'E' } });
    expect(dispatch).toHaveBeenLastCalledWith({
      type: 'setScale',
      scaleKey: 'E',
      scaleMode: 'dorian'
    });
  });
});

describe('track colours', () => {
  test('cycle through the palette, and initials come from the name', () => {
    expect(trackColor(0)).not.toBe(trackColor(1));
    expect(trackColor(6)).toBe(trackColor(0));
    expect(trackInitials('Drums')).toBe('DR');
    expect(trackInitials('Lead synth')).toBe('LS');
  });
});
