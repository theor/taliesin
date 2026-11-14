/**
 * Cloudflare Worker that hands out short-lived TURN credentials (Cloudflare Realtime TURN).
 *
 * The Cloudflare API needs a secret token, so a static site cannot call it directly. This Worker holds the
 * token and returns `{ iceServers }` to the app, which fetches it once when the page loads.
 *
 * Secrets (wrangler secret put): TURN_KEY_ID, TURN_API_TOKEN.
 * Var: ALLOWED_ORIGINS, comma-separated, e.g. "https://theor.github.io".
 */
export interface Env {
  TURN_KEY_ID: string;
  TURN_API_TOKEN: string;
  ALLOWED_ORIGINS?: string;
}

/** How long a credential lives (seconds): longer than any jam session. */
const TTL_SECONDS = 4 * 60 * 60;

export async function handle(
  request: Request,
  env: Env,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  const allowed = (env.ALLOWED_ORIGINS ?? 'https://theor.github.io').split(',').map((s) => s.trim());
  const origin = request.headers.get('Origin') ?? '';
  // Only our own pages may use the (billed) relay credentials; localhost is allowed for development
  const ok = allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin);
  const cors = {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin'
  };
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (!ok) return new Response('forbidden', { status: 403, headers: cors });

  const res = await fetchImpl(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.TURN_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ttl: TTL_SECONDS })
    }
  );
  if (!res.ok) return new Response('upstream error', { status: 502, headers: cors });
  const { iceServers } = (await res.json()) as { iceServers?: unknown };
  return new Response(JSON.stringify({ iceServers: iceServers ?? [] }), {
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export default { fetch: (request: Request, env: Env) => handle(request, env) };
