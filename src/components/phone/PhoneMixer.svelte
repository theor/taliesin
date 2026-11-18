<script lang="ts">
  import { TrackState } from '$lib';
  import type { Dispatch, Song } from '$lib/commands';
  import { setTrackStateCommand } from '$lib/commandBuilders';
  import { KEYS, MODE_NAMES } from '$lib/scale';
  import { trackColor, trackInitials } from '$lib/trackColors';

  /** The phone's mixer: the song's key, then one channel strip per instrument and the master. Pure view. */
  let { song, dispatch }: { song: Song; dispatch: Dispatch } = $props();

  const setScale = (scaleKey: string, scaleMode: string) =>
    dispatch({ type: 'setScale', scaleKey, scaleMode });
  const db = (v: number) => (v <= 0.001 ? '-∞' : (20 * Math.log10(v)).toFixed(1));
  const select =
    'bg-surface-800 border-surface-700 text-surface-100 h-11 w-full rounded-lg border px-2.5 font-mono text-[15px] font-semibold tracking-normal normal-case';
</script>

<section
  aria-label="Song"
  class="bg-surface-900 border-surface-700 mx-4 grid grid-cols-2 gap-2 rounded-2xl border p-3"
>
  <label class="label-caps flex flex-col gap-1"
    >Key
    <select
      class={select}
      aria-label="Key"
      value={song.scale.scaleKey}
      onchange={(e) => setScale(e.currentTarget.value, song.scale.scaleMode)}
    >
      {#each KEYS as k (k)}<option value={k}>{k}</option>{/each}
    </select>
  </label>
  <label class="label-caps flex flex-col gap-1"
    >Mode
    <select
      class={select}
      aria-label="Mode"
      value={song.scale.scaleMode}
      onchange={(e) => setScale(song.scale.scaleKey, e.currentTarget.value)}
    >
      {#each MODE_NAMES as m (m)}<option value={m}>{m}</option>{/each}
    </select>
  </label>
</section>

<div class="flex gap-1.5 overflow-x-auto px-4 pt-4 pb-1" aria-label="Channels" role="group">
  {#each song.instrumentsData as data, index (data.id)}
    {@const muted = data.state === TrackState.Muted}
    {@const soloed = data.state === TrackState.Solo}
    {@render strip({
      name: data.name,
      label: `${data.name} volume`,
      color: trackColor(index),
      value: data.volume,
      onchange: (volume) =>
        dispatch({ type: 'setInstrumentFields', instrumentId: data.id, fields: { volume } }),
      mute: { on: muted, toggle: () => dispatch(setTrackStateCommand(data, TrackState.Muted)) },
      solo: { on: soloed, toggle: () => dispatch(setTrackStateCommand(data, TrackState.Solo)) }
    })}
  {/each}
  {@render strip({
    name: 'Master',
    label: 'Master Volume',
    color: 'var(--color-surface-100)',
    value: song.volume,
    onchange: (volume) => dispatch({ type: 'setMasterVolume', volume }),
    master: true
  })}
</div>

{#snippet strip(s: {
  name: string;
  label: string;
  color: string;
  value: number;
  onchange: (v: number) => void;
  master?: boolean;
  mute?: { on: boolean; toggle: () => void };
  solo?: { on: boolean; toggle: () => void };
})}
  <div
    class="flex min-w-16 flex-1 flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2 {s.master
      ? 'bg-surface-800 border-surface-600'
      : 'bg-surface-900 border-surface-700'}"
  >
    <span
      class="flex size-8 items-center justify-center rounded-lg text-[11px] font-bold text-[#0B0C0F]"
      style:background={s.color}>{s.master ? 'MA' : trackInitials(s.name)}</span
    >
    <span class="w-full truncate text-center text-[11px] font-semibold">{s.name}</span>
    <input
      type="range"
      class="fader"
      style:--fader={s.color}
      min="0"
      max="1"
      step="0.01"
      value={s.value}
      aria-label={s.label}
      oninput={(e) => s.onchange(Number(e.currentTarget.value))}
    />
    <span class="font-mono text-[11px] font-semibold tabular-nums">{db(s.value)}</span>
    {#if s.mute && s.solo}
      <button
        class="h-11 w-full rounded-lg border text-sm font-bold {s.mute.on
          ? 'bg-warning-500 border-warning-500 text-warning-contrast-500'
          : 'bg-surface-800 border-surface-700'}"
        aria-label="Mute {s.name}"
        aria-pressed={s.mute.on}
        onclick={s.mute.toggle}>M</button
      >
      <button
        class="h-11 w-full rounded-lg border text-sm font-bold {s.solo.on
          ? 'bg-primary-500 border-primary-500 text-primary-contrast-500'
          : 'bg-surface-800 border-surface-700'}"
        aria-label="Solo {s.name}"
        aria-pressed={s.solo.on}
        onclick={s.solo.toggle}>S</button
      >
    {:else}
      <span class="h-[94px]"></span>
    {/if}
  </div>
{/snippet}

<style>
  .label-caps {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-surface-300);
  }
  /* a vertical fader: low at the bottom, a wide thumb in the strip's colour */
  .fader {
    writing-mode: vertical-lr;
    direction: rtl;
    -webkit-appearance: none;
    appearance: none;
    width: 44px;
    height: 260px;
    background: transparent;
    touch-action: none;
    cursor: pointer;
  }
  .fader::-webkit-slider-runnable-track {
    width: 6px;
    border-radius: 3px;
    background: var(--color-surface-700);
  }
  .fader::-moz-range-track {
    width: 6px;
    border-radius: 3px;
    background: var(--color-surface-700);
  }
  .fader::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 36px;
    height: 20px;
    margin-left: -15px;
    border-radius: 6px;
    border: none;
    background: var(--color-surface-100);
    box-shadow: inset 0 -3px 0 var(--fader);
  }
  .fader::-moz-range-thumb {
    width: 36px;
    height: 20px;
    border-radius: 6px;
    border: none;
    background: var(--color-surface-100);
    box-shadow: inset 0 -3px 0 var(--fader);
  }
</style>
