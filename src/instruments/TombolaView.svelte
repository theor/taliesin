<script lang="ts">
  import { Instrument, strudel, type IDispatchingInstrumentViewProps } from '$lib';
  import { getGlobalContext } from '$lib/context';
  import { getInstrument } from '$lib/Store.svelte';
  import {
    defaultBalls,
    drawTombola,
    loadTombola,
    rollDue,
    saveTombola,
    tombolaCommands,
    type TombolaSettings
  } from '$lib/tombola';
  import {
    BALL_RADIUS,
    CORNER,
    cycleAt,
    TombolaPlayer,
    type DrumPicture,
    type LiveNote
  } from '$lib/tombolaPhysics';
  import { previewCode } from '$lib/monitor';
  import type { LinearClock } from '$lib/strudel';
  import { Dices } from '@lucide/svelte';
  import { untrack } from 'svelte';
  import { LiveTake } from './liveTake.svelte';
  import TakeControls from './TakeControls.svelte';

  // The tombola input: pick the balls (rows) and the spin, then shake to draw a loop into the pattern,
  // or keep it spinning to draw a new one every time round. Its settings are this device's (not song
  // state); the notes go out as `setCells` like any edit, to the pattern slot open here.
  // With physics on, the drum is simulated instead and played like an instrument, on this device only:
  // a ball hitting a wall plays its note on the nearest step, in time with the song (or on its own while
  // the song is stopped). Nothing is sent until a take records it: then it is an edit like any other.
  const props: IDispatchingInstrumentViewProps = $props();
  const { instrumentData, dispatch, position, playing, now } = $derived(props);
  // the switcher gives each instrument a fresh view (`{#key}`), so these are read once
  const instr: Instrument | undefined = getInstrument(untrack(() => instrumentData));
  const seq = instr?.sequencer;
  const scale = getGlobalContext() ?? { scaleKey: 'A', scaleMode: 'minor' };

  const length = $derived(instr?.getLength(instrumentData) ?? { stepsPerMeasure: 4, measures: 1 });
  const total = $derived(length.stepsPerMeasure * length.measures);
  const tracks = $derived(seq?.tracks ?? []);

  let settings = $state<TombolaSettings>(
    untrack(
      () =>
        loadTombola(instrumentData.id) ?? {
          // the loop as it is when the view opens
          balls: seq ? defaultBalls(seq, instrumentData, total) : [],
          spin: 0.5,
          roll: false,
          physics: false
        }
    )
  );
  $effect(() => saveTombola(instrumentData.id, $state.snapshot(settings)));
  const balls = $derived(settings.balls.filter((b) => b < tracks.length));

  function toggle(track: number) {
    settings.balls = balls.includes(track)
      ? balls.filter((b) => b !== track)
      : [...balls, track].sort((a, b) => a - b);
  }
  function shake() {
    if (!seq) return;
    if (settings.physics) {
      player?.shake(); // heard a fraction of a second later
      return;
    }
    const draw = drawTombola(balls, settings.spin, total);
    for (const cmd of tombolaCommands(seq, instrumentData, balls, draw)) dispatch(cmd);
  }

  // --- physics: the drum played live on this device ---
  /** Records what the drum plays (the take card), and holds "hear notes". */
  const rec = new LiveTake(() => props, scale, 'nearest');
  /** Each ball's note as the instrument plays it now, compiled ahead: a hit then costs no compiling. */
  const ballNotes = $derived(
    new Map(balls.map((t) => [t, instr ? previewCode(instr, instrumentData, scale, t) : undefined]))
  );
  $effect(() => {
    if (!settings.physics) return;
    for (const note of ballNotes.values()) if (note) strudel.prepare(note.code);
  });

  let player: TombolaPlayer | undefined;
  let picture = $state<DrumPicture | undefined>();
  /** Notes played, waiting for the song to reach their step to join the take. */
  let toRecord: LiveNote[] = [];
  /** Notes scheduled and not over yet; the balls whose note sounds now. */
  let played: LiveNote[] = [];
  let sounding = $state<number[]>([]);
  /** The drum's own clock while the song is stopped. */
  let free: LinearClock | undefined;
  $effect(() => {
    const b = balls;
    untrack(() => player?.setBalls(b));
  });
  /** The song's clock while it plays, else a free one at the song's tempo. */
  function drumClock(audio: number): LinearClock {
    const song = playing ? strudel.songClock() : undefined;
    if (song) {
      free = undefined;
      return song;
    }
    const cps = strudel.cps;
    if (!free || free.cps !== cps) {
      free = { cycle: free ? cycleAt(free, audio) : 0, seconds: audio, cps };
    }
    return free;
  }
  function playDrum() {
    const audio = strudel.audioNow();
    const clock = drumClock(audio);
    const spm = length.stepsPerMeasure;
    player ??= new TombolaPlayer(Math.floor(Math.random() * 2 ** 32), balls);
    for (const n of player.update(clock, audio, spm, settings.spin)) {
      const note = ballNotes.get(n.track);
      if (note && rec.hear) void strudel.playOnce(note.code, note.window, n.seconds);
      if (playing) toRecord.push(n);
      played.push(n);
    }
    // the balls light up while their note sounds (for a step's length)
    const stepSeconds = 1 / (clock.cps * spm);
    played = played.filter((n) => n.seconds + stepSeconds > audio);
    const lit = [...new Set(played.filter((n) => n.seconds <= audio).map((n) => n.track))];
    if (lit.join() !== sounding.join()) sounding = lit;
    // a note joins the take once the song has reached its step: the song has then already scheduled
    // that step, so the new cell is not played twice
    if (playing) {
      const songStep = (now?.() ?? position ?? 0) * spm;
      const due = toRecord.filter((n) => n.step <= songStep);
      toRecord = toRecord.filter((n) => n.step > songStep);
      for (const n of due) rec.take.hitAt(n.track, n.step);
    } else toRecord = [];
    picture = player.view(clock, audio, spm);
  }
  $effect(() => {
    if (!settings.physics || typeof requestAnimationFrame === 'undefined') return;
    let frame = 0;
    const tick = () => {
      playDrum();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      player = undefined;
      picture = undefined;
      toRecord = [];
      played = [];
      sounding = [];
      free = undefined;
    };
  });

  // The song clock, read every frame while playing (the `position` prop updates a few times a second):
  // it turns the drawn drum, and keeping spinning rolls a new loop as each one ends.
  let clock = $state(0);
  let lastRolled: number | undefined;
  $effect(() => {
    if (!playing || typeof requestAnimationFrame === 'undefined') {
      clock = position ?? 0;
      return;
    }
    let frame = 0;
    const tick = () => {
      clock = now?.() ?? position ?? 0;
      if (settings.roll && !settings.physics) {
        const due = rollDue(clock, length.stepsPerMeasure, length.measures, lastRolled);
        if (due !== undefined) {
          lastRolled = due;
          shake();
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });

  const steps = $derived(clock * length.stepsPerMeasure);
  const nowStep = $derived(
    playing && total ? ((Math.floor(steps) % total) + total) % total : undefined
  );
  /** The loop as the tombola sees it: the ball row playing on each step, if any. */
  const loop = $derived(
    Array.from({ length: total }, (_, step) =>
      seq ? balls.find((t) => seq.getCell(instrumentData, t, step)) : undefined
    )
  );
  const label = (track: number) => instr?.trackLabel(tracks[track], scale) ?? tracks[track];

  // the drum: a hexagon that turns with the song (a turn every four steps at full spin), the balls lying
  // in its bottom and bouncing, the one playing now lit
  const R = 80;
  const hexagon = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(R * Math.cos(a)).toFixed(1)},${(R * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  // the simulated drum, when there is one: its unit is the wall distance, the hexagon's corner is R
  const S = R / CORNER;
  const ballRadius = $derived(picture ? BALL_RADIUS * S : 13);
  const angle = $derived(
    picture ? (picture.angle * 180) / Math.PI : ((steps / 4) * settings.spin * 360) % 360
  );
  const placed = $derived(
    picture
      ? picture.balls.map(({ track, x, y }) => ({ track, x: 100 + x * S, y: 100 + y * S }))
      : balls.map((track, i) => {
          const n = balls.length;
          const phase = steps * Math.PI * (0.5 + 0.13 * i) + i * 1.7;
          const spread = 1.6 / Math.max(n, 2);
          const a =
            Math.PI / 2 + (i - (n - 1) / 2) * spread + Math.sin(phase) * 0.3 * settings.spin;
          const r = R * 0.55 - Math.abs(Math.sin(phase * 1.3)) * R * 0.35 * settings.spin;
          return { track, x: 100 + r * Math.cos(a), y: 100 + r * Math.sin(a) };
        })
  );
  const playingTrack = $derived(nowStep === undefined ? undefined : loop[nowStep]);
</script>

<div class="flex flex-col gap-4" data-testid="tombola">
  <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
    <svg
      viewBox="0 0 200 200"
      class="mx-auto aspect-square w-full max-w-60 flex-none"
      role="img"
      aria-label="Tombola with {balls.length} balls"
    >
      <g transform="translate(100 100) rotate({angle.toFixed(1)})">
        <polygon
          points={hexagon}
          fill="none"
          stroke="var(--color-primary-500)"
          stroke-width="4"
          stroke-linejoin="round"
          opacity={settings.spin > 0 ? 0.9 : 0.4}
        />
      </g>
      {#each placed as ball (ball.track)}
        {@const lit = picture ? sounding.includes(ball.track) : ball.track === playingTrack}
        <g transform="translate({ball.x.toFixed(1)} {ball.y.toFixed(1)})">
          <circle
            r={ballRadius * (lit ? 1.2 : 1)}
            fill="var(--color-primary-500)"
            opacity={lit ? 1 : 0.6}
            stroke={lit ? 'white' : 'none'}
            stroke-width="2"
          />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size={picture ? 8 : 10}
            font-weight="700"
            fill="#0B0C0F">{label(ball.track)}</text
          >
        </g>
      {/each}
      {#if balls.length === 0}
        <text x="100" y="100" text-anchor="middle" font-size="12" fill="currentColor" opacity="0.6"
          >Add some balls</text
        >
      {/if}
    </svg>

    <div class="flex min-w-0 flex-1 flex-col gap-3">
      <div>
        <span class="mb-1 block text-sm">Balls</span>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Balls">
          {#each tracks.keys() as track (track)}
            {@const on = balls.includes(track)}
            <button
              class="btn min-h-10 min-w-12 px-2 text-sm font-semibold {on
                ? 'bg-primary-500 text-primary-contrast-500'
                : 'bg-surface-200-800 opacity-70'}"
              aria-label="Ball {label(track)}"
              aria-pressed={on}
              onclick={() => toggle(track)}>{label(track)}</button
            >
          {/each}
        </div>
      </div>

      <label class="block">
        <span class="mb-1 flex justify-between text-sm">
          <span>Spin</span>
          <span class="tabular-nums opacity-70">{Math.round(settings.spin * 100)}%</span>
        </span>
        <input
          type="range"
          class="w-full accent-(--color-primary-500)"
          aria-label="Spin"
          min="0"
          max="1"
          step="0.05"
          bind:value={settings.spin}
        />
        <span class="text-surface-300 text-xs"
          >{settings.physics
            ? 'How fast the drum turns: faster throws the balls harder.'
            : 'The odds that a ball hits the wall on each step.'}</span
        >
      </label>

      <div class="flex flex-wrap items-center gap-3">
        <button
          class="btn preset-filled-primary-500 min-h-10 text-sm font-semibold"
          aria-label="Shake"
          title={settings.physics ? 'Throw the balls about' : 'Draw a new loop from the balls'}
          disabled={!balls.length}
          onclick={shake}><Dices size={18} /> Shake</button
        >
        {#if !settings.physics}
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="checkbox" bind:checked={settings.roll} />
            Keep spinning
          </label>
        {/if}
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            class="checkbox"
            aria-label="Physics"
            bind:checked={settings.physics}
          />
          Physics
        </label>
      </div>
    </div>
  </div>

  {#if settings.physics}
    <TakeControls live={rec} playing={playing ?? false} {nowStep} />
  {/if}

  <div
    class="grid gap-0.5"
    style:grid-template-columns="repeat({total}, minmax(0, 1fr))"
    aria-label="Loop"
  >
    {#each loop as hit, step (step)}
      <span
        class="h-3 rounded-sm {hit !== undefined
          ? 'cell-on bg-primary-500'
          : 'cell-off bg-surface-200-800'} {nowStep === step ? 'outline outline-white' : ''}"
        data-now={nowStep === step || undefined}
        title={hit !== undefined ? label(hit) : 'rest'}
      ></span>
    {/each}
  </div>
  <p class="text-surface-300 text-xs">
    {settings.physics
      ? playing
        ? 'A ball that hits the wall plays its note on the nearest step, here only: record a take to keep a loop of it.'
        : 'A ball that hits the wall plays its note, here only. Play the song to play along and record it.'
      : settings.roll
        ? playing
          ? 'A new loop is drawn every time round.'
          : 'Play to draw a new loop every time round.'
        : 'Shake to draw a loop into the pattern; it then plays like any other.'}
  </p>
</div>
