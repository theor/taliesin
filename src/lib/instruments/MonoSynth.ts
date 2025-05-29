import { Instrument,getPart,type InstrumentData } from "$lib/instruments";
import { InstrumentPart, MonoSequence, PartEffects, PartFilter, PartOctave, PartSteps } from "$lib/parts.svelte";
import { Sequencer, MonoSequenceSequencer } from "$lib/sequencer";


export class PianoScale extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
      const part = getPart(MonoSequence, data)!;
      const length = this.getLength(data);

      part.data.notes = Array.from({length: length.stepsPerMeasure * length.measures}, (_, i) => {
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
    override createData_(): InstrumentPart[] {
      return [
        new PartOctave(4),
        new MonoSequence({notes:[1, 2, 3, undefined, 4, 5, 3, undefined]}),
        new PartSteps(8, 2, false),
        new PartEffects({ reverb: .2,  })
      ];
    }
     
    constructor() {
      super();
      this.sequencer = new Sequencer(this,new MonoSequenceSequencer(), MonoSequence);

    }
  }
  