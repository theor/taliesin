import type { Command } from './commands';
import { diffFields } from './partFields';
import type { InstrumentData } from './instruments';
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
