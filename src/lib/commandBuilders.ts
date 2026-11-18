import type { Command } from './commands';
import { diffFields } from './partFields';
import { TrackState, type InstrumentData } from './instruments';
import { getPart, PartSteps } from './parts.svelte';
import { createInstrument, getInstrument, presets } from './Store.svelte';

/**
 * Builders for commands that need something non-deterministic (new ids, random notes). The randomness
 * happens here, once, so the resulting command is plain data that every peer applies identically.
 */
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export function addInstrumentCommand(preset: (typeof presets)[number]): Command {
  const instrument = createInstrument(preset.instrument, preset.parts, preset.name);
  return { type: 'addInstrument', instrument: json(instrument) as any };
}

export function presetCommands(names: string[] = ['Piano', 'Bass', 'Drum']): Command[] {
  return names.flatMap((n) => {
    const preset = presets.find((p) => p.name === n);
    return preset ? [addInstrumentCommand(preset)] : [];
  });
}

/** Randomize on a copy, then express the outcome as per-part field changes. */
export function randomizeCommands(data: InstrumentData): Command[] {
  const instr = getInstrument(data);
  if (!instr) return [];
  const before = json(data);
  const after = instr.randomize(json(data));
  const cmds: Command[] = [];
  for (const part of after.parts) {
    const fields = diffFields(
      before.parts.find((p) => p.partName === part.partName),
      part
    );
    if (Object.keys(fields).length) {
      cmds.push({ type: 'setPartFields', instrumentId: data.id, partName: part.partName, fields });
    }
  }
  return cmds;
}

const totalSteps = (data: InstrumentData) => {
  const l = getInstrument(data)?.getLength(data);
  return l ? l.stepsPerMeasure * l.measures : 0;
};

/** Turn every note of an instrument off. Nothing to send when it is already empty. */
export function clearCommands(data: InstrumentData): Command[] {
  const seq = getInstrument(data)?.sequencer;
  if (!seq) return [];
  const total = totalSteps(data);
  const cmds: Command[] = [];
  for (let track = 0; track < seq.tracks.length; track++) {
    const cells: { step: number; on: boolean }[] = [];
    for (let step = 0; step < total; step++) {
      if (seq.getCell(data, track, step)) cells.push({ step, on: false });
    }
    if (cells.length) cmds.push({ type: 'setCells', instrumentId: data.id, track, cells });
  }
  return cmds;
}

/** The longest loop the grid offers (steps), so a pattern stays playable on a phone. */
export const MAX_LOOP_STEPS = 64;
export const canDoubleLoop = (data: InstrumentData) => {
  const total = totalSteps(data);
  return !!getPart(PartSteps, data) && total > 0 && total * 2 <= MAX_LOOP_STEPS;
};
export const canHalveLoop = (data: InstrumentData) => {
  const steps = getPart(PartSteps, data);
  return !!steps && steps.measures > 1 && steps.measures % 2 === 0;
};

/**
 * Double the loop (the new half repeats the pattern) or halve it (the pattern keeps its first half; the
 * second half stays stored, so doubling again brings back a copy of the first half).
 */
export function resizeLoopCommands(data: InstrumentData, direction: 'double' | 'halve'): Command[] {
  const seq = getInstrument(data)?.sequencer;
  const steps = getPart(PartSteps, data);
  if (!seq || !steps) return [];
  const setMeasures = (measures: number): Command => ({
    type: 'setPartFields',
    instrumentId: data.id,
    partName: PartSteps.id,
    fields: { measures }
  });
  if (direction === 'halve') return canHalveLoop(data) ? [setMeasures(steps.measures / 2)] : [];
  if (!canDoubleLoop(data)) return [];
  const total = totalSteps(data);
  // All the "off" cells go first: on a mono sequence, turning a step off clears whatever note is on it,
  // which would otherwise wipe a note another track has just copied there.
  const offs: Command[] = [];
  const ons: Command[] = [];
  for (let track = 0; track < seq.tracks.length; track++) {
    const off: { step: number; on: boolean }[] = [];
    const on: { step: number; on: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const copy = seq.getCell(data, track, i);
      if (copy) on.push({ step: total + i, on: true });
      else if (seq.getCell(data, track, total + i)) off.push({ step: total + i, on: false });
    }
    if (off.length) offs.push({ type: 'setCells', instrumentId: data.id, track, cells: off });
    if (on.length) ons.push({ type: 'setCells', instrumentId: data.id, track, cells: on });
  }
  return [...offs, ...ons, setMeasures(steps.measures * 2)];
}

/** Mute / solo toggles as absolute states: pressing the active one goes back to playing. */
export function setTrackStateCommand(data: InstrumentData, wanted: TrackState): Command {
  const state = data.state === wanted ? TrackState.Playing : wanted;
  return { type: 'setInstrumentFields', instrumentId: data.id, fields: { state } };
}
