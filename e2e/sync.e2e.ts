import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { APP_URL, RELAY_URL } from './env';

let browser: Browser;
const contexts: BrowserContext[] = [];

beforeAll(async () => {
  // mDNS-obfuscated host candidates can't be resolved between two contexts on one machine
  browser = await chromium.launch({
    args: [
      '--disable-features=WebRtcHideLocalIpsWithMdns',
      '--autoplay-policy=no-user-gesture-required',
      // a fake microphone (it hears beeps, not the other page), and no permission prompt
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream'
    ]
  });
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
  if (process.env.E2E_LOG)
    page.on('console', (m) => console.log(`[${role}] ${m.type()}: ${m.text().slice(0, 300)}`));
  await page.goto(`${APP_URL}/?${role}&room=${room}&relay=${encodeURIComponent(RELAY_URL)}&debug`);
  await page.waitForFunction(() => (window as any).__store);
  return page;
}

const peers = (p: Page) => p.evaluate(() => (window as any).__store.peers.length as number);
const instruments = (p: Page) =>
  p.evaluate(() =>
    JSON.parse(JSON.stringify((window as any).__store.instrumentsData.instrumentsData))
  );

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

    await expect
      .poll(async () => (await instruments(client)).map((i: any) => i.id))
      .toEqual((await instruments(host)).map((i: any) => i.id));
  });
});

const playing = (p: Page) => p.evaluate(() => (window as any).__store.transport.playing as boolean);
const position = (p: Page) =>
  p.evaluate(() => (window as any).__store.transport.position() as number);

async function pair() {
  const room = newRoom();
  const host = await open('host', room);
  const client = await open('join', room);
  await connected(host, client);
  // wait for the host's state itself: the client already has its own, differently-id'd, presets
  const ids = async (p: Page) => (await instruments(p)).map((i: any) => i.id);
  await expect.poll(() => ids(client)).toEqual(await ids(host));
  return { room, host, client };
}

// The page's own controls, driven like a user would. (Remove / randomize live in the "Effects" view.)
const showEffects = (p: Page) =>
  p.locator('header.instrument-header [data-testid="switch-control"]').click();
const instrumentVolume = (p: Page, index: number) =>
  p.evaluate(
    (i) => (window as any).__store.instrumentsData.instrumentsData[i].volume as number,
    index
  );
const masterVolume = (p: Page) =>
  p.evaluate(() => (window as any).__store.instrumentsData.volume as number);
const partField = (p: Page, partName: string, field: string) =>
  p.evaluate(
    ([name, f]) => {
      const part = (window as any).__store.instrumentsData.instrumentsData[0].parts.find(
        (x: any) => x.partName === name
      );
      return JSON.parse(JSON.stringify(part[f]));
    },
    [partName, field]
  );
/** Type a value into a tweakpane control's number field, as a user would. */
async function setControl(p: Page, label: string, value: string) {
  const input = p.locator(`.tp-lblv:has(.tp-lblv_l:text-is("${label}")) input.tp-txtv_i`).first();
  await input.fill(value);
  await input.press('Enter');
}

