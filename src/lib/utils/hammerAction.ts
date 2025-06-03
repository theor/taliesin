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
};
enum PointerState {
  Up,
  Pressed,
  Down,
  Released,
}
export function pointer(node: HTMLElement, p: PointerParams): ActionReturn<PointerParams> {
  let state = PointerState.Up;
  function handlePointer(event: PointerEvent) {
    switch (event.type) {
      case 'pointerdown':
        state = PointerState.Pressed;
        break;
      case 'pointerup':
        state = PointerState.Released;
        break;
      case 'pointermove':
        if(state === PointerState.Pressed) 
          state = PointerState.Down;
        else if(state === PointerState.Released)
          state = PointerState.Up;
        break;
    }
    if (p.onPointer && state !== PointerState.Up) {
      p.onPointer(event);
    }
  }
  node.addEventListener('pointerdown', handlePointer);
  node.addEventListener('pointerup', handlePointer);
  node.addEventListener('pointermove', handlePointer);
  return {
    update: (updatedParameter: PointerParams) => {
      // console.log('Pointer action updated', updatedParameter); 
      
      p = updatedParameter;
    },
    destroy: () => {
      node.removeEventListener('pointerdown', handlePointer);
      node.removeEventListener('pointerup', handlePointer);
      node.removeEventListener('pointermove', handlePointer);
    }
  }
}
