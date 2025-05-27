import { Instrument, getPart, type InstrumentData } from "$lib";
import { PartTrackNotes, PartSteps, PartEffects } from "$lib/parts.svelte";
import {DrumNote  } from "$lib/parts.svelte";
import { Sequencer, TrackSequencer } from "$lib/sequencer";


export class Drum extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
      return data;
    }
    public generate(data: InstrumentData): string {
      const notes = getPart(PartTrackNotes, data)!;
      const effects = getPart(PartEffects, data);
      const length = this.getLength(data);
      const joined = Object.entries(notes.data.notes)
        .map((t) => {
          const [k, v] = t;
          var p = Array.from({length: length.stepsPerMeasure*length.measures}, (_,i) => v[i] == 1 ? k : '~').join(' ');
          return `<${p}>*${length.stepsPerMeasure}`;
        })
        .join(','); // `s("${data.notes.join(' ')}")`;
      return `s("${joined}")${effects?.generate() || ''}`;
    }
    override name: string = 'Drum';
    constructor() {
      super();
      // this.sequencer = new DrumSequencer();
      this.sequencer = new Sequencer(this, new TrackSequencer(), PartTrackNotes);
    }
    createData_() {
      let o = { notes: {} } as { notes: { [key in DrumNote]: (0 | 1)[] } };
  
      o.notes[DrumNote.kick] = [1, 0, 0, 0, 1, 0, 0, 0];
      o.notes[DrumNote.snare] = [0, 0, 1, 0, 0, 0, 1, 0];
      o.notes[DrumNote.hiHat] = [1, 1, 1, 1, 1, 1, 1, 1];
      const p: PartTrackNotes = new PartTrackNotes({notes:o.notes});
      const steps: PartSteps = new PartSteps(4, 2, false);
      return [p, steps];
      // return {notes:[
      // [DrumNote.kick,DrumNote.hiHat],
      // [DrumNote.hiHat],
      // [DrumNote.snare, DrumNote.hiHat],
      // [DrumNote.hiHat],
      // [DrumNote.kick,DrumNote.hiHat],
      // [DrumNote.hiHat],
      // [DrumNote.snare, DrumNote.hiHat],
      // [DrumNote.hiHat],
      // ]};
    }
  }
  