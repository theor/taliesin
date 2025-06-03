import { getPart, Instrument, type Constructor, type InstrumentData, type Length } from "./instruments";
import { DrumNote, InstrumentPartTyped, type InstrumentPart, type MonoSequence, type PartTrackNotes, type PartType } from "./parts.svelte";

export interface ISequencer {
    tracks: string[];
  
    getCell(data: InstrumentData, track: number, step: number): boolean;
    setCell(data: InstrumentData, track: number, step: number, value: boolean): boolean;
  }
  export class Sequencer<TTrack, T extends InstrumentPartTyped<any>> implements ISequencer {
    tracks: string[];
    constructor(
        private instrument: Instrument,
      private partSequencer: PartSequencer<TTrack, T>,
      private partType: Constructor<T>
    ) {
      this.partSequencer = partSequencer;
      this.tracks = this.partSequencer.tracks.map((x) => `${x}`);
    }
    getCell(data: InstrumentData, track: number, step: number): boolean {
      return this.partSequencer.getCell(
        getPart(this.partType, data)!,
        this.partSequencer.tracks[track],
        step
      );
    }
    setCell(data: InstrumentData, track: number, step: number, value: boolean): boolean {
      return this.partSequencer.setCell(
        getPart(this.partType, data)!,
        this.partSequencer.tracks[track],
        step,
        value
      );
    }
  }
  export interface PartSequencer<TTrack, T extends InstrumentPartTyped<any>> {
    tracks: TTrack[];
    getCell(part: PartType<T>, track: TTrack, step: number): boolean;
    setCell(part: PartType<T>, track: TTrack, step: number, value: boolean): boolean;
  }

  export class MonoSequenceSequencer implements PartSequencer<number, MonoSequence> {
    tracks: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
    length = 4;
    getCell(part: PartType<MonoSequence>, track: number, step: number): boolean {
      if (!part || step < 0 || step >= part.notes.length) return false;
      return part.notes[step] == track;
    }
    setCell(part: PartType<MonoSequence>, track: number, step: number, value: boolean): boolean {
      if (!part || step < 0) return false;
      if(step >= part.notes.length)
        part.notes = [...part.notes, ...new Array(step - part.notes.length + 1).fill(undefined)];   
      let changed = part.notes[step] !== track;
      part.notes[step] = value ? track : undefined;
      return changed;
    }
  }
  
  export class TrackSequencer implements PartSequencer<string, PartTrackNotes> {
    length = 8;
    tracks = Object.values(DrumNote);
    getCell(part: PartType<PartTrackNotes>, track: string, step: number): boolean {
      if (!part) return false;
      const trackData = part.notes[track as DrumNote];
      if (!trackData) return false;
      if (step < 0 || step >= trackData.length) return false;
      return trackData[step] == 1;
    }
    setCell(part: PartType<PartTrackNotes>, track: string, step: number, value: boolean): boolean {
      if (!part) return false;
      let trackData = part.notes[track as DrumNote];
      if (!trackData) {
        trackData = new Array(this.length).fill(0);
      }
      let changed = trackData[step] !== (value ? 1 : 0);
      trackData[step] = value ? 1 : 0;
      part.notes[track as DrumNote] = trackData;
      return changed;
    }
  }
