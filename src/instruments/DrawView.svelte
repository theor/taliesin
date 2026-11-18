<script lang="ts">
  import { Instrument, type IDispatchingInstrumentViewProps } from '$lib';
  import { playheadStep } from '$lib/gesture';
  import { Stroke } from '$lib/recorder';
  import { getInstrument } from '$lib/Store.svelte';
  import { getGlobalContext } from '$lib/context';
  import { onDestroy } from 'svelte';
  import { LiveTake } from './liveTake.svelte';
  import TakeControls from './TakeControls.svelte';

  // Draw on a surface while the song plays: height is pitch (one lane per row of the grid, higher is
  // higher), width is velocity (read and shown, not recorded yet: the melody has no velocity field).
  // Time is the song's: a Stroke records the lane the finger is on at each step it passes through.
  const props: IDispatchingInstrumentViewProps = $props();
  const { instrumentData, position, playing } = $derived(props);
  const instr: Instrument | undefined = $derived(getInstrument(instrumentData));
  const seq = $derived(instr?.sequencer);
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const length = $derived(instr?.getLength(instrumentData) ?? { stepsPerMeasure: 4, measures: 1 });
  const nowStep = $derived(playheadStep(position ?? 0, playing ?? false, length));
  const tracks = $derived(seq?.tracks ?? []);
  /** Lanes top to bottom: the highest track first. */
  const lanes = $derived(tracks.map((track, trackIndex) => ({ track, trackIndex })).reverse());

  // floor: a held note lands on the step being heard, not on the next one halfway through
  const live = new LiveTake(() => props, scale, 'floor');
  // Drawing always plays the lane under the finger, once per step (to play along before a take);
  // during a take each of those notes is also recorded. The song only plays a recorded note next
  // time round (its step is already being heard), so the monitor is what you hear now.
  const stroke = new Stroke({
    currentStep: () => live.take.currentStep() ?? live.freeStep(),
    hit: (track) => {
      live.monitor(track);
      const step = live.take.hit(track);
      if (step !== undefined) lastStep = step;
      return step ?? live.freeStep();
    }
  });

  let surface = $state<HTMLDivElement>();
  let canvas = $state<HTMLCanvasElement>();

  /** The pointer while it is down: which lane, and the velocity it would play at (0-1). */
  let pen = $state<{
    pointerId: number;
    trackIndex: number;
    velocity: number;
    x: number;
    y: number;
  }>();
  /** The last step the pen recorded on, shown under the surface. */
  let lastStep = $state<number>();
  /** The ink: recent pen positions (surface-relative, 0-1), fading out. */
  let ink: { x: number; y: number; t: number }[] = [];
  const INK_MS = 700;

  const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
  function locate(e: PointerEvent) {
    const r = surface!.getBoundingClientRect();
    const x = r.width > 0 ? clamp01((e.clientX - r.left) / r.width) : 0;
    const y = r.height > 0 ? clamp01((e.clientY - r.top) / r.height) : 0;
    const rows = tracks.length;
    // y = 0 is the top lane, which is the highest track
    const trackIndex = rows - 1 - Math.min(rows - 1, Math.floor(y * rows));
    return { x, y, trackIndex, velocity: x };
  }

  function sample() {
    if (pen) stroke.sample(pen.trackIndex);
  }

  function down(e: PointerEvent) {
    if (!playing || pen || !tracks.length) return;
    e.preventDefault();
    try {
      surface?.setPointerCapture(e.pointerId);
    } catch {
      // jsdom / an already released pointer: drawing still works without capture
    }
    pen = { pointerId: e.pointerId, ...locate(e) };
    stroke.end();
    ink.push({ x: pen.x, y: pen.y, t: performance.now() });
    sample();
    startLoop();
  }
  function move(e: PointerEvent) {
    if (!pen || e.pointerId !== pen.pointerId) return;
    pen = { pointerId: e.pointerId, ...locate(e) };
    ink.push({ x: pen.x, y: pen.y, t: performance.now() });
    sample();
  }
  function up(e: PointerEvent) {
    if (!pen || e.pointerId !== pen.pointerId) return;
    pen = undefined;
    stroke.end();
  }

  // A finger held still sends no pointer events, but the song moves on under it: sample every frame.
  let frame: number | undefined;
  function startLoop() {
    if (frame === undefined && typeof requestAnimationFrame === 'function') {
      frame = requestAnimationFrame(tick);
    }
  }
  function tick() {
    frame = undefined;
    sample();
    draw();
    if (pen || ink.length) frame = requestAnimationFrame(tick);
  }
  onDestroy(() => {
    if (frame !== undefined) cancelAnimationFrame(frame);
    pen = undefined;
  });
  // stopping the song ends the stroke
  $effect(() => {
    if (!playing && pen) {
      pen = undefined;
      stroke.end();
    }
  });

  function draw() {
    const t = performance.now();
    ink = ink.filter((p) => t - p.t < INK_MS);
    const ctx = canvas?.getContext?.('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth * dpr;
    const h = canvas.clientHeight * dpr;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.clearRect(0, 0, w, h);
    const color = getComputedStyle(canvas).color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < ink.length; i++) {
      const a = ink[i - 1];
      const b = ink[i];
      if (b.t - a.t > 100) continue; // a new stroke: don't join it to the last one
      ctx.globalAlpha = 1 - (t - b.t) / INK_MS;
      ctx.lineWidth = (4 + 10 * b.x) * dpr; // wider to the right: louder (one day)
      ctx.beginPath();
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.stroke();
    }
    if (pen) {
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(pen.x * w, pen.y * h, (8 + 10 * pen.velocity) * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const label = (track: string) => instr?.trackLabel(track, scale) ?? track;
  const surfaceBorder = $derived(
    live.take.phase === 'recording'
      ? 'border-error-700'
      : live.take.phase === 'armed'
        ? 'border-warning-800'
        : 'border-surface-200-800'
  );
</script>

{#if instr && seq}
  <div data-testid="draw-view" class="space-y-3">
    {#if !playing}
      <p class="text-center text-sm opacity-70" data-testid="draw-hint">
        Press play, then draw: up and down is pitch. Record a take to keep it.
      </p>
    {/if}

    <div
      bind:this={surface}
      data-testid="draw-surface"
      role="application"
      aria-label="Draw notes"
      aria-disabled={!playing}
      class="bg-surface-100-900 relative flex h-72 flex-col overflow-hidden rounded-xl border select-none {surfaceBorder} {playing
        ? ''
        : 'opacity-50'}"
      data-phase={live.take.phase}
      style:touch-action="none"
      onpointerdown={down}
      onpointermove={move}
      onpointerup={up}
      onpointercancel={up}
      onlostpointercapture={up}
    >
      {#each lanes as { track, trackIndex } (trackIndex)}
        <div
          class="border-surface-200-800 flex flex-1 items-center border-b px-2 text-xs last:border-b-0 {pen?.trackIndex ===
          trackIndex
            ? 'bg-primary-500/25 font-semibold'
            : trackIndex % 2
              ? 'bg-surface-500/5'
              : ''}"
          data-lane={trackIndex}
          data-active={pen?.trackIndex === trackIndex ? '' : undefined}
        >
          <span class="opacity-60">{label(track)}</span>
        </div>
      {/each}
      {#if live.take.phase === 'recording'}
        <span
          class="bg-error-950 text-error-300 pointer-events-none absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold tracking-wider"
          data-testid="rec-badge"
        >
          <span class="bg-error-500 size-2 rounded-full"></span>REC
        </span>
      {/if}
      <canvas
        bind:this={canvas}
        class="text-primary-500 pointer-events-none absolute inset-0 h-full w-full"
      ></canvas>
    </div>

    <div class="flex justify-between text-xs opacity-70" data-testid="draw-readout">
      <span>{lastStep === undefined ? '' : `step ${lastStep + 1}`}</span>
      <span>{pen ? `velocity ${Math.round(pen.velocity * 100)}% (not recorded yet)` : ''}</span>
    </div>

    <TakeControls {live} playing={playing ?? false} {nowStep} />
  </div>
{:else}
  <p>Instrument not found</p>
{/if}
