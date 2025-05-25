import { Instrument,getPart,type InstrumentData } from "$lib/instruments";
import type { InstrumentPart, MonoSequence, PartOctave } from "$lib/parts";
import { Sequencer, MonoSequenceSequencer } from "$lib/sequencer";


export class PianoScale extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
      const part = getPart<MonoSequence>('notes', data)!;
      const notes = part.notes.map(() => {
        return Math.floor(Math.random() * 7);
      });
      part.notes = notes;
      return data;
    }
    public generate(data: InstrumentData): string {
      const notes = getPart<MonoSequence>('notes', data)!;
      const octave = getPart<PartOctave>('octave', data)?.octave ?? 4;
      console.log(`GEN ${this.name}`, notes.notes, this.getLength(data));
      const length = this.getLength(data);
      return `n("<${Array.from({length: length.stepsPerMeasure*length.measures}, (_,i) => notes.notes[i])
        .map((x) => x ?? '~')
        .join(' ')}>*${length.stepsPerMeasure/length.measures}").scale("C${octave}:minor").sound("sawtooth").n(4)`;
    }
    name: string = 'PianoScale';
    // notes = [1,2,3,4,5,6,7].map(x => x.toString());
    createData_() {
      return [
        { type: 'octave', octave: 4 },
        { type: 'notes', notes: [1, 2, 3, undefined, 4, 5, 3, undefined] },
        { type: 'steps', stepsPerMeasure: 8, measures: 2 }
      ] as InstrumentPart[];
    }
    constructor() {
      super();
      this.sequencer = new Sequencer(this,new MonoSequenceSequencer(), 'notes');

    }
  }
  