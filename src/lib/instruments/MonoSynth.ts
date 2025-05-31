import { makePartData } from "$lib/Store.svelte";
import { Instrument,getPart,type InstrumentData } from "$lib/instruments";
import { InstrumentPart, MonoSequence, PartEffects, PartFilter, PartOctave, PartSteps, type InstrumentPartData } from "$lib/parts.svelte";
import { Sequencer, MonoSequenceSequencer } from "$lib/sequencer";


export class PianoScale extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
      const part = getPart(MonoSequence, data)!;
      const length = this.getLength(data);

      part.notes = Array.from({length: length.stepsPerMeasure * length.measures}, (_, i) => {
        return Math.floor(Math.random() * 7);
      });
      // const notes = part.data.notes.map(() => {
      //   return Math.floor(Math.random() * 7);
      // });
      // part.data.notes = notes;
      return data;
    }
    protected generate_(data: InstrumentData): string {
      return `.sound("sawtooth").n(4)`;
    }
    override name: string = 'PianoScale';
    // notes = [1,2,3,4,5,6,7].map(x => x.toString());
    override createData_(): InstrumentPartData[] {
      return [
        makePartData(PartOctave, {octave:4}),
        makePartData(MonoSequence, {notes:[1, 2, 3, undefined, 4, 5, 3, undefined]}),
        makePartData(PartSteps, {stepsPerMeasure: 8, measures: 2, oddSignature: false}),
        makePartData(PartEffects, { reverb: .2,  })
      ];
    }
     
    constructor() {
      super();
      this.sequencer = new Sequencer(this,new MonoSequenceSequencer(), MonoSequence);

    }
  }
  