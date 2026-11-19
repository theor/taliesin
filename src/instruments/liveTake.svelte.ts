import type { IDispatchingInstrumentViewProps } from '$lib';
import type { Instrument } from '$lib/instruments';
import { loadMonitor, monitorNote, saveMonitor } from '$lib/monitor';
import type { Scale } from '$lib/parts.svelte';
import { quantizeStep, type Quantize } from '$lib/recorder';
import { getInstrument } from '$lib/Store.svelte';
import { strudel } from '$lib/strudel';
import { loadTakeOptions, saveTakeOptions, Take } from '$lib/take.svelte';

/** What a hit snaps to: every step, or every 2nd / 4th step. */
export const RESOLUTIONS = [
  { label: 'Every step', value: 1 },
  { label: '2 steps', value: 2 },
  { label: '4 steps', value: 4 }
] as const;

/**
 * What this device hears of the instrument: `loop`, its pattern, as the room does (and what you play on
 * top); `live`, only what you play: the pattern is left out here (`playHere`), so nothing sounds twice.
 */
export type Heard = 'loop' | 'live';

export interface LiveTakeOptions {
  /** What is heard when the view opens. */
  heard?: Heard;
  /**
   * Switch to `live` when a take is armed and back to `loop` when it ends: for an input that keeps
   * playing on its own (the tombola), which would otherwise double the loop it just recorded.
   */
  liveWhileRecording?: boolean;
  /** Whether the view is playing live at all (the tombola only with physics on); default yes. */
  active?: () => boolean;
}

/**
 * What a live-input view (pads, draw) needs to record: a `Take` reading the view's props, the take
 * options and "hear notes" (saved per device), the quantize setting, the local monitor, and what is
 * heard here: the loop, or only what is played (`heard`). Create it while the component initialises
 * (it saves the settings and leaves the pattern out in effects).
 */
export class LiveTake {
  options = $state(loadTakeOptions());
  hear = $state(loadMonitor());
  /** Snap to every Nth step (RESOLUTIONS). */
  resolution = $state<number>(1);
  heard = $state<Heard>('loop');
  readonly take: Take;

  constructor(
    private props: () => IDispatchingInstrumentViewProps,
    private scale: Scale,
    private mode: Quantize['mode'],
    private liveOptions: LiveTakeOptions = {}
  ) {
    this.heard = liveOptions.heard ?? 'loop';
    this.take = new Take({
      get instrumentId() {
        return props().instrumentData.id;
      },
      dispatch: (cmd) => props().dispatch(cmd),
      now: () => this.now(),
      playing: () => props().playing ?? false,
      length: () => this.length(),
      quantize: () => this.quantize,
      tracks: () => this.trackCount,
      isOn: (track, step) =>
        this.instr?.sequencer?.getCell(props().instrumentData, track, step) ?? false,
      options: () => this.options
    });
    $effect(() => saveTakeOptions({ ...this.options }));
    $effect(() => saveMonitor(this.hear));
    // leave the pattern out here while playing live; put it back when that ends or the view closes
    $effect(() => {
      const { instrumentData, playHere } = props();
      if (!this.playingLive || !playHere) return;
      const id = instrumentData.id;
      playHere(id, true);
      return () => playHere(id, false);
    });
    if (liveOptions.liveWhileRecording) {
      let was = this.take.phase;
      $effect(() => {
        const phase = this.take.phase;
        if (phase === was) return;
        if (was === 'idle') this.heard = 'live';
        else if (phase === 'idle') this.heard = 'loop';
        was = phase;
      });
    }
  }

  /** Whether this device hears only what is played (the pattern left out here). */
  get playingLive(): boolean {
    return this.heard === 'live' && (this.liveOptions.active?.() ?? true);
  }

  get instr(): Instrument | undefined {
    return getInstrument(this.props().instrumentData);
  }
  get quantize(): Quantize {
    return { resolution: this.resolution, mode: this.mode };
  }
  /** The instrument's grid rows. */
  get trackCount(): number {
    return this.instr?.sequencer?.tracks.length ?? 0;
  }
  length() {
    return (
      this.instr?.getLength(this.props().instrumentData) ?? { stepsPerMeasure: 4, measures: 1 }
    );
  }
  /** The live clock when the page provides one; the 50 ms playhead prop is only a fallback. */
  private now() {
    const p = this.props();
    return p.now?.() ?? p.position ?? 0;
  }
  /** The loop step a hit would fall on now, recorded or not (to play along before arming). */
  freeStep(): number | undefined {
    if (!this.props().playing) return undefined;
    return quantizeStep(this.now(), this.length(), this.quantize);
  }
  /** Play `track` on this device, if the player wants to hear what they play. */
  monitor(track: number) {
    const instr = this.instr;
    if (this.hear && instr)
      monitorNote(strudel, instr, this.props().instrumentData, this.scale, track);
  }
}
