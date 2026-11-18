/** One ICE server as the Cloudflare/TURN endpoints return it. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

function isIceServer(x: any): x is IceServer {
  const urls = Array.isArray(x?.urls) ? x.urls : [x?.urls];
  return (
    urls.length > 0 &&
    urls.every((u: unknown) => typeof u === 'string' && /^(stun|turn)s?:/.test(u))
  );
}

/**
 * Keep just what a connection needs: one STUN address, one UDP TURN address and one TLS (port 443 when
 * offered) TURN address for networks that only let HTTPS through. Providers list many ports/transports
 * (Cloudflare: 6 TURN URLs), and every one adds relay candidates, so candidate pairs and the time ICE needs
 * multiply. Trystero gives up on a connection that is not up within ~5 s.
 */
export function trimIceServers(servers: IceServer[]): IceServer[] {
  const trimmed: IceServer[] = [];
  for (const server of servers) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    const stun = urls.find((u) => u.startsWith('stun:'));
    const turn =
      urls.find((u) => /^turn:.*transport=udp/.test(u)) ?? urls.find((u) => u.startsWith('turn:'));
    const turns =
      urls.find((u) => /^turns:[^?]*:443(\?|$)/.test(u)) ??
      urls.find((u) => u.startsWith('turns:'));
    const kept = [stun, turn, turns].filter((u): u is string => !!u);
    if (kept.length) trimmed.push({ ...server, urls: kept });
  }
  return trimmed;
}

/**
 * Ask a credentials endpoint (see worker/turn.ts) for TURN servers. Never throws and never waits long:
 * on any failure the app simply runs without a relay, as it did before.
 */
export async function fetchIceServers(
  endpoint: string | undefined | null,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<IceServer[]> {
  if (!endpoint) return [];
  try {
    const res = await fetchImpl(endpoint, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.iceServers)
      ? trimIceServers(body.iceServers.filter(isIceServer))
      : [];
  } catch {
    return [];
  }
}
