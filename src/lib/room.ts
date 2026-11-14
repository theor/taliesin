// no 0/O/1/I/L: codes get read aloud and typed on phones
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** A short, speakable room code (31^6 is plenty for a signalling room name). */
export function newRoomCode(random: () => number = Math.random, length = 6): string {
  return Array.from({ length }, () => ALPHABET[Math.floor(random() * ALPHABET.length)]).join('');
}

/**
 * The room named by what a friend pasted: a share link (`…/?join&room=ABC123`) or just the code.
 * Returns undefined when it doesn't look like either.
 */
export function parseRoom(input: string): string | undefined {
  const text = input.trim();
  if (!text) return undefined;
  let room: string | null = text;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text) || text.includes('?')) {
    try {
      room = new URL(text, 'http://x').searchParams.get('room');
    } catch {
      return undefined;
    }
  }
  room = room?.trim() ?? '';
  return /^[\w-]{3,64}$/.test(room) ? room : undefined;
}
