import type { Room } from 'trystero';

type Handler = (data: any, peerId: string) => void;
type Listener = (peerId: string) => void;

interface FakePeer {
  id: string;
  handlers: Map<string, Handler[]>;
  joinListeners: Listener[];
  leaveListeners: Listener[];
}

export interface FakeNetwork {
  /** Create a room for a peer. Peers see each other after `settle()` (like real WebRTC, which is async). */
  join(peerId: string): Room;
  /** Announce pending joins (onPeerJoin on both sides). Call after the stores are constructed. */
  settle(): void;
  /** In queued mode, deliver all pending messages (including ones queued while flushing). */
  flush(): void;
  /** Pending message count (queued mode). */
  readonly pending: number;
  /** All messages ever sent, for assertions. */
  readonly log: { action: string; from: string; to: string; data: any }[];
}

/**
 * In-memory stand-in for a Trystero room hub. Implements only the surface AppStore uses:
 * makeAction, onPeerJoin, onPeerLeave, getPeers, leave.
 * `queued: true` holds messages until `flush()`, to test ordering / concurrent edits.
 */
export function createFakeNetwork(opts: { queued?: boolean } = {}): FakeNetwork {
  const peers = new Map<string, FakePeer>();
  const announce: string[] = [];
  const connected = new Set<string>();
  const queue: (() => void)[] = [];
  const log: FakeNetwork['log'] = [];
  const queued = opts.queued ?? false;

  const deliver = (fn: () => void) => (queued ? queue.push(fn) : fn());

  function join(peerId: string): Room {
    const me: FakePeer = { id: peerId, handlers: new Map(), joinListeners: [], leaveListeners: [] };
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
            deliver(() => {
              const peer = peers.get(t);
              peer?.handlers.get(name)?.forEach((h) => h(wire && JSON.parse(wire), peerId));
            });
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
      getPeers: () => Object.fromEntries([...peers.keys()].filter((p) => p !== peerId).map((p) => [p, {}])),
      ping: async () => 0,
      leave: () => {
        peers.delete(peerId);
        peers.forEach((p) => p.leaveListeners.forEach((l) => l(peerId)));
      }
    };
    return room as unknown as Room;
  }

  return {
    join,
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
      while (queue.length) queue.shift()!();
    },
    get pending() {
      return queue.length;
    },
    log
  };
}
