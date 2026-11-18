import {
  getPart,
  getPartType,
  LAST_STEP_STAGE,
  PartSteps,
  type GenContext,
  type InstrumentPart,
  type InstrumentPartData,
  type PartClass,
  type Scale
} from './parts.svelte';
import type { ISequencer } from './sequencer';

/**
 * How an instrument's notes are edited: the step grid, one Euclidean circle per track, nested rings, pads
 * to play along on, drawing, or a tombola that draws random loops (`lib/tombola.ts`).
 */
export type InputView = 'grid' | 'circle' | 'rings' | 'record' | 'draw' | 'tombola';

export interface Length {
  stepsPerMeasure: number;
  measures: number;
}

/**
 * A kind of instrument (a synth, a drum kit). Stateless, like parts: its state is an `InstrumentData` in
 * the song, and this object knows how to create it, edit its cells and turn it into Strudel code.
 */
export abstract class Instrument {
  /** The id its data is stored under (`instrumentName`): saved and sent over the network, so it never changes. */
  abstract readonly name: string;
  /** The part its notes come from (the start of its code). An instrument without it plays nothing. */
  abstract readonly input: PartClass;
  /** The parts that can be added to it from the rack (`addPart`), besides those it starts with. */
  readonly addableParts: readonly PartClass[] = [];
  /** Adapts the instrument's input part to the grid views; undefined when its cells can't be edited. */
  sequencer: ISequencer | undefined;
  /** The ways this instrument's cells can be edited; the first is the default. */
  views: InputView[] = ['grid'];

  getLength(data: InstrumentData): Length {
    const steps = getPart(PartSteps, data);
    return steps
      ? { stepsPerMeasure: steps.stepsPerMeasure, measures: steps.measures }
      : { stepsPerMeasure: 4, measures: 1 };
  }
  abstract randomize(data: InstrumentData): InstrumentData;
  /** What a grid row is called (e.g. a note name instead of a scale degree). */
  trackLabel(track: string, _scale: Scale): string {
    return track;
  }

  protected abstract createParts(): InstrumentPartData[];
  createData(name?: string): InstrumentData {
    return {
      id: newId(),
      parts: this.createParts(),
      instrumentName: this.name,
      name: name || this.name,
      volume: 1,
      state: TrackState.Playing
    };
  }

  /**
   * The instrument as Strudel code: its parts in stage order (see `Stage`), with `.fast(steps)` after
   * the parts that work on the step grid, then anything instrument-specific, then the track's gain.
   * A pure function of the data and the scale.
   */
  generate(data: InstrumentData, scale: Scale): string {
    const parts = data.parts
      .map((p) => ({ data: p, type: getPartType(p.partName) }))
      .filter((p): p is { data: InstrumentPartData; type: InstrumentPart } => !!p.type)
      // the instrument's own input is the start of the chain; any other input part is not played
      .filter((p) => !p.type.isInput() || p.type.id === this.input.id)
      .sort((a, b) => a.type.stage - b.type.stage);
    const input = parts.find((p) => p.type.isInput());
    if (!input) return ''; // nothing to play (the reducer never lets such an instrument in)
    const length = this.getLength(data);
    const ctx: GenContext = {
      ...length,
      ...scale,
      degrees: input.type.degrees(input.data),
      consumed: new Set()
    };
    // in order: a part may take over a later one (`GenContext.consumed`)
    const code = (p: (typeof parts)[number]) =>
      ctx.consumed!.has(p.type.id) ? '' : p.type.generate(data, p.data, ctx);
    return [
      ...parts.filter((p) => p.type.stage <= LAST_STEP_STAGE).map(code),
      `.fast(${length.stepsPerMeasure})`,
      ...parts.filter((p) => p.type.stage > LAST_STEP_STAGE).map(code),
      this.generateExtra(data),
      this.trackOptions(data)
    ]
      .filter(Boolean)
      .join('\n  ');
  }
  /** Code the instrument adds after its parts. */
  protected generateExtra(_data: InstrumentData): string {
    return '';
  }
  protected trackOptions(data: InstrumentData): string {
    return `.gain(${data.volume})`;
  }
}
export type Constructor<T> = new (...args: any[]) => T;
export enum TrackState {
  Playing,
  Muted,
  Solo
}
/** Stable identity used to address an instrument across peers (array indices shift on add/remove). */
export function newId(): string {
  // crypto.randomUUID needs a secure context; fall back for plain-http LAN sessions
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}
export interface InstrumentData {
  id: string;
  name: string;
  instrumentName: string;
  parts: InstrumentPartData[];
  volume: number;
  state: TrackState;
  /**
   * The notes of the patterns that are not live, by slot (`lib/patterns.ts`): the input part's data, or
   * null (the live slot, whose notes are in `parts`, and slots never written). Absent: one pattern.
   */
  patterns?: (InstrumentPartData | null)[];
  /** The slot the host plays (absent: 0). */
  livePattern?: number;
}
export type InstrumentDataJsonValue = InstrumentData & { [key: string]: any };
