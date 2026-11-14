import type { Json } from './commands';

/**
 * Top-level fields of `next` that differ from `prev` (compared as JSON), as plain JSON copies.
 * Used to turn "the user edited a copy of this part" into a minimal `setPartFields` command.
 */
export function diffFields(prev: object | undefined, next: object): { [key: string]: Json } {
  const before = (prev ?? {}) as Record<string, unknown>;
  const out: { [key: string]: Json } = {};
  for (const [key, value] of Object.entries(next as Record<string, unknown>)) {
    if (key === 'partName') continue;
    if (JSON.stringify(value ?? null) !== JSON.stringify(before[key] ?? null)) {
      out[key] = JSON.parse(JSON.stringify(value ?? null));
    }
  }
  return out;
}
