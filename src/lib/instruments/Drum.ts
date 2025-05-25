import { Instrument, getPart, type InstrumentData } from "$lib";
import type { InstrumentPart, MonoSequence, PartOctave, PartSteps, PartTrackNotes } from "$lib/parts";
import {DrumNote  } from "$lib/parts";
import { Sequencer, TrackSequencer } from "$lib/sequencer";


export class Drum extends Instrument {
    public randomize(data: InstrumentData): InstrumentData {
      return data;
    }
    public generate(data: InstrumentData): string {
      const notes = getPart<PartTrackNotes>('trackNotes', data)!;
      const joined = Object.entries(notes.notes)
        .map((t) => {
          const [k, v] = t;
          var p = v.map((x) => (x == 1 ? k : '~')).join(' ');
          return p;
        })
        .join(','); // `s("${data.notes.join(' ')}")`;
      return `s("${joined}")`;
    }
    name: string = 'Drum';
    constructor() {
      super();
      // this.sequencer = new DrumSequencer();
      this.sequencer = new Sequencer(this, new TrackSequencer(), 'trackNotes');
    }
    createData_() {
      let o = { notes: {} } as { notes: { [key in DrumNote]: (0 | 1)[] } };
  
      o.notes[DrumNote.kick] = [1, 0, 0, 0, 1, 0, 0, 0];
      o.notes[DrumNote.snare] = [0, 0, 1, 0, 0, 0, 1, 0];
      o.notes[DrumNote.hiHat] = [1, 1, 1, 1, 1, 1, 1, 1];
      const p: PartTrackNotes = {
        type: 'trackNotes',
        notes: o.notes
      };
      const steps: PartSteps = {
        type: 'steps',
        stepsPerMeasure: 4,
        measures: 2
      };
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
  