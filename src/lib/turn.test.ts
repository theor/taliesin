import { describe, expect, test, vi } from 'vitest';
import { fetchIceServers } from './turn';
import { handle } from '../../worker/turn';

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' }, ...init });

describe('fetchIceServers', () => {
  const turn = { urls: ['turn:t.example:3478'], username: 'u', credential: 'c' };

  test('returns the servers the endpoint hands out', async () => {
    const f = vi.fn(async () => json({ iceServers: [{ urls: ['stun:s.example'] }, turn] }));
    expect(await fetchIceServers('https://x/creds', f as any)).toEqual([{ urls: ['stun:s.example'] }, turn]);
  });
  test('does nothing without an endpoint', async () => {
    const f = vi.fn();
    expect(await fetchIceServers(undefined, f as any)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
  test('falls back to no relay on errors, bad bodies and timeouts', async () => {
    expect(await fetchIceServers('u', (async () => json({}, { status: 500 })) as any)).toEqual([]);
    expect(await fetchIceServers('u', (async () => { throw new Error('offline'); }) as any)).toEqual([]);
    expect(await fetchIceServers('u', (async () => json({ iceServers: 'nope' })) as any)).toEqual([]);
    const hang = (_: any, o: any) => new Promise((_, rej) => o.signal.addEventListener('abort', () => rej(new Error('timeout'))));
    expect(await fetchIceServers('u', hang as any, 20)).toEqual([]);
  });
  test('drops entries that are not ICE servers (it is network input)', async () => {
    const f = async () => json({ iceServers: [turn, { urls: 'http://evil' }, { urls: 5 }, null, {}] });
    expect(await fetchIceServers('u', f as any)).toEqual([turn]);
  });
});

describe('credentials worker', () => {
  const env = { TURN_KEY_ID: 'key1', TURN_API_TOKEN: 'secret', ALLOWED_ORIGINS: 'https://theor.github.io' };
  const req = (origin: string, method = 'GET') =>
    new Request('https://w.example/', { method, headers: { Origin: origin } });

  test('asks Cloudflare with the secret token and returns only the iceServers', async () => {
    const upstream = vi.fn(async () => json({ iceServers: [{ urls: ['turn:a'], username: 'u', credential: 'c' }], extra: 1 }));
    const res = await handle(req('https://theor.github.io'), env, upstream as any);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://theor.github.io');
    expect(await res.json()).toEqual({ iceServers: [{ urls: ['turn:a'], username: 'u', credential: 'c' }] });
    const [url, init] = upstream.mock.calls[0] as any;
    expect(url).toContain('/turn/keys/key1/credentials/generate-ice-servers');
    expect(init.headers.Authorization).toBe('Bearer secret');
    expect(JSON.parse(init.body).ttl).toBeGreaterThan(3600);
  });
  test('refuses other origins without calling Cloudflare', async () => {
    const upstream = vi.fn();
    const res = await handle(req('https://evil.example'), env, upstream as any);
    expect(res.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });
  test('answers preflight, allows localhost, reports upstream failure', async () => {
    expect((await handle(req('https://theor.github.io', 'OPTIONS'), env, vi.fn() as any)).status).toBe(204);
    const bad = vi.fn(async () => new Response('no', { status: 401 }));
    const failed = await handle(req('http://localhost:5173'), env, bad as any);
    expect(failed.status).toBe(502);
    expect(await failed.text()).toContain('401');
  });
  test('says so when the secrets are missing, without calling Cloudflare', async () => {
    const upstream = vi.fn();
    const res = await handle(req('https://theor.github.io'), { ...env, TURN_API_TOKEN: '' }, upstream as any);
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('TURN_API_TOKEN');
    expect(upstream).not.toHaveBeenCalled();
  });
});
