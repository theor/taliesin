/**
 * `?debug` diagnostics for peer-to-peer failures (phones can't open the console easily): wraps
 * RTCPeerConnection to remember every connection Trystero makes, and summarises how each one is doing.
 * Must run before the room is joined.
 */
interface Tracked {
  pc: RTCPeerConnection;
  candidates: Record<string, number>;
  turn: boolean;
  /** Candidate-pair states from getStats, refreshed by `refreshRtcStats`. */
  pairs: string;
  /** State changes as `ice:checking@41.2` (seconds since page load), to see when a connection died. */
  timeline: string[];
}

interface RelayStats {
  url: string;
  sent: number;
  maxBytes: number;
  recv: number;
  ok: number;
  rejected: Record<string, number>;
  notices: number;
}

const tracked: Tracked[] = [];
const relays: RelayStats[] = [];
const own = new WeakMap<WebSocket, RelayStats>();
let installed = false;

/** Count what every signalling WebSocket sends, receives and has rejected (relays fail silently otherwise). */
function trackSockets() {
  const Native = WebSocket;
  window.WebSocket = class extends Native {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols);
      const name = String(url)
        .replace(/^wss?:\/\//, '')
        .replace(/\/$/, '');
      // a reconnecting relay keeps adding to the same counters
      let stats = relays.find((r) => r.url === name);
      if (!stats) {
        stats = { url: name, sent: 0, maxBytes: 0, recv: 0, ok: 0, rejected: {}, notices: 0 };
        relays.push(stats);
      }
      own.set(this, stats);
      this.addEventListener('message', (e) => {
        if (typeof e.data !== 'string') return;
        try {
          const [type, , accepted, reason] = JSON.parse(e.data);
          if (type === 'EVENT') stats.recv++;
          else if (type === 'NOTICE') stats.notices++;
          else if (type === 'OK') {
            if (accepted) stats.ok++;
            else {
              const why = String(reason ?? '?').slice(0, 40);
              stats.rejected[why] = (stats.rejected[why] ?? 0) + 1;
            }
          }
        } catch {
          // not nostr
        }
      });
    }
    override send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
      if (typeof data === 'string' && data.startsWith('["EVENT"')) {
        const stats = own.get(this);
        if (stats) {
          stats.sent++;
          stats.maxBytes = Math.max(stats.maxBytes, data.length);
        }
      }
      super.send(data);
    }
  } as typeof WebSocket;
}

/** One line per signalling relay: events sent / accepted / rejected, events received, biggest event. */
export function relaySummary(): string[] {
  return relays.map((r) => {
    const rej = Object.entries(r.rejected)
      .map(([why, n]) => `${n}x"${why}"`)
      .join(' ');
    return `relay ${r.url} sent=${r.sent} ok=${r.ok} rejected=${rej || 0} recv=${r.recv} max=${r.maxBytes}B`;
  });
}

export function installRtcDebug() {
  if (installed || typeof RTCPeerConnection === 'undefined') return;
  installed = true;
  trackSockets();
  const Native = RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    constructor(config?: RTCConfiguration) {
      super(config);
      const entry: Tracked = {
        pc: this,
        candidates: {},
        pairs: '',
        timeline: [],
        turn: (config?.iceServers ?? []).some((s) =>
          [s.urls].flat().some((u) => /^turns?:/.test(u))
        )
      };
      tracked.push(entry);
      const mark = (what: string) =>
        entry.timeline.push(`${what}@${(performance.now() / 1000).toFixed(1)}`);
      this.addEventListener('signalingstatechange', () => mark(`sig:${this.signalingState}`));
      this.addEventListener('iceconnectionstatechange', () =>
        mark(`ice:${this.iceConnectionState}`)
      );
      this.addEventListener('connectionstatechange', () => mark(`conn:${this.connectionState}`));
      this.addEventListener('icecandidate', (e) => {
        const type = e.candidate?.type ?? (e.candidate?.candidate.split(' ')[7] || '?');
        if (e.candidate) entry.candidates[type] = (entry.candidates[type] ?? 0) + 1;
      });
    }
  } as typeof RTCPeerConnection;
}

/** Candidate types the other side sent us, from the remote description. */
function remoteCandidates(pc: RTCPeerConnection): string {
  const counts: Record<string, number> = {};
  for (const m of (pc.remoteDescription?.sdp ?? '').matchAll(/^a=candidate:.* typ (\w+)/gm))
    counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  const out = Object.entries(counts).map(([t, n]) => `${t}${n}`);
  return pc.remoteDescription ? out.join(',') || 'none' : '-';
}

/** Re-read candidate-pair states (async, so call it periodically and let `rtcSummary` show the result). */
export async function refreshRtcStats() {
  await Promise.all(
    tracked.map(async (entry) => {
      try {
        const states: Record<string, number> = {};
        let selected = '';
        (await entry.pc.getStats()).forEach((r) => {
          if (r.type !== 'candidate-pair') return;
          states[r.state] = (states[r.state] ?? 0) + 1;
          if (r.nominated && r.state === 'succeeded') selected = ' used';
        });
        entry.pairs =
          Object.entries(states)
            .map(([t, n]) => `${t}${n}`)
            .join(',') + selected;
      } catch {
        // closed connection
      }
    })
  );
}

/** One line per connection: signalling, ICE and connection state, candidates found, TURN configured. */
export function rtcSummary(): string[] {
  return tracked.map(({ pc, candidates, turn, pairs, timeline }, i) => {
    const cands = Object.entries(candidates)
      .map(([t, n]) => `${t}${n}`)
      .join(',');
    return `pc${i + 1} sig=${pc.signalingState} ice=${pc.iceConnectionState} conn=${pc.connectionState} cand=${cands || 'none'} remote=${remoteCandidates(pc)} pairs=${pairs || '-'} turn=${turn ? 'yes' : 'NO'} t=[${timeline.slice(-6).join(' ')}]`;
  });
}
