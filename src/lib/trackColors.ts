/**
 * Each instrument's colour, carried through its tile, steps and meters. Derived on each device from the
 * instrument's position in the song: it is not song state, so nothing is synced or validated.
 */
export const TRACK_COLORS = [
  '#FF8A3D',
  '#2DD4BF',
  '#FACC15',
  '#A78BFA',
  '#F472B6',
  '#60A5FA'
] as const;

export function trackColor(index: number): string {
  const n = TRACK_COLORS.length;
  return TRACK_COLORS[((index % n) + n) % n];
}

/** What kind of instrument it is, for people: "Drum" -> "Drums", "PianoScale" -> "Synth". */
export function trackKind(instrumentName: string): string {
  return (
    ({ Drum: 'Drums', PianoScale: 'Synth' } as Record<string, string>)[instrumentName] ??
    instrumentName
  );
}

/** Two letters for the instrument's tile: "Drums" -> "DR", "Lead synth" -> "LS". */
export function trackInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
