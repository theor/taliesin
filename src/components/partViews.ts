import type { Component } from 'svelte';
import {
  PartArpeggiator,
  PartChords,
  PartEffects,
  PartEnvelope,
  PartFilter,
  PartFm,
  PartOctave,
  PartSteps,
  PartVoice,
  ROLE_LABELS,
  ROLE_ORDER,
  getPartType,
  partTitle,
  type InstrumentPart,
  type InstrumentPartData,
  type PartClass
} from '$lib/parts.svelte';
import type { IPartViewProps } from '$lib/interfaces';
import PartArpView from './PartArpView.svelte';
import PartChordsView from './PartChordsView.svelte';
import PartEffectsView from './PartEffectsView.svelte';
import PartEnvelopeView from './PartEnvelopeView.svelte';
import PartFilterView from './PartFilterView.svelte';
import PartFmView from './PartFmView.svelte';
import PartOctaveView from './PartOctaveView.svelte';
import PartStepsView from './PartStepsView.svelte';
import PartVoiceView from './PartVoiceView.svelte';

type PartView = Component<IPartViewProps<InstrumentPart<any>>>;
const view = <T extends InstrumentPart<any>>(
  part: PartClass<T>,
  component: Component<IPartViewProps<T>>
) => ({
  id: part.id,
  component: component as unknown as PartView
});

/**
 * The controls of each part, in signal order: grouped by `Role`, the groups in `ROLE_ORDER` (a test
 * checks it). Input parts (notes) are edited by the instrument's input views instead, so they have none.
 */
export const PART_VIEWS: { id: string; component: PartView }[] = [
  // notes
  view(PartSteps, PartStepsView),
  // note FX
  view(PartOctave, PartOctaveView),
  view(PartChords, PartChordsView),
  view(PartArpeggiator, PartArpView),
  // sound
  view(PartVoice, PartVoiceView),
  view(PartFm, PartFmView),
  view(PartEnvelope, PartEnvelopeView),
  // sound FX
  view(PartFilter, PartFilterView),
  view(PartEffects, PartEffectsView)
];

/**
 * The parts that could still be added (`addable`, minus those in `parts`), in signal order, grouped by
 * role. Only parts with controls: one without would add an empty module.
 */
export function addablePartGroups(
  addable: readonly PartClass[],
  parts: readonly InstrumentPartData[]
) {
  const missing = PART_VIEWS.flatMap(({ id }) => {
    const type = getPartType(id);
    const ok = type && addable.some((P) => P.id === id) && !parts.some((p) => p.partName === id);
    return ok ? [{ id, title: partTitle(id), role: type.role }] : [];
  });
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    parts: missing.filter((p) => p.role === role)
  })).filter((g) => g.parts.length > 0);
}

/** The views of the parts an instrument has, in signal order, grouped by role (empty groups left out). */
export function partViewGroups(parts: readonly InstrumentPartData[]) {
  const present = PART_VIEWS.flatMap(({ id, component }) => {
    const part = parts.find((p) => p.partName === id);
    const role = getPartType(id)?.role;
    return part && role ? [{ part, component, role }] : [];
  });
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_LABELS[role],
    modules: present.filter((m) => m.role === role)
  })).filter((g) => g.modules.length > 0);
}
