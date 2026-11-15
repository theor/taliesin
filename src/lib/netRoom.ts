import type { Room as TrysteroRoom } from 'trystero';

/** Sends to everybody, or to one peer / a list of peers. */
export type ActionSender<T> = (data: T, target?: string | string[] | null) => Promise<void>;
export type ActionReceiver<T> = (cb: (data: T, peerId: string) => void) => void;

/**
 * The slice of a Trystero room the app uses. The app talks to this shape (and tests fake it) so the
 * networking library can change underneath: `adaptRoom` is the only code that knows Trystero's API.
 */
export interface Room {
  makeAction<T>(name: string): [ActionSender<T>, ActionReceiver<T>];
  onPeerJoin(cb: (peerId: string) => void): void;
  onPeerLeave(cb: (peerId: string) => void): void;
  ping(peerId: string): Promise<number>;
  leave(): void | Promise<unknown>;
  /** Our own peer id, once the room has finished joining (real rooms only). */
  selfId?(): Promise<string>;
}

export function adaptRoom(room: TrysteroRoom): Room {
  return {
    makeAction<T>(name: string) {
      const action = room.makeAction<any>(name);
      const send: ActionSender<T> = (data, target) =>
        action.send(data, target == null ? undefined : { target });
      const receive: ActionReceiver<T> = (cb) => {
        action.onMessage((data, context) => cb(data as T, context.peerId));
      };
      return [send, receive];
    },
    onPeerJoin: (cb) => void room.onPeerJoin(({ peerId }) => cb(peerId)),
    onPeerLeave: (cb) => void room.onPeerLeave(({ peerId }) => cb(peerId)),
    ping: (peerId) => room.ping(peerId),
    leave: () => room.leave(),
    selfId: async () => (await room.getSelf()).peerId
  };
}
