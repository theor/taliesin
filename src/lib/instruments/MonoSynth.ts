import { Instrument, type InputView, type InstrumentData } from '$lib/instruments';
import {
  getPart,
  makePartData,
  MonoSequence,
  PartArpeggiator,
  PartChords,
  PartEffects,
  PartEnvelope,
  PartFilter,
  PartFm,
  PartOctave,
  PartSteps,
  PartVoice,
  type InstrumentPartData,
  type Scale
} from '$lib/parts.svelte';
import { Sequencer, MonoSequenceSequencer } from '$lib/sequencer';
import { DEGREES_PER_OCTAVE, degreeName } from '$lib/scale';

/** A melodic instrument: one scale degree per step, with optional chords, arpeggio and sound design parts. */
export class PianoScale extends Instrument {
  readonly name = 'PianoScale';
  readonly input = MonoSequence;
  override readonly addableParts = [
    PartSteps,
    PartOctave,
    PartChords,
    PartArpeggiator,
    PartVoice,
    PartFm,
    PartEnvelope,
    PartFilter,
    PartEffects
  ];
  /** One pad per scale degree to play the melody in; or a tombola of degrees. */
  override views: InputView[] = ['grid', 'record', 'draw', 'tombola'];
  constructor() {
    super();
    this.sequencer = new Sequencer(new MonoSequenceSequencer(), MonoSequence);
  }

  /**
   * A random melody on the grid's rows inside one octave: the top row (the octave above) is left out,
   * so a random tune stays around the key's root.
   */
  randomize(data: InstrumentData): InstrumentData {
    const part = getPart(MonoSequence, data);
    if (!part) return data;
    const rows = MonoSequenceSequencer.degrees.filter((d) => d < DEGREES_PER_OCTAVE);
    const length = this.getLength(data);
    part.notes = Array.from(
      { length: length.stepsPerMeasure * length.measures },
      () => rows[Math.floor(Math.random() * rows.length)]
    );
    return data;
  }
  /** An instrument saved before voices existed has no PartVoice: it keeps the sawtooth. */
  protected override generateExtra(data: InstrumentData): string {
    return getPart(PartVoice, data) ? '' : '.sound("sawtooth")';
  }
  override trackLabel(track: string, scale: Scale): string {
    return degreeName(scale.scaleKey, scale.scaleMode, Number(track));
  }
  protected createParts(): InstrumentPartData[] {
    return [
      makePartData(PartVoice),
      makePartData(PartEnvelope),
      makePartData(PartOctave, { octave: 4 }),
      makePartData(MonoSequence, { notes: [1, 2, 3, undefined, 4, 5, 3, undefined] }),
      makePartData(PartSteps, { stepsPerMeasure: 8, measures: 2, oddSignature: false }),
      makePartData(PartEffects, { reverb: 0.2 })
    ];
  }
}
