/** One ICE server as the Cloudflare/TURN endpoints return it. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

function isIceServer(x: any): x is IceServer {
  const urls = Array.isArray(x?.urls) ? x.urls : [x?.urls];
  return urls.length > 0 && urls.every((u: unknown) => typeof u === 'string' && /^(stun|turn)s?:/.test(u));
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
    return Array.isArray(body?.iceServers) ? body.iceServers.filter(isIceServer) : [];
  } catch {
    return [];
  }
}
