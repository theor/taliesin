/**
 * Euclidean rhythms: `pulses` onsets spread as evenly as possible over `steps`, then shifted
 * `rotation` steps later. (3, 8) is the tresillo "x..x..x.".
 */
export function euclid(pulses: number, steps: number, rotation = 0): boolean[] {
  if (!Number.isInteger(steps) || steps <= 0) return [];
  const p = Math.max(0, Math.min(steps, Math.floor(pulses)));
  const base = Array.from({ length: steps }, (_, i) => (i * p) % steps < p);
  const r = ((Math.floor(rotation) % steps) + steps) % steps;
  return base.map((_, i) => base[(i - r + steps) % steps]);
}

/** The pulses and rotation that make exactly these cells, or undefined if they are not Euclidean. */
export function analyse(cells: boolean[]): { pulses: number; rotation: number } | undefined {
  const steps = cells.length;
  if (steps === 0) return undefined;
  const pulses = cells.filter(Boolean).length;
  for (let rotation = 0; rotation < steps; rotation++) {
    const candidate = euclid(pulses, steps, rotation);
    if (candidate.every((on, i) => on === cells[i])) return { pulses, rotation };
  }
  return undefined;
}

export interface EuclidParams {
  pulses: number;
  rotation: number;
  /** The cells are not a Euclidean pattern (hand-edited, or edited by someone else). */
  custom: boolean;
}

/**
 * The pulses and rotation to show for some cells. `want` is what the user last asked for on this
 * track: it is kept while the cells still match it (so a symmetric pattern keeps its rotation).
 */
export function resolveParams(
  cells: boolean[],
  want?: { pulses: number; rotation: number }
): EuclidParams {
  if (want) {
    const pattern = euclid(want.pulses, cells.length, want.rotation);
    if (pattern.every((on, i) => on === cells[i])) return { ...want, custom: false };
  }
  const found = analyse(cells);
  if (found) return { ...found, custom: false };
  return { pulses: cells.filter(Boolean).length, rotation: want?.rotation ?? 0, custom: true };
}
