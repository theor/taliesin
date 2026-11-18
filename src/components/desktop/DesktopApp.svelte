<script lang="ts">
  import { store } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { presetCommands } from '$lib/commandBuilders';
  import { mixerIndex, patternsIndex } from '$lib/Store.svelte';
  import PatternLauncher from '../PatternLauncher.svelte';
  import { SettingsIcon, Volume2 } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import AddInstrumentModal from '../AddInstrumentModal.svelte';
  import InstrumentView from '../InstrumentView.svelte';
  import Mixer from '../Mixer.svelte';
  import SettingsPanel from '../SettingsPanel.svelte';
  import ShareButton from '../ShareButton.svelte';
  import Transport from '../Transport.svelte';
  import TrackList from './TrackList.svelte';

  /**
   * The desktop and tablet layout: a header with the transport and the jam, the tracks down the side,
   * and the selected instrument (or the mixer) in the middle. Phones get `phone/PhoneApp`.
   */
  let {
    selectedIndex = $bindable(),
    dispatch,
    position,
    playing,
    now,
    isHost,
    roomId,
    needsTap,
    onTap,
    hostOnly = false,
    debug
  }: {
    selectedIndex: number;
    dispatch: Dispatch;
    position: number;
    playing: boolean;
    now: () => number;
    isHost: boolean;
    roomId: string;
    /** A guest whose audio is still locked. */
    needsTap: boolean;
    onTap: () => void;
    /** A guest in a jam where only the host makes sound. */
    hostOnly?: boolean;
    debug?: Snippet;
  } = $props();

  const song = store.instrumentsData;
  const current = $derived(selectedIndex >= 0 ? song.instrumentsData[selectedIndex] : undefined);
  let addOpen = $state(false);
  let settingsOpen = $state(false);
  const others = $derived(store.peers.length);
</script>

<AddInstrumentModal bind:open={addOpen} bind:selectedIndex {dispatch} />

<div class="flex h-dvh flex-col" data-testid="desktop-app">
  <header
    class="bg-surface-950 border-surface-800 flex h-16 flex-none items-center gap-3 border-b px-4 lg:gap-4"
  >
    <span class="text-[17px] font-bold tracking-tight">Taliesin</span>
    <span
      class="border-surface-700 text-surface-300 rounded-lg border px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wider"
      data-testid="room-code"
      title="Jam code">{roomId}</span
    >
    <div class="flex-1"></div>
    <div class="flex items-center gap-2">
      <Transport
        {playing}
        {position}
        {dispatch}
        scale={store.scale}
        tempo={store.tempo}
        size="md"
      />
    </div>
    {#if needsTap}
      <button
        class="bg-primary-500 text-primary-contrast-500 flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold"
        onclick={onTap}><Volume2 size={18} /> Tap to hear</button
      >
    {/if}
    <div class="flex-1"></div>
    <span class="text-surface-300 flex items-center gap-1.5 text-xs" title={store.status()}>
      <span class="size-2 rounded-full {others ? 'bg-primary-500' : 'bg-surface-500'}"></span>
      {#if hostOnly}
        <span data-testid="host-only-note">Sound from host</span>
      {:else}
        <span class="hidden lg:inline">{isHost ? 'Host' : 'Guest'} ·</span>
        {others === 0 ? 'alone' : `${others} other${others > 1 ? 's' : ''}`}
      {/if}
    </span>
    <ShareButton />
    {#if isHost || store.calibration.applied !== undefined}
      <div class="relative">
        <button
          class="bg-surface-900 border-surface-700 flex size-11 items-center justify-center rounded-xl border"
          aria-label="Settings"
          aria-expanded={settingsOpen}
          onclick={() => (settingsOpen = !settingsOpen)}><SettingsIcon size={20} /></button
        >
        {#if settingsOpen}
          <div
            class="bg-surface-900 border-surface-700 absolute top-full right-0 z-50 mt-2 w-80 space-y-2 rounded-2xl border p-3 shadow-xl"
            data-testid="settings-panel"
          >
            <SettingsPanel {isHost} />
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <div class="flex min-h-0 flex-1">
    <aside
      class="border-surface-800 w-56 flex-none overflow-y-auto border-r p-3 lg:w-62"
      aria-label="Song"
    >
      <TrackList
        {song}
        {dispatch}
        bind:selectedIndex
        activity={store.activity}
        cues={store.cues}
        onAdd={() => (addOpen = true)}
      />
    </aside>

    <main class="min-w-0 flex-1 overflow-y-auto px-5 pt-4 lg:px-6">
      {#if debug}<div class="mb-4 space-y-2">{@render debug()}</div>{/if}

      {#if selectedIndex === mixerIndex}
        <div class="flex flex-col gap-3 pb-8">
          <h1 class="text-xl font-bold">Mixer</h1>
          <Mixer {song} {dispatch} />
        </div>
      {:else if selectedIndex === patternsIndex}
        <div class="flex flex-col gap-3 pb-8">
          <h1 class="text-xl font-bold">Patterns</h1>
          <PatternLauncher
            {song}
            cues={store.cues}
            {dispatch}
            {position}
            {playing}
            hostOnly={store.transport.hostOnly}
            onEdit={(i) => (selectedIndex = i)}
          />
        </div>
      {:else if current}
        <InstrumentView
          bind:instrumentData={song.instrumentsData[selectedIndex]}
          index={selectedIndex}
          {dispatch}
          {position}
          {playing}
          {now}
          editedByOther={store.activity[current.id]}
          cues={store.cues}
          hostOnly={store.transport.hostOnly}
        />
      {:else}
        <div
          class="bg-surface-900 border-surface-700 mx-auto mt-16 max-w-md space-y-4 rounded-2xl border p-8 text-center"
        >
          <p class="text-lg">Nothing playing yet.</p>
          <button
            class="btn preset-filled-primary-500"
            onclick={() => {
              presetCommands().forEach(dispatch);
              selectedIndex = 0;
            }}>Start with a beat</button
          >
          <p class="text-surface-300 text-sm">
            Adds piano, bass and drums. Use Add instrument for a single one.
          </p>
        </div>
      {/if}
    </main>
  </div>
</div>
