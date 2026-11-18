<script lang="ts">
  import {
    arcPoint,
    dragValue,
    fraction,
    isScroll,
    keyValue,
    snap,
    KNOB_HOLD_MS,
    KNOB_SWEEP_DEG
  } from '$lib/knob';

  /**
   * A rotary knob for the rack: drag up/right to turn it up (anywhere on the screen once grabbed), arrow
   * and page keys for fine and coarse steps. Bind `value`, or pass `value` plus `onchange`.
   * A mouse grabs it at once. A finger has to hold still on it for a moment first (`KNOB_HOLD_MS`): a
   * finger that moves before that is scrolling the page or the strip of knobs, and the knob lets it.
   * The arc is the primary colour, which the phone sets to the instrument's colour.
   */
  let {
    value = $bindable(),
    min,
    max,
    step = 0.01,
    label,
    format = (v: number) => String(v),
    onchange,
    size = 52
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    format?: (v: number) => string;
    onchange?: (v: number) => void;
    size?: number;
  } = $props();

  const C = 24;
  const R = 18;
  const f = $derived(fraction(value, min, max));
  const start = arcPoint(0, C, C, R);
  const end = arcPoint(1, C, C, R);
  const at = $derived(arcPoint(f, C, C, R));
  const tip = $derived(arcPoint(f, C, C, 9));
  const arc = (to: { x: number; y: number }, frac: number) =>
    `M ${start.x} ${start.y} A ${R} ${R} 0 ${frac * KNOB_SWEEP_DEG > 180 ? 1 : 0} 1 ${to.x} ${to.y}`;

  function set(v: number) {
    if (v === value) return;
    value = v;
    onchange?.(v);
  }

  type Drag = { id: number; x: number; y: number; value: number };
  /** A finger that landed and has not been held long enough to turn the knob yet. */
  let pending: (Drag & { timer: ReturnType<typeof setTimeout> }) | undefined;
  let drag: Drag | undefined;
  let dragging = $state(false);

  function engage(el: HTMLElement, id: number, x: number, y: number) {
    el.setPointerCapture?.(id);
    drag = { id, x, y, value };
    dragging = true;
  }
  function release() {
    if (pending) clearTimeout(pending.timer);
    pending = undefined;
    drag = undefined;
    dragging = false;
  }
  function down(e: PointerEvent) {
    if (e.button !== 0 || drag || pending) return;
    const el = e.currentTarget as HTMLElement;
    if (e.pointerType !== 'touch') {
      engage(el, e.pointerId, e.clientX, e.clientY);
      e.preventDefault();
      return;
    }
    const { pointerId: id, clientX: x, clientY: y } = e;
    const timer = setTimeout(() => {
      const last = pending;
      pending = undefined;
      if (!last) return;
      engage(el, id, last.x, last.y);
      navigator.vibrate?.(8); // a tick: the knob has the finger now
    }, KNOB_HOLD_MS);
    pending = { id, x, y, value, timer };
  }
  function move(e: PointerEvent) {
    if (pending && e.pointerId === pending.id) {
      // moved before the hold: a scroll, which the browser handles (it then cancels the pointer)
      if (isScroll(e.clientX - pending.x, e.clientY - pending.y)) release();
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    set(dragValue(drag.value, e.clientX - drag.x, e.clientY - drag.y, min, max, step));
  }
  function up(e: PointerEvent) {
    if (e.pointerId === (drag ?? pending)?.id) release();
  }
  /** Once the knob has the finger, the page must not scroll under it (needs a non-passive listener). */
  function holdPage(node: HTMLElement) {
    const stop = (e: TouchEvent) => {
      if (dragging) e.preventDefault();
    };
    node.addEventListener('touchmove', stop, { passive: false });
    return { destroy: () => node.removeEventListener('touchmove', stop) };
  }
  function key(e: KeyboardEvent) {
    const v = keyValue(e.key, snap(value, min, max, step), min, max, step);
    if (v === undefined) return;
    e.preventDefault();
    set(v);
  }
</script>

<div class="flex min-w-0 flex-col items-center gap-0.5">
  <div
    role="slider"
    tabindex="0"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={value}
    aria-valuetext={format(value)}
    class="knob rounded-full {dragging ? 'ring-primary-500 scale-110 ring-2' : ''}"
    style:width="{size}px"
    style:height="{size}px"
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
    oncontextmenu={(e) => e.preventDefault()}
    onkeydown={key}
    use:holdPage
  >
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d={arc(end, 1)}
        fill="none"
        stroke="var(--color-surface-700)"
        stroke-width="4"
        stroke-linecap="round"
      />
      {#if f > 0.001}
        <path
          d={arc(at, f)}
          fill="none"
          stroke="var(--color-primary-500)"
          stroke-width="4"
          stroke-linecap="round"
        />
      {/if}
      <circle cx={C} cy={C} r="12" fill="var(--color-surface-800)" />
      <line
        x1={C}
        y1={C}
        x2={tip.x}
        y2={tip.y}
        stroke="var(--color-surface-100)"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
  </div>
  <span class="font-mono text-[11px] font-semibold tabular-nums">{format(value)}</span>
  <span class="text-surface-300 w-full truncate text-center text-[11px]">{label}</span>
</div>

<style>
  .knob {
    /* scrolling starts on a knob too; once a finger has held it, `holdPage` stops the scroll */
    touch-action: pan-x pan-y;
    cursor: ns-resize;
    transition: transform 80ms;
  }
  .knob:focus-visible {
    outline: 2px solid var(--color-primary-500);
    outline-offset: 2px;
  }
</style>
