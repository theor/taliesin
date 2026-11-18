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
 * What a live-input view (pads, draw) needs to record: a `Take` reading the view's props, the take
 * options and "hear notes" (saved per device), the quantize setting, and the local monitor. Create it
 * while the component initialises (it saves the settings in an effect).
 */
export class LiveTake {
  options = $state(loadTakeOptions());
  hear = $state(loadMonitor());
  /** Snap to every Nth step (RESOLUTIONS). */
  resolution = $state<number>(1);
  readonly take: Take;

  constructor(
    private props: () => IDispatchingInstrumentViewProps,
    private scale: Scale,
    private mode: Quantize['mode']
  ) {
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
