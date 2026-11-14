import { describe, expect, test } from 'vitest';
import { diffFields } from './partFields';

describe('diffFields', () => {
  const part = { partName: 'PartEffects', reverb: 0.2, delay: 0, notes: [1, 2, 3] };

  test('returns only what changed', () => {
    expect(diffFields(part, { ...part, reverb: 0.7 })).toEqual({ reverb: 0.7 });
  });

  test('is empty when nothing changed, and never includes partName', () => {
    expect(diffFields(part, { ...part })).toEqual({});
    expect(diffFields(part, { ...part, partName: 'Other' })).toEqual({});
  });

  test('compares arrays by value and copies them', () => {
    const next = { ...part, notes: [1, 2, 4] };
    const diff = diffFields(part, next);
    expect(diff).toEqual({ notes: [1, 2, 4] });
    expect(diff.notes).not.toBe(next.notes);
    expect(diffFields(part, { ...part, notes: [1, 2, 3] })).toEqual({});
  });

  test('treats a rest (undefined) as null, as it is on the wire', () => {
    expect(diffFields({ notes: [1, undefined] }, { notes: [1, null] })).toEqual({});
  });

  test('a missing previous part yields every field except partName', () => {
    expect(diffFields(undefined, { partName: 'X', a: 1 })).toEqual({ a: 1 });
  });
});
