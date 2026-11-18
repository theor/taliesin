import { getContext, setContext } from 'svelte';

/**
 * How the part controls draw themselves: `list` (labelled rows: sliders, selects, steppers; the desktop) or
 * `rack` (compact modules: knobs, chips; the phone's rack). Set by a parent, read by the `Param*` controls,
 * so the part views stay the same in both layouts.
 */
export type ControlStyle = 'list' | 'rack';

const key = Symbol('controlStyle');

export function setControlStyle(style: ControlStyle) {
  setContext(key, style);
}

export function getControlStyle(): ControlStyle {
  return (getContext(key) as ControlStyle | undefined) ?? 'list';
}
