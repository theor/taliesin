import { expect, test } from 'vitest';
import { newRoomCode, parseRoom } from './room';

test('room codes are short and use only unambiguous characters', () => {
  for (let i = 0; i < 200; i++) expect(newRoomCode()).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$/);
  expect(newRoomCode(() => 0)).toBe('AAAAAA');
});

test('parseRoom takes a share link or a bare code', () => {
  expect(parseRoom('https://taliesin.app/?join=true&room=K7P2QD')).toBe('K7P2QD');
  expect(parseRoom('  /?join&room=abc-123 ')).toBe('abc-123');
  expect(parseRoom('K7P2QD')).toBe('K7P2QD');
  expect(parseRoom('')).toBeUndefined();
  expect(parseRoom('https://example.com/')).toBeUndefined();
  expect(parseRoom('two words')).toBeUndefined();
  expect(parseRoom('<script>')).toBeUndefined();
});
