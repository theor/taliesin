<script lang="ts">
  /** The amplitude envelope drawn as a shape: attack up, decay down to the sustain level, hold, release. */
  let {
    attack,
    decay,
    sustain,
    release
  }: { attack: number; decay: number; sustain: number; release: number } = $props();

  const W = 300;
  const H = 64;
  const PAD = 6;
  /** How long the note is held in the drawing, in seconds (the real length depends on the note). */
  const HOLD = 0.4;

  const points = $derived.by(() => {
    const total = Math.max(0.05, attack + decay + HOLD + release);
    const x = (t: number) => PAD + (t / total) * (W - 2 * PAD);
    const top = PAD;
    const bottom = H - PAD;
    const level = bottom - Math.min(1, Math.max(0, sustain)) * (bottom - top);
    const t1 = attack;
    const t2 = t1 + decay;
    const t3 = t2 + HOLD;
    const t4 = t3 + release;
    return [
      { x: x(0), y: bottom },
      { x: x(t1), y: top },
      { x: x(t2), y: level },
      { x: x(t3), y: level },
      { x: x(t4), y: bottom }
    ];
  });
  const line = $derived(points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' '));
</script>

<svg
  class="bg-surface-950 col-span-full h-16 w-full rounded-lg"
  viewBox="0 0 {W} {H}"
  preserveAspectRatio="none"
  role="img"
  aria-label="Envelope: attack {attack}s, decay {decay}s, sustain {sustain}, release {release}s"
>
  <path d="{line} Z" fill="var(--color-primary-500)" fill-opacity="0.14" />
  <path
    d={line}
    fill="none"
    stroke="var(--color-primary-500)"
    stroke-width="2"
    stroke-linejoin="round"
    vector-effect="non-scaling-stroke"
  />
</svg>
