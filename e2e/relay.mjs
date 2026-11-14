// Minimal in-memory Nostr relay for e2e tests.
// Trystero's nostr strategy only needs: EVENT (publish), REQ with {kinds, since, '#x'} filters, CLOSE.
// Its events are ephemeral (kinds 20000+), so nothing is stored; events are fanned out to live subscriptions.
import { WebSocketServer } from 'ws';

function matches(filter, event) {
  if (filter.kinds && !filter.kinds.includes(event.kind)) return false;
  if (filter.since && event.created_at < filter.since) return false;
  if (filter.until && event.created_at > filter.until) return false;
  if (filter.ids && !filter.ids.includes(event.id)) return false;
  if (filter.authors && !filter.authors.includes(event.pubkey)) return false;
  for (const [key, values] of Object.entries(filter)) {
    if (!key.startsWith('#')) continue;
    const name = key.slice(1);
    const hit = event.tags.some((t) => t[0] === name && values.includes(t[1]));
    if (!hit) return false;
  }
  return true;
}

/** @returns {Promise<{ url: string, close: () => Promise<void> }>} */
export function startRelay(port) {
  const wss = new WebSocketServer({ port });
  /** @type {Map<import('ws').WebSocket, Map<string, object[]>>} */
  const subs = new Map();

  wss.on('connection', (ws) => {
    subs.set(ws, new Map());
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const [type, a, ...rest] = msg;
      if (type === 'REQ') {
        subs.get(ws).set(a, rest);
        ws.send(JSON.stringify(['EOSE', a]));
      } else if (type === 'CLOSE') {
        subs.get(ws).delete(a);
      } else if (type === 'EVENT') {
        ws.send(JSON.stringify(['OK', a.id, true, '']));
        for (const [client, clientSubs] of subs) {
          if (client.readyState !== client.OPEN) continue;
          for (const [subId, filters] of clientSubs) {
            if (filters.some((f) => matches(f, a))) client.send(JSON.stringify(['EVENT', subId, a]));
          }
        }
      }
    });
    ws.on('close', () => subs.delete(ws));
  });

  return new Promise((resolve, reject) => {
    wss.on('error', reject);
    wss.on('listening', () =>
      resolve({
        url: `ws://localhost:${port}`,
        close: () =>
          new Promise((res) => {
            for (const c of wss.clients) c.terminate();
            wss.close(() => res());
          })
      })
    );
  });
}
