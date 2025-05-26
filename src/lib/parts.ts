

export enum DrumNote {
    kick = 'bd',
    snare = 'sd',
    hiHat = 'hh',
    clap = 'cp',
    crash = 'cr',
    ride = 'rd',
    highTom = 'ht',
    medTom = 'mt',
    lowTom = 'lt'
  }
export interface PartOctave {
    type: 'octave';
    octave: number;
  }
  export interface PartSteps {
      type: 'steps';
    stepsPerMeasure: number;
    measures: number;
    oddSignature: boolean;
  }
  export interface PartTrackNotes {
    type: 'trackNotes';
    notes: { [key in DrumNote]: (0 | 1)[] };
  }
  export interface MonoSequence {
    type: 'notes';
    notes: (number | undefined)[];
  }
  export type InstrumentPart = PartOctave | PartTrackNotes | MonoSequence | PartSteps;
