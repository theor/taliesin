<script lang="ts">
  import { TrackState } from '$lib';
  import type { Dispatch, Song } from '$lib/commands';
  import { setTrackStateCommand } from '$lib/commandBuilders';
  import { mixerIndex } from '$lib/Store.svelte';
  import { trackColor, trackInitials, trackKind } from '$lib/trackColors';
  import { Plus, SlidersVertical } from '@lucide/svelte';

  /**
   * The desktop sidebar: one row per instrument (select it, mute or solo it), the mixer, and "Add".
   * Pure view: the song comes in, commands go out.
   */
  let {
    song,
    dispatch,
    selectedIndex = $bindable(),
    activity = {},
    onAdd
  }: {
    song: Song;
    dispatch: Dispatch;
    selectedIndex: number;
    /** When someone else last edited each instrument, by id. */
    activity?: Record<string, number>;
    onAdd: () => void;
  } = $props();

  const small = 'size-8 flex-none rounded-lg border text-xs font-bold';
</script>

<nav aria-label="Tracks" class="flex flex-col gap-1">
  <span class="rack-label px-2 pb-1">Tracks</span>
  {#each song.instrumentsData as data, index (data.id)}
    {@const color = trackColor(index)}
    {@const muted = data.state === TrackState.Muted}
    {@const soloed = data.state === TrackState.Solo}
    {@const selected = selectedIndex === index}
    <div
      class="flex items-center gap-2 rounded-xl border py-1.5 pr-1.5 pl-2 {selected
        ? 'bg-surface-800 border-surface-600'
        : 'hover:bg-surface-900 border-transparent'}"
    >
      <button
        class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        aria-current={selected ? 'page' : undefined}
        onclick={() => (selectedIndex = index)}
      >
        <span
          class="relative flex size-9 flex-none items-center justify-center rounded-lg text-[11px] font-bold text-[#0B0C0F] {muted
            ? 'opacity-40'
            : ''}"
          style:background={color}
        >
          {trackInitials(data.name)}
          {#key activity[data.id]}
            {#if activity[data.id]}
              <span
                class="edit-flash bg-warning-500 border-surface-950 absolute -top-1 -right-1 size-3 rounded-full border-2"
                title="Someone else just edited this"
              ></span>
            {/if}
          {/key}
        </span>
        <span class="flex min-w-0 flex-col">
          <span class="truncate text-sm font-semibold">{data.name}</span>
          <span class="text-surface-300 truncate text-[11px]">{trackKind(data.instrumentName)}</span
          >
        </span>
      </button>
      <button
        class="{small} {muted
          ? 'bg-warning-500 border-warning-500 text-warning-contrast-500'
          : 'bg-surface-900 border-surface-700'}"
        aria-label="Mute {data.name}"
        aria-pressed={muted}
        title="Mute"
        onclick={() => dispatch(setTrackStateCommand(data, TrackState.Muted))}>M</button
      >
      <button
        class="{small} {soloed
          ? 'bg-primary-500 border-primary-500 text-primary-contrast-500'
          : 'bg-surface-900 border-surface-700'}"
        aria-label="Solo {data.name}"
        aria-pressed={soloed}
        title="Solo"
        onclick={() => dispatch(setTrackStateCommand(data, TrackState.Solo))}>S</button
      >
    </div>
  {/each}
  <button
    class="border-surface-600 text-surface-200 hover:text-surface-50 mt-1 flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-semibold"
    title="Add"
    onclick={onAdd}><Plus size={16} /> Add instrument</button
  >
  <button
    class="mt-3 flex h-11 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold {selectedIndex ===
    mixerIndex
      ? 'bg-surface-800 border-surface-600'
      : 'hover:bg-surface-900 border-transparent'}"
    title="Mixer"
    aria-current={selectedIndex === mixerIndex ? 'page' : undefined}
    onclick={() => (selectedIndex = mixerIndex)}><SlidersVertical size={18} /> Mixer</button
  >
</nav>

<style>
  .edit-flash {
    animation: edit-flash 1.6s ease-out forwards;
  }
  @keyframes edit-flash {
    from {
      opacity: 1;
      transform: scale(1.6);
    }
    to {
      opacity: 0;
      transform: scale(1);
    }
  }
</style>
