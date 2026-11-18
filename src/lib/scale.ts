const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
/** The keys a song can be in. */
export const KEYS: readonly string[] = CHROMATIC;
const MODES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10]
};
/** Scale degrees in an octave (degree 7 is the root an octave up). */
export const DEGREES_PER_OCTAVE = 7;
/** The modes a song can be in (each also a Strudel scale name). */
export const MODE_NAMES: readonly string[] = Object.keys(MODES);

/** The note name of a scale degree (0 = the root; 7 = the root an octave up, marked with ↑). */
export function degreeName(key: string, mode: string, degree: number): string {
  const intervals = MODES[mode];
  const root = CHROMATIC.indexOf(key.toUpperCase());
  if (!intervals || root < 0 || !Number.isInteger(degree) || degree < 0) return `${degree}`;
  const octave = Math.floor(degree / 7);
  const name = CHROMATIC[(root + intervals[degree % 7]) % 12];
  return octave > 0 ? `${name}${'↑'.repeat(octave)}` : name;
}

/**
 * The chord symbol suffix of the triad built on a scale degree by stacking thirds inside the scale
 * ('' major, 'm' minor, 'dim', 'aug'). Unknown modes and degrees give 'm'.
 */
export function triadQuality(mode: string, degree: number): string {
  const intervals = MODES[mode];
  if (!intervals || !Number.isInteger(degree) || degree < 0) return 'm';
  const at = (d: number) => intervals[d % 7];
  const third = (at(degree + 2) - at(degree) + 12) % 12;
  const fifth = (at(degree + 4) - at(degree) + 12) % 12;
  if (third === 4 && fifth === 7) return '';
  if (third === 3 && fifth === 7) return 'm';
  if (third === 3 && fifth === 6) return 'dim';
  if (third === 4 && fifth === 8) return 'aug';
  return 'm';
}
