import { Instrument, type InputView, type InstrumentData } from '$lib/instruments';
import {
  DrumNote,
  getPart,
  makePartData,
  PartEffects,
  PartFilter,
  PartSteps,
  PartTrackNotes
} from '$lib/parts.svelte';
import { Sequencer, TrackSequencer } from '$lib/sequencer';

export class Drum extends Instrument {
  readonly name = 'Drum';
  readonly input = PartTrackNotes;
  /** Parts that work on samples. Not a voice (it would replace the drum sounds), nor parts that need melody notes. */
  override readonly addableParts = [PartSteps, PartFilter, PartEffects];
  /** Drum tracks are independent rows of hits, which suits Euclidean circles. */
  override views: InputView[] = ['grid', 'circle', 'rings', 'record'];
  constructor() {
    super();
    this.sequencer = new Sequencer(new TrackSequencer(), PartTrackNotes);
  }

  /** A new groove on the tracks the kit already has: kick on the downbeats, snare on the backbeats. */
  randomize(data: InstrumentData): InstrumentData {
    const part = getPart(PartTrackNotes, data);
    if (!part) return data;
    const { stepsPerMeasure: per, measures } = this.getLength(data);
    const odds: Partial<Record<DrumNote, (i: number) => number>> = {
      [DrumNote.kick]: (i) => (i % per === 0 ? 1 : 0.15),
      [DrumNote.snare]: (i) => (per > 1 && i % per === Math.floor(per / 2) ? 1 : 0.1),
      [DrumNote.hiHat]: () => 0.75
    };
    for (const track of Object.keys(part.notes) as DrumNote[]) {
      const odd = odds[track] ?? (() => 0.15);
      part.notes[track] = Array.from({ length: per * measures }, (_, i) =>
        Math.random() < odd(i) ? 1 : 0
      );
    }
    return data;
  }

  protected createParts() {
    const notes = {} as { [key in DrumNote]: (0 | 1)[] };
    notes[DrumNote.kick] = [1, 0, 0, 0, 1, 0, 0, 0];
    notes[DrumNote.snare] = [0, 0, 1, 0, 0, 0, 1, 0];
    notes[DrumNote.hiHat] = [1, 1, 1, 1, 1, 1, 1, 1];
    return [
      makePartData(PartTrackNotes, { notes }),
      makePartData(PartSteps, { stepsPerMeasure: 4, measures: 2, oddSignature: false })
    ];
  }
}
