import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { APP_URL, RELAY_URL } from './env';

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  // mDNS-obfuscated host candidates can't be resolved between two contexts on one machine
  browser = await chromium.launch({ args: ['--disable-features=WebRtcHideLocalIpsWithMdns'] });
});
afterAll(async () => {
  await browser?.close();
});

let roomCounter = 0;
const newRoom = () => `e2e-${Date.now()}-${roomCounter++}`;

/** Open the app as host or client in its own browser context (own storage, own WebRTC identity). */
async function open(role: 'host' | 'join', room: string): Promise<Page> {
  const context = await browser.newContext();
  contexts.push(context);
  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`[${role} pageerror]`, e.message));
  if (process.env.E2E_LOG) page.on('console', (m) => console.log(`[${role}] ${m.type()}: ${m.text().slice(0, 300)}`));
  await page.goto(`${APP_URL}/?${role}&room=${room}&relay=${encodeURIComponent(RELAY_URL)}&debug`);
  await page.waitForFunction(() => (window as any).__store);
  return page;
}

const peers = (p: Page) => p.evaluate(() => (window as any).__store.peers.length as number);
const instruments = (p: Page) =>
  p.evaluate(() => JSON.parse(JSON.stringify((window as any).__store.instrumentsData.instrumentsData)));

async function connected(host: Page, client: Page) {
  await expect.poll(() => peers(host), { timeout: 30_000 }).toBe(1);
  await expect.poll(() => peers(client), { timeout: 30_000 }).toBe(1);
}

describe('two real browsers over WebRTC', () => {
  test('connect, and the client receives the host state', async () => {
    const room = newRoom();
    const host = await open('host', room);
    const client = await open('join', room);
    await connected(host, client);

    await expect.poll(async () => (await instruments(client)).map((i: any) => i.id)).toEqual(
      (await instruments(host)).map((i: any) => i.id)
    );
  });
});

const playing = (p: Page) => p.evaluate(() => (window as any).__store.transport.playing as boolean);
const position = (p: Page) => p.evaluate(() => (window as any).__store.transport.position() as number);

async function pair() {
  const room = newRoom();
  const host = await open('host', room);
  const client = await open('join', room);
  await connected(host, client);
  await expect.poll(async () => (await instruments(client)).length).toBe((await instruments(host)).length);
  return { room, host, client };
}

describe('instrument sync (real transport)', () => {
  test('an edit made on the client reaches the host, and the other way round', async () => {
    const { host, client } = await pair();

    await client.evaluate(() => {
      const s = (window as any).__store;
      const i = JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData[0]));
      i.name = 'from-client';
      s.setInstrument(0, i);
    });
    await expect.poll(async () => (await instruments(host))[0].name).toBe('from-client');

    await host.evaluate(() => {
      const s = (window as any).__store;
      const i = JSON.parse(JSON.stringify(s.instrumentsData.instrumentsData[1]));
      i.name = 'from-host';
      s.setInstrument(1, i);
    });
    await expect.poll(async () => (await instruments(client))[1].name).toBe('from-host');
  });

  test('add and remove from the client propagate to the host', async () => {
    const { host, client } = await pair();
    const before = (await instruments(host)).length;
    const removedId = (await instruments(client))[0].id;

    await client.evaluate(() => (window as any).__store.removeInstrument(0));
    await expect.poll(async () => (await instruments(host)).length).toBe(before - 1);
    expect((await instruments(host)).some((i: any) => i.id === removedId)).toBe(false);

    await client.evaluate(() =>
      (window as any).__store.createInstrumentPreset((window as any).__store.getPreset('Drum'))
    );
    await expect.poll(async () => (await instruments(host)).length).toBe(before);
  });
});

describe('transport (real transport)', () => {
  test('host play/stop is mirrored on the client', async () => {
    const { host, client } = await pair();
    await host.evaluate(() => (window as any).__store.transport.toggle());
    await expect.poll(() => playing(client), { timeout: 20_000 }).toBe(true);
    expect(await playing(host)).toBe(true);

    await host.evaluate(() => (window as any).__store.transport.stop());
    await expect.poll(() => playing(client), { timeout: 20_000 }).toBe(false);
  });

  test('a client can start and stop playback through the host', async () => {
    const { host, client } = await pair();
    await client.evaluate(() => (window as any).__store.transport.toggle());
    await expect.poll(() => playing(host), { timeout: 20_000 }).toBe(true);
    await expect.poll(() => playing(client), { timeout: 20_000 }).toBe(true);

    await client.evaluate(() => (window as any).__store.transport.stop());
    await expect.poll(() => playing(host), { timeout: 20_000 }).toBe(false);
  });

  test('a client that reloads mid-song picks the playing state up again, and the playhead advances', async () => {
    const { room, host, client } = await pair();
    await host.evaluate(() => (window as any).__store.transport.toggle());
    await expect.poll(() => playing(client), { timeout: 20_000 }).toBe(true);

    await client.reload();
    await client.waitForFunction(() => (window as any).__store);
    await expect.poll(() => playing(client), { timeout: 30_000 }).toBe(true);

    const p1 = await position(client);
    await client.waitForTimeout(1500);
    expect(await position(client)).toBeGreaterThan(p1);
  });
});
