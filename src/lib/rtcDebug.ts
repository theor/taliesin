/**
 * `?debug` diagnostics for peer-to-peer failures (phones can't open the console easily): wraps
 * RTCPeerConnection to remember every connection Trystero makes, and summarises how each one is doing.
 * Must run before the room is joined.
 */
interface Tracked {
  pc: RTCPeerConnection;
  candidates: Record<string, number>;
  turn: boolean;
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

/** One line per connection: signalling, ICE and connection state, candidates found, TURN configured. */
export function rtcSummary(): string[] {
  return tracked.map(({ pc, candidates, turn }, i) => {
    const cands = Object.entries(candidates)
      .map(([t, n]) => `${t}${n}`)
      .join(',');
    return `pc${i + 1} sig=${pc.signalingState} ice=${pc.iceConnectionState} conn=${pc.connectionState} cand=${cands || 'none'} turn=${turn ? 'yes' : 'NO'}`;
  });
}
