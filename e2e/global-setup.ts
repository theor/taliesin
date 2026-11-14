import { spawn, type ChildProcess } from 'node:child_process';
import { startRelay } from './relay.mjs';
import { APP_PORT, APP_URL, RELAY_PORT } from './env';

/** Starts the local Nostr relay and a plain-http dev server (E2E=1 disables mkcert) for the whole run. */
export default async function setup() {
  const relay = await startRelay(RELAY_PORT);

  const vite: ChildProcess = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'dev', '--port', String(APP_PORT), '--strictPort'],
    { env: { ...process.env, E2E: '1' }, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let log = '';
  vite.stdout?.on('data', (d) => (log += d));
  vite.stderr?.on('data', (d) => (log += d));

  const deadline = Date.now() + 90_000;
  for (;;) {
    if (vite.exitCode !== null) throw new Error(`vite exited early:\n${log}`);
    try {
      const res = await fetch(APP_URL);
      if (res.ok) break;
    } catch {
      // not up yet
    }
    if (Date.now() > deadline) throw new Error(`vite did not start in time:\n${log}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  return async () => {
    vite.kill();
    await relay.close();
  };
}
