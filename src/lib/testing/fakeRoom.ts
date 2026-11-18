import type { Room } from '../netRoom';

type Handler = (data: any, peerId: string) => void;
type Listener = (peerId: string) => void;

interface FakePeer {
  id: string;
  latencyMs: number;
  handlers: Map<string, Handler[]>;
  joinListeners: Listener[];
  leaveListeners: Listener[];
}

export interface FakeNetwork {
  /**
   * Create a room for a peer. Peers see each other after `settle()` (like real WebRTC, which is async).
   * `latencyMs` is this peer's one-way delay to the "internet": a message A -> B takes lat(A) + lat(B),
   * and ping(A <-> B) is twice that. Needs fake timers (vi.useFakeTimers) when non-zero.
   */
  join(peerId: string, opts?: { latencyMs?: number }): Room;
  /** Change a peer's latency; affects messages sent (and pings made) from now on, so messages can overtake each other. */
  setLatency(peerId: string, latencyMs: number): void;
  /** Announce pending joins (onPeerJoin on both sides). Call after the stores are constructed. */
  settle(): void;
  /** In queued mode, deliver all pending messages (including ones queued while flushing). */
  flush(): void;
  /**
   * Queued mode: deliver pending messages in a random interleaving across links, but in order within each
   * link (sender -> receiver), like an ordered WebRTC data channel. `max` caps how many are delivered, so
   * a test can interleave sending and partial delivery. Messages sent while delivering are included.
   */
  flushRandom(rand: () => number, max?: number): void;
  /** Pending message count (queued mode). */
  readonly pending: number;
  /** All messages ever sent, for assertions. */
  readonly log: { action: string; from: string; to: string; data: any }[];
}

/**
 * In-memory stand-in for a Trystero room hub. Implements only the surface AppStore uses:
 * makeAction, onPeerJoin, onPeerLeave, getPeers, leave.
 * `queued: true` holds messages until `flush()`, to test ordering / concurrent edits.
 * Per-peer `latencyMs` (see join) delays delivery with timers instead.
 */
export function createFakeNetwork(opts: { queued?: boolean } = {}): FakeNetwork {
  const peers = new Map<string, FakePeer>();
  const announce: string[] = [];
  const connected = new Set<string>();
  const queue: { link: string; fn: () => void }[] = [];
  const log: FakeNetwork['log'] = [];
  const queued = opts.queued ?? false;

  const oneWay = (from: string, to: string) =>
    (peers.get(from)?.latencyMs ?? 0) + (peers.get(to)?.latencyMs ?? 0);
  const deliver = (fn: () => void, delayMs: number, link: string) => {
    if (queued) queue.push({ link, fn });
    else if (delayMs > 0) setTimeout(fn, delayMs);
    else fn();
  };

  function join(peerId: string, joinOpts: { latencyMs?: number } = {}): Room {
    const me: FakePeer = {
      id: peerId,
      latencyMs: joinOpts.latencyMs ?? 0,
      handlers: new Map(),
      joinListeners: [],
      leaveListeners: []
    };
    peers.set(peerId, me);
    announce.push(peerId);

    const room = {
      makeAction(name: string) {
        const send = async (data: any, target?: string | string[] | null) => {
          const targets =
            target == null
              ? [...peers.keys()].filter((p) => p !== peerId)
              : Array.isArray(target)
                ? target
                : [target];
          for (const t of targets) {
            // JSON round-trip: the real transport serializes, so shared references would hide bugs
            const wire = data === undefined ? undefined : JSON.stringify(data);
            log.push({ action: name, from: peerId, to: t, data: wire && JSON.parse(wire) });
            deliver(
              () => {
                const peer = peers.get(t);
                peer?.handlers.get(name)?.forEach((h) => h(wire && JSON.parse(wire), peerId));
              },
              oneWay(peerId, t),
              `${peerId}>${t}`
            );
          }
        };
        const receive = (h: Handler) => {
          const list = me.handlers.get(name) ?? [];
          list.push(h);
          me.handlers.set(name, list);
        };
        return [send, receive, () => {}];
      },
      onPeerJoin: (l: Listener) => void me.joinListeners.push(l),
      onPeerLeave: (l: Listener) => void me.leaveListeners.push(l),
      getPeers: () =>
        Object.fromEntries([...peers.keys()].filter((p) => p !== peerId).map((p) => [p, {}])),
      ping: (to: string) => {
        const rtt = 2 * oneWay(peerId, to);
        return new Promise<number>((resolve) =>
          rtt > 0 ? setTimeout(() => resolve(rtt), rtt) : resolve(0)
        );
      },
      leave: () => {
        peers.delete(peerId);
        peers.forEach((p) => p.leaveListeners.forEach((l) => l(peerId)));
      }
    };
    return room as unknown as Room;
  }

  return {
    join,
    setLatency(peerId, latencyMs) {
      const p = peers.get(peerId);
      if (p) p.latencyMs = latencyMs;
    },
    settle() {
      while (announce.length) {
        const id = announce.shift()!;
        const fresh = peers.get(id);
        if (!fresh) continue;
        for (const other of peers.values()) {
          if (other.id === id) continue;
          const key = [id, other.id].sort().join('|');
          if (connected.has(key)) continue;
          connected.add(key);
          other.joinListeners.forEach((l) => l(id));
          fresh.joinListeners.forEach((l) => l(other.id));
        }
      }
    },
    flush() {
      while (queue.length) queue.shift()!.fn();
    },
    flushRandom(rand, max = Infinity) {
      for (let delivered = 0; queue.length && delivered < max; delivered++) {
        const links = [...new Set(queue.map((q) => q.link))];
        const link = links[Math.floor(rand() * links.length)];
        const at = queue.findIndex((q) => q.link === link); // oldest message on that link
        queue.splice(at, 1)[0].fn();
      }
    },
    get pending() {
      return queue.length;
    },
    log
  };
}
