import { getPart, type InstrumentData } from "./instruments";
import { DrumNote, type InstrumentPart, type MonoSequence, type PartTrackNotes } from "./parts";

export interface ISequencer {
    length(): number;
    tracks: string[];
  
    getCell(data: InstrumentData, track: number, step: number): boolean;
    setCell(data: InstrumentData, track: number, step: number, value: boolean): void;
  }
  export class Sequencer<TTrack, T extends InstrumentPart> implements ISequencer {
    tracks: string[];
    length(): number {
      return this.partSequencer.length;
    }
    constructor(
      private partSequencer: PartSequencer<TTrack, T>,
      private partType: T['type']
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
    setCell(data: InstrumentData, track: number, step: number, value: boolean): void {
      this.partSequencer.setCell(
        getPart(this.partType, data)!,
        this.partSequencer.tracks[track],
        step,
        value
      );
    }
  }
  export interface PartSequencer<TTrack, T extends InstrumentPart> {
    tracks: TTrack[];
    length: number;
    getCell(part: T, track: TTrack, step: number): boolean;
    setCell(part: T, track: TTrack, step: number, value: boolean): void;
  }

  export class MonoSequenceSequencer implements PartSequencer<number, MonoSequence> {
    tracks: number[] = [0, 1, 2, 3, 4, 5, 6, 7];
    length = 4;
    getCell(part: MonoSequence, track: number, step: number): boolean {
      if (!part || step < 0 || step >= part.notes.length) return false;
      return part.notes[step] == track;
    }
    setCell(part: MonoSequence, track: number, step: number, value: boolean): void {
      if (!part || step < 0 || step >= part.notes.length) return;
      part.notes[step] = value ? track : undefined;
    }
  }
  
  export class TrackSequencer implements PartSequencer<string, PartTrackNotes> {
    length = 8;
    tracks = Object.values(DrumNote);
    getCell(part: PartTrackNotes, track: string, step: number): boolean {
      if (!part) return false;
      const trackData = part.notes[track as DrumNote];
      if (!trackData) return false;
      if (step < 0 || step >= trackData.length) return false;
      return trackData[step] == 1;
    }
    setCell(part: PartTrackNotes, track: string, step: number, value: boolean): void {
      if (!part) return;
      let trackData = part.notes[track as DrumNote];
      if (!trackData) {
        trackData = new Array(this.length).fill(0);
      }
      trackData[step] = value ? 1 : 0;
      part.notes[track as DrumNote] = trackData;
    }
  }
