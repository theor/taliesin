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
}

const tracked: Tracked[] = [];
let installed = false;

export function installRtcDebug() {
  if (installed || typeof RTCPeerConnection === 'undefined') return;
  installed = true;
  const Native = RTCPeerConnection;
  window.RTCPeerConnection = class extends Native {
    constructor(config?: RTCConfiguration) {
      super(config);
      const entry: Tracked = {
        pc: this,
        candidates: {},
        pairs: '',
        turn: (config?.iceServers ?? []).some((s) =>
          [s.urls].flat().some((u) => /^turns?:/.test(u))
        )
      };
      tracked.push(entry);
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
  return tracked.map(({ pc, candidates, turn, pairs }, i) => {
    const cands = Object.entries(candidates)
      .map(([t, n]) => `${t}${n}`)
      .join(',');
    return `pc${i + 1} sig=${pc.signalingState} ice=${pc.iceConnectionState} conn=${pc.connectionState} cand=${cands || 'none'} remote=${remoteCandidates(pc)} pairs=${pairs || '-'} turn=${turn ? 'yes' : 'NO'}`;
  });
}
