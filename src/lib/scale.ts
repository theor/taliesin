const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MODES: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10]
};

/** The note name of a scale degree (0 = the root; 7 = the root an octave up, marked with ↑). */
export function degreeName(key: string, mode: string, degree: number): string {
  const intervals = MODES[mode];
  const root = CHROMATIC.indexOf(key.toUpperCase());
  if (!intervals || root < 0 || !Number.isInteger(degree) || degree < 0) return `${degree}`;
  const octave = Math.floor(degree / 7);
  const name = CHROMATIC[(root + intervals[degree % 7]) % 12];
  return octave > 0 ? `${name}${'↑'.repeat(octave)}` : name;
}