describe('instrument sync (real transport, real controls)', () => {
  test('a rename dispatched on the client reaches the host, and the other way round', async () => {
    const { host, client } = await pair();
    const rename = (p: Page, index: number, name: string) =>
      p.evaluate(
        ([i, n]) => {
          const s = (window as any).__store;
          s.dispatch({
            type: 'setInstrumentFields',
            instrumentId: s.instrumentsData.instrumentsData[i as number].id,
            fields: { name: n }
          });
        },
        [index, name]
      );

    await rename(client, 0, 'from-client');
    await expect.poll(async () => (await instruments(host))[0].name).toBe('from-client');
    await rename(host, 1, 'from-host');
    await expect.poll(async () => (await instruments(client))[1].name).toBe('from-host');
  });

  test('the remove button on the client removes the instrument on the host', async () => {
    const { host, client } = await pair();
    const before = (await instruments(host)).length;
    const removedId = (await instruments(client))[0].id;

    await showEffects(client);
    await client.getByRole('button', { name: 'Remove instrument' }).click();

    await expect.poll(async () => (await instruments(host)).length).toBe(before - 1);
    expect((await instruments(host)).some((i: any) => i.id === removedId)).toBe(false);
    expect((await instruments(client)).some((i: any) => i.id === removedId)).toBe(false);
  });

  test('adding a Drum from the Add menu shows up on the other peer, at the end', async () => {
    const { host, client } = await pair();
    const before = (await instruments(host)).length;

    await client.locator('[title="Add"]:visible').click();
    // the modal's slide-in transition never settles under headless Chromium, so coordinate-based clicks
    // miss it; dispatching the click event still runs the real handler
    await client.getByRole('button', { name: 'Drum' }).dispatchEvent('click');

    await expect.poll(async () => (await instruments(host)).length).toBe(before + 1);
    const last = (await instruments(host)).at(-1);
    expect(last.instrumentName).toBe('Drum');
    expect((await instruments(client)).at(-1).id).toBe(last.id);
  });

  test('moving an effects slider on the client changes the part on the host', async () => {
    const { host, client } = await pair();
    expect(await partField(host, 'PartEffects', 'reverb')).toBe(0.2); // precondition

    await showEffects(client);
    await setControl(client, 'Reverb', '0.7');

    // tweakpane snaps to its step (0.05), which leaves float noise like 0.7000000000000001
    await expect
      .poll(() => partField(host, 'PartEffects', 'reverb'), { timeout: 20_000 })
      .toBeCloseTo(0.7, 5);
    expect(await partField(client, 'PartEffects', 'reverb')).toBeCloseTo(0.7, 5);
  });

  test('the dice button gives both peers the same random notes', async () => {
    const { host, client } = await pair();
    const initial = await partField(host, 'MonoSequence', 'notes');

    await showEffects(client);
    await client.getByRole('button', { name: 'Randomize' }).click();

    await expect
      .poll(async () => JSON.stringify(await partField(host, 'MonoSequence', 'notes')), {
        timeout: 20_000
      })
      .not.toBe(JSON.stringify(initial));
    expect(await partField(host, 'MonoSequence', 'notes')).toEqual(
      await partField(client, 'MonoSequence', 'notes')
    );
  });

  test('the Mixer sliders reach the other peer', async () => {
    const { host, client } = await pair();
    expect(await masterVolume(host)).toBe(0.8); // precondition
    expect(await instrumentVolume(host, 0)).toBe(1);

    await client.locator('[title="Mixer"]:visible').click();
    await setControl(client, 'Master Volume', '0.3');
    await setControl(client, 'Volume', '0.4'); // the first instrument's

    // tweakpane rounds to its step, so compare with a tolerance
    await expect.poll(() => masterVolume(host), { timeout: 20_000 }).toBeCloseTo(0.3, 5);
    await expect.poll(() => instrumentVolume(host, 0), { timeout: 20_000 }).toBeCloseTo(0.4, 5);
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

// --- start page and saved song ----------------------------------------------------------------------------
describe('start page and persistence', () => {
  test('Start a jam opens a hosted room, and the host edits survive a reload', async () => {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    await page.goto(`${APP_URL}/home`);
    await page.getByRole('button', { name: 'Start a jam' }).click();
    await page.waitForURL(/\?host&room=[A-Z2-9]{6}/);
    const url = new URL(page.url());
    url.searchParams.set('debug', '');
    await page.goto(url.toString());
    await page.waitForFunction(() => (window as any).__store);

    const before = (await instruments(page))[0].id;
    await page.evaluate(() => {
      const s = (window as any).__store;
      s.dispatch({ type: 'setInstrumentFields', instrumentId: s.instrumentsData.instrumentsData[0].id, fields: { name: 'kept' } });
      s.saveNow();
    });
    await page.reload();
    await page.waitForFunction(() => (window as any).__store);
    const after = (await instruments(page))[0];
    expect(after.name).toBe('kept');
    expect(after.id).toBe(before);
  });
});

// --- every peer plays the song itself, on the host's clock -----------------------------------------------
/** The scheduler's cycle and the wall clock at the same instant (both pages share this machine's clock). */
const sample = (p: Page) =>
  p.evaluate(() => {
    const s = (window as any).__strudel;
    return {
      wall: performance.timeOrigin + performance.now(),
      cycle: s.now() as number,
      cps: s.cps as number,
      started: s.repls.scheduler.started as boolean
    };
  });
/** Offset in seconds between two peers' schedulers, compared at the same wall-clock moment. */
async function skewSeconds(a: Page, b: Page) {
  const skew = await skewRaw(a, b);
  if (process.env.E2E_LOG) console.log('skew(s)', skew.toFixed(3));
  return skew;
}
async function skewRaw(a: Page, b: Page) {
  const [x, y] = [await sample(a), await sample(b)];
  const atY = x.cycle + ((y.wall - x.wall) / 1000) * x.cps; // x's cycle extrapolated to y's instant
  return (atY - y.cycle) / x.cps;
}

describe('synchronised playback (real audio engine)', () => {
  test('client and host schedulers run on the same clock, also for a client that joins mid-song', async () => {
    const { host, client } = await pair();
    await host.evaluate(() => (window as any).__store.transport.toggle());
    // preconditions: both really started, and their position is advancing
    await expect
      .poll(async () => (await sample(client)).started && (await sample(host)).started, {
        timeout: 30_000
      })
      .toBe(true);
    const c1 = (await sample(client)).cycle;
    await client.waitForTimeout(1000);
    expect((await sample(client)).cycle).toBeGreaterThan(c1);

    await client.waitForTimeout(1500); // let the post-start correction settle
    expect(Math.abs(await skewSeconds(host, client))).toBeLessThan(0.1);
    await client.waitForTimeout(5000); // across a host resync
    expect(Math.abs(await skewSeconds(host, client))).toBeLessThan(0.1);

    // a second client joins mid-song
    const late = await client.context().newPage();
    await late.goto(client.url());
    await late.waitForFunction(() => (window as any).__store);
    await expect.poll(async () => (await sample(late)).started, { timeout: 30_000 }).toBe(true);
    await late.waitForTimeout(1500);
    expect(Math.abs(await skewSeconds(host, late))).toBeLessThan(0.1);

    // stop stops everyone
    await host.evaluate(() => (window as any).__store.transport.stop());
    await expect.poll(async () => (await sample(client)).started, { timeout: 20_000 }).toBe(false);
    expect((await sample(late)).started).toBe(false);
  });
});

describe('acoustic calibration (real Web Audio)', () => {
  test('a probe played through the real audio graph is recorded by the real worklet, and found', async () => {
    const { host } = await pair();
    const result = await host.evaluate(async () => {
      const w = window as any;
      const ctx: AudioContext = w.__strudel.audioContext();
      await ctx.resume();
      // loop the speaker output back into the "microphone"
      const loop = ctx.createMediaStreamDestination();
      const ac = new w.__acoustics.WebAcoustics(ctx, {
        output: loop,
        getStream: async () => loop.stream
      });
      const rec = await ac.record();
      await new Promise((r) => setTimeout(r, 300)); // let the capture settle
      const t0 = ac.now();
      ac.play('up');
      await new Promise((r) => setTimeout(r, 700));
      const { samples, start } = rec.stop();
      const found = w.__acoustics.findChirp(samples, w.__acoustics.makeChirp(ctx.sampleRate, 'up'));
      return found && { delay: start + found.index / ctx.sampleRate - t0, score: found.score };
    });
    expect(result).toBeTruthy();
    expect(result!.score).toBeGreaterThan(0.5);
    // one trip through the audio graph: a few render quanta, nowhere near a second
    expect(result!.delay).toBeGreaterThanOrEqual(0);
    expect(result!.delay).toBeLessThan(0.25);
  });

  test('the Calibrate button runs the whole protocol; a microphone that hears nothing is reported, not applied', async () => {
    const { host, client } = await pair();
    await host.getByRole('button', { name: 'Calibrate' }).click();
    const note = () => host.getByTestId('calibration-note').textContent({ timeout: 1000 });
    await expect.poll(note, { timeout: 10_000 }).toContain('Listening');
    await expect.poll(note, { timeout: 30_000 }).toContain('could not hear');
    expect(
      await client.evaluate(() => (window as any).__store.transport.offset as number | undefined)
    ).toBeUndefined();
  });
});

// --- real pointer input on the sequencer, through the command layer -------------------------------------
const cellBox = async (p: Page, step: number, track: number) => {
  const cell = p.locator(`[data-x="${step}"][data-y="${track}"]`);
  await cell.scrollIntoViewIfNeeded(); // raw mouse coordinates must be on screen
  const box = await cell.boundingBox();
  if (!box) throw new Error(`cell ${step},${track} not visible`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};
const pianoNotes = (p: Page) =>
  p.evaluate(() => {
    const inst = (window as any).__store.instrumentsData.instrumentsData[0];
    const part = inst.parts.find((x: any) => x.partName === 'MonoSequence');
    return JSON.parse(JSON.stringify(part.notes)) as (number | null)[];
  });
const cellClass = (p: Page, step: number, track: number) =>
  p.locator(`[data-x="${step}"][data-y="${track}"] > span`).getAttribute('class');

describe('sequencer gestures (real pointer, real network)', () => {
  test('a tap on the client sets the note on the host, and the host re-renders the cell', async () => {
    const { host, client } = await pair();
    // precondition, so the test cannot pass vacuously: step 2 holds note 3, and track 6 is off there
    expect((await pianoNotes(host))[2]).toBe(3);
    expect(await cellClass(host, 2, 6)).toContain('preset-outlined');

    const at = await cellBox(client, 2, 6);
    await client.mouse.move(at.x, at.y);
    await client.mouse.down();
    await client.mouse.up();

    await expect.poll(async () => (await pianoNotes(host))[2], { timeout: 20_000 }).toBe(6);
    expect((await pianoNotes(client))[2]).toBe(6);
    // the cell lit up on both screens, not just in the data
    await expect.poll(() => cellClass(host, 2, 6)).toContain('preset-filled');
    expect(await cellClass(client, 2, 6)).toContain('preset-filled');
  });

  test('dragging along a row on the host reaches the client as one stroke', async () => {
    const { host, client } = await pair();
    expect((await pianoNotes(client)).slice(0, 4)).toEqual([1, 2, 3, null]); // precondition
    const from = await cellBox(host, 0, 5);
    const to = await cellBox(host, 3, 5);
    await host.mouse.move(from.x, from.y);
    await host.mouse.down();
    await host.mouse.move(to.x, to.y, { steps: 6 });
    await host.mouse.up();

    await expect
      .poll(async () => (await pianoNotes(client)).slice(0, 4), { timeout: 20_000 })
      .toEqual([5, 5, 5, 5]);
  });
});
