import type { ActionReturn } from 'svelte/action';
import Hammer, { DIRECTION_NONE } from 'hammerjs';
import { DIRECTION_LEFT, DIRECTION_RIGHT } from 'hammerjs';
interface Attributes {}
export enum SwipeDirection {
  None = DIRECTION_NONE,
  Left = DIRECTION_LEFT,
  Right = DIRECTION_RIGHT
}
type P = {
  onSwipe?: (dir: SwipeDirection) => void;
  onPan?: (e: any) => void;
};
export function gestures(node: HTMLDivElement, p: P): ActionReturn<P> {
  var hammertime = new Hammer(node, {});
  hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL });
  if(p.onSwipe)
  hammertime.on('swipe', (ev) => {
    // console.log("swipe",ev);
    if (ev.direction === SwipeDirection.Left || ev.direction === SwipeDirection.Right)
      p.onSwipe!(ev.direction);
  });
  if(p.onPan)
  hammertime.on('pan', (ev) => {
    p.onPan!(ev);
  });
  // ...
  return {
    // update: (updatedParameter) => {...},
    destroy: () => {}
  };
}


type PointerParams = {
  onPointer?: (e: PointerEvent) => void;
  /** How long a finger must rest before a touch stroke starts (before that, the page scrolls). */
  holdMs?: number;
};
enum PointerState {
  Up,
  Pressed,
  Down,
  Released,
}
/** A finger that moves further than this (px) before the hold has elapsed is scrolling. */
const SCROLL_SLOP = 8;

/**
 * Reports pointer strokes. Mouse and pen strokes start at once. A finger must rest for `holdMs`
 * first: a quick tap is delivered as down+up, a move before the hold is left to the browser (so
 * the page scrolls), and once the hold elapses the stroke is ours and scrolling is blocked.
 * The element must not set `touch-action: none`, or the page could never scroll from it.
 */
export function pointer(node: HTMLElement, p: PointerParams): ActionReturn<PointerParams> {
  let state = PointerState.Up;
  let pending: PointerEvent | undefined; // finger down, hold not yet elapsed
  let timer: ReturnType<typeof setTimeout> | undefined;
  let armed = false; // the hold elapsed: this stroke is ours

  function emit(event: PointerEvent) {
    switch (event.type) {
      case 'pointerdown':
        state = PointerState.Pressed;
        break;
      case 'pointerup':
        state = PointerState.Released;
        break;
      case 'pointermove':
        if (state === PointerState.Pressed) state = PointerState.Down;
        else if (state === PointerState.Released) state = PointerState.Up;
        break;
    }
    if (p.onPointer && state !== PointerState.Up) {
      p.onPointer(event);
    }
  }

  function clearPending() {
    clearTimeout(timer);
    timer = undefined;
    pending = undefined;
  }

  function handlePointer(event: PointerEvent) {
    const touch = event.pointerType === 'touch';
    switch (event.type) {
      case 'pointerdown':
        if (!touch) return emit(event);
        pending = event;
        armed = false;
        timer = setTimeout(() => {
          armed = true;
          navigator.vibrate?.(10);
          const down = pending!;
          pending = undefined;
          emit(down);
        }, p.holdMs ?? 250);
        return;
      case 'pointermove':
        if (pending) {
          if (Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY) > SCROLL_SLOP) {
            clearPending(); // scrolling: not ours
          }
          return;
        }
        if (touch && !armed) return;
        return emit(event);
      case 'pointerup':
        if (pending) {
          // a tap: toggle the cell it landed on
          const down = pending;
          clearPending();
          emit(down);
          return emit(event);
        }
        if (touch && !armed) return;
        armed = false;
        return emit(event);
      case 'pointercancel':
        clearPending();
        if (armed) {
          armed = false;
          state = PointerState.Up;
          p.onPointer?.(event);
        }
        return;
    }
  }

  // Once armed, stop the browser from also scrolling. Must be non-passive to be able to.
  function blockScroll(e: TouchEvent) {
    if (armed && e.cancelable) e.preventDefault();
  }

  node.addEventListener('pointerdown', handlePointer);
  node.addEventListener('pointerup', handlePointer);
  node.addEventListener('pointermove', handlePointer);
  node.addEventListener('pointercancel', handlePointer);
  node.addEventListener('touchmove', blockScroll, { passive: false });
  return {
    update: (updatedParameter: PointerParams) => {
      p = updatedParameter;
    },
    destroy: () => {
      clearPending();
      node.removeEventListener('pointerdown', handlePointer);
      node.removeEventListener('pointerup', handlePointer);
      node.removeEventListener('pointermove', handlePointer);
      node.removeEventListener('pointercancel', handlePointer);
      node.removeEventListener('touchmove', blockScroll);
    }
  };
}
