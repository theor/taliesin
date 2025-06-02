import type { ActionReturn } from 'svelte/action';
import Hammer, { DIRECTION_NONE } from 'hammerjs';
import { DIRECTION_LEFT, DIRECTION_RIGHT } from 'hammerjs';
interface Attributes {
}
export enum SwipeDirection {
  None = DIRECTION_NONE,
  Left = DIRECTION_LEFT,
  Right = DIRECTION_RIGHT
}
type P = (dir: SwipeDirection) => void;
export function myAction(node: HTMLDivElement, p: P): ActionReturn<P> {
  var hammertime = new Hammer(node, {});

  hammertime.on('swipe', (ev) => {
    // console.log("swipe",ev);
    if (ev.direction === SwipeDirection.Left || ev.direction === SwipeDirection.Right)
      p(ev.direction);
  });
  // ...
  return {
    // update: (updatedParameter) => {...},
    destroy: () => {}
  };
}
