import { describe, expect, test } from 'vitest';
import { PART_TYPES, ROLE_ORDER, Stage, getPartType } from '$lib/parts.svelte';
import { PART_VIEWS } from './partViews';

const rank = (id: string) => ROLE_ORDER.indexOf(getPartType(id)!.role);

// One signal order, three places that must agree: the roles, the code's stage order, and the views.
describe('signal order', () => {
  test('every part has a known role', () => {
    for (const P of PART_TYPES) expect(ROLE_ORDER).toContain(getPartType(P.id)!.role);
  });

  test('the views are grouped by role, the groups in signal order', () => {
    const ranks = PART_VIEWS.map((v) => rank(v.id));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('sorting the parts that emit code by stage never puts a later role first', () => {
    const emitting = PART_TYPES.map((P) => getPartType(P.id)!)
      .filter((p) => p.stage !== Stage.none)
      .sort((a, b) => a.stage - b.stage);
    const ranks = emitting.map((p) => ROLE_ORDER.indexOf(p.role));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  test('input parts make the notes', () => {
    for (const P of PART_TYPES) {
      const part = getPartType(P.id)!;
      if (part.isInput()) expect(part.role).toBe('notes');
    }
  });
});
