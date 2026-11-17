import { makePartData, getPartTypeAndData } from "$lib/Store.svelte";
import { Instrument,getPart,type Constructor,type InputView, type InstrumentData } from "$lib/instruments";
import { InstrumentPart, MonoSequence, PartEffects, PartFilter, PartOctave, PartSteps, PartVoice, PartFm, PartEnvelope, InstrumentPartTyped, type InstrumentPartData } from "$lib/parts.svelte";
import { Sequencer, MonoSequenceSequencer } from "$lib/sequencer";
import { degreeName } from "$lib/scale";


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
      // an instrument saved before voices existed has no PartVoice: it keeps the sawtooth
      const length = this.getLength(data);
      const gen = (x: Constructor<InstrumentPartTyped<any>>) => {
        const p = getPartTypeAndData(x, data);
        return p.data ? p.part.generate(data, { ...p.data, partName: x.name }, length) : '';
      };
      return `${gen(PartVoice) || '.sound("sawtooth")'}${gen(PartFm)}${gen(PartEnvelope)}`;
    }
    override name: string = 'PianoScale';
    /** One pad per scale degree to play the melody in. */
    override views: InputView[] = ['grid', 'record'];
    override trackLabel(track: string, scale: { scaleKey: string; scaleMode: string }): string {
      return degreeName(scale.scaleKey, scale.scaleMode, Number(track));
    }
    // notes = [1,2,3,4,5,6,7].map(x => x.toString());
    override createData_(): InstrumentPartData[] {
      return [
        makePartData(PartVoice),
        makePartData(PartEnvelope),
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
  