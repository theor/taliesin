import { Instrument, getPart, type InputView, type InstrumentData } from "$lib/instruments";
import { makePartData } from "$lib/Store.svelte";
import { PartTrackNotes, PartSteps, PartEffects } from "$lib/parts.svelte";
import {DrumNote  } from "$lib/parts.svelte";
import { Sequencer, TrackSequencer } from "$lib/sequencer";


export class Drum extends Instrument {
    /** A new groove on the tracks the kit already has: kick on the downbeats, snare on the backbeats. */
    public randomize(data: InstrumentData): InstrumentData {
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
    public generate_(data: InstrumentData): string {
      return '';
    }
    override name: string = 'Drum';
    /** Drum tracks are independent rows of hits, which suits Euclidean circles. */
    override views: InputView[] = ['grid', 'circle', 'rings'];
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
      return [
        makePartData(PartTrackNotes, o),
        makePartData(PartSteps, { stepsPerMeasure: 4, measures: 2, oddSignature: false }),
      ];
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
  