import type { InstrumentData } from './instruments';
import {
  DrumNote,
  getPart,
  type InstrumentPart,
  type MonoSequence,
  type PartClass,
  type PartTrackNotes,
  type PartType
} from './parts.svelte';

/** An instrument's input as a grid of on/off cells: one row per track, one column per step. */
export interface ISequencer {
  tracks: string[];

  getCell(data: InstrumentData, track: number, step: number): boolean;
  setCell(data: InstrumentData, track: number, step: number, value: boolean): boolean;
}
/** Adapts a part's grid logic (`PartSequencer`) to an instrument's data. */
export class Sequencer<TTrack, T extends InstrumentPart<any>> implements ISequencer {
  tracks: string[];
  constructor(
    private partSequencer: PartSequencer<TTrack, T>,
    private partType: PartClass<T>
  ) {
    this.tracks = this.partSequencer.tracks.map((x) => `${x}`);
  }
  getCell(data: InstrumentData, track: number, step: number): boolean {
    const part = getPart(this.partType, data);
    return !!part && this.partSequencer.getCell(part, this.partSequencer.tracks[track], step);
  }
  setCell(data: InstrumentData, track: number, step: number, value: boolean): boolean {
    const part = getPart(this.partType, data);
    return (
      !!part && this.partSequencer.setCell(part, this.partSequencer.tracks[track], step, value)
    );
  }
}
export interface PartSequencer<TTrack, T extends InstrumentPart<any>> {
  tracks: TTrack[];
  getCell(part: PartType<T>, track: TTrack, step: number): boolean;
  setCell(part: PartType<T>, track: TTrack, step: number, value: boolean): boolean;
}

/** A melody: one note per step, so turning a cell on moves the step's note to that row. */
export class MonoSequenceSequencer implements PartSequencer<number, MonoSequence> {
  /** The grid's rows: scale degrees 0-6, and 7 for the octave above. */
  static readonly degrees: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7];
  tracks: number[] = [...MonoSequenceSequencer.degrees];
  getCell(part: PartType<MonoSequence>, track: number, step: number): boolean {
    if (step < 0 || step >= part.notes.length) return false;
    return part.notes[step] == track;
  }
  setCell(part: PartType<MonoSequence>, track: number, step: number, value: boolean): boolean {
    if (step < 0) return false;
    while (part.notes.length <= step) part.notes.push(undefined);
    // turning any cell of a step off clears the step (`resizeLoopCommands` relies on it)
    const changed = part.notes[step] !== (value ? track : undefined);
    part.notes[step] = value ? track : undefined;
    return changed;
  }
}

/** Drum tracks: each row is a sound, each cell a hit. */
export class TrackSequencer implements PartSequencer<string, PartTrackNotes> {
  tracks = Object.values(DrumNote);
  getCell(part: PartType<PartTrackNotes>, track: string, step: number): boolean {
    const trackData = part.notes[track as DrumNote];
    if (!trackData || step < 0 || step >= trackData.length) return false;
    return trackData[step] == 1;
  }
  setCell(part: PartType<PartTrackNotes>, track: string, step: number, value: boolean): boolean {
    if (step < 0) return false;
    const trackData = part.notes[track as DrumNote] ?? [];
    // a new track, or a step past its end: fill up with rests (never leave holes, which JSON turns into null)
    while (trackData.length <= step) trackData.push(0);
    const changed = trackData[step] !== (value ? 1 : 0);
    trackData[step] = value ? 1 : 0;
    part.notes[track as DrumNote] = trackData;
    return changed;
  }
}
