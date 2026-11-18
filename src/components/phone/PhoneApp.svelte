<script lang="ts">
  import { store, TrackState } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { randomizeCommands, setTrackStateCommand } from '$lib/commandBuilders';
  import { trackColor, trackInitials, trackKind } from '$lib/trackColors';
  import {
    ChevronLeft,
    Dices,
    Grid3x3,
    Headphones,
    LayoutGrid,
    ListMusic,
    Pause,
    Play,
    SlidersVertical,
    Volume2,
    VolumeX,
    Waves
  } from '@lucide/svelte';
  import { untrack, type Snippet } from 'svelte';
  import type { Screen } from '$lib/nav.svelte';
  import InputViewSwitcher from '../../instruments/InputViewSwitcher.svelte';
  import AddInstrumentModal from '../AddInstrumentModal.svelte';
  import InstrumentMenu from '../InstrumentMenu.svelte';
  import SettingsPanel from '../SettingsPanel.svelte';
  import ShareButton from '../ShareButton.svelte';
  import Mixer from '../Mixer.svelte';
  import QuickRack from './QuickRack.svelte';
  import RackModules from '../RackModules.svelte';
  import SessionView from './SessionView.svelte';
  import PatternSlots from '../PatternSlots.svelte';
  import CueBanner from '../CueBanner.svelte';
  import PatternLauncher from '../PatternLauncher.svelte';
  import { patternEdit } from '$lib/Store.svelte';

  /**
   * The phone layout: four screens (session, edit, rack, mixer) behind a bottom tab bar within thumb's
   * reach. Desktop keeps its own layout; `+page` picks one.
   */
  let {
    selectedIndex = $bindable(),
    screen = $bindable('session'),
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
    /** Which screen shows. Bindable, so +page can keep it in the browser's history. */
    screen?: Screen;
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

  let addOpen = $state(false);

  const song = store.instrumentsData;
  const current = $derived(
    selectedIndex >= 0 ? song.instrumentsData[selectedIndex] : song.instrumentsData[0]
  );
  const currentIndex = $derived(current ? song.instrumentsData.indexOf(current) : -1);
  const color = $derived(trackColor(currentIndex));
  const hasInstrument = $derived(!!current);
  // the pattern open on this device: the edit views work on its notes (a cue when it is not live)
  const edit = $derived(
    current ? patternEdit(current, store.cues.slot(current), dispatch) : undefined
  );
  const cueing = $derived(!!current && store.cues.isCue(current));

  function open(index: number, to: Screen = 'edit') {
    selectedIndex = index;
    screen = to;
  }
  // an instrument added from the dialog opens straight away (not ones added by others)
  let countAtOpen: number | undefined;
  $effect(() => {
    if (addOpen) {
      countAtOpen = untrack(() => song.instrumentsData.length);
    } else if (countAtOpen !== undefined) {
      if (untrack(() => song.instrumentsData.length) > countAtOpen) screen = 'edit';
      countAtOpen = undefined;
    }
  });
  // the selected instrument was removed (here or by someone else): back to the list
  $effect(() => {
    if (!hasInstrument && (screen === 'edit' || screen === 'rack')) screen = 'session';
  });

  const tabs = [
    { id: 'session', label: 'Session', icon: ListMusic },
    { id: 'edit', label: 'Edit', icon: LayoutGrid },
    { id: 'rack', label: 'Rack', icon: Waves },
    { id: 'patterns', label: 'Patterns', icon: Grid3x3 },
    { id: 'mixer', label: 'Mixer', icon: SlidersVertical }
  ] as const;
  const iconButton =
    'bg-surface-900 border-surface-700 flex size-11 flex-none items-center justify-center rounded-xl border';
</script>

<AddInstrumentModal bind:open={addOpen} bind:selectedIndex {dispatch} />

<div class="flex min-h-dvh flex-col pt-[env(safe-area-inset-top)]" data-testid="phone-app">
  <main class="flex flex-1 flex-col pb-40">
    {#if screen === 'session'}
      <header class="flex items-center gap-3 px-4 pt-3.5 pb-2.5">
        <div class="flex flex-1 flex-col">
          <span class="label-caps">{isHost ? 'Hosting jam' : 'Jam'}</span>
          <span class="font-mono text-lg font-semibold tracking-wider" data-testid="room-code"
            >{roomId}</span
          >
        </div>
        <span
          class="bg-surface-900 border-surface-700 flex h-11 items-center gap-2 rounded-xl border px-3 text-sm"
          title={store.status()}
          aria-label="{store.peers.length + 1} here"
        >
          <span
            class="size-2 rounded-full {store.peers.length ? 'bg-primary-500' : 'bg-surface-500'}"
          ></span>
          {store.peers.length + 1}
        </span>
        <ShareButton iconOnly />
      </header>
      <SessionView
        song={store.instrumentsData}
        {dispatch}
        {position}
        {playing}
        {selectedIndex}
        activity={store.activity}
        cues={store.cues}
        onSelect={(i) => open(i)}
        onAdd={() => (addOpen = true)}
      >
        {#snippet status()}
          <span
            class="size-2 rounded-full {store.peers.length ? 'bg-primary-500' : 'bg-surface-500'}"
          ></span>
          {#if hostOnly}
            <span data-testid="host-only-note">Sound from host · following the playhead</span>
          {:else}
            {isHost ? "You're hosting" : 'Joined'} · {store.peers.length === 0
              ? 'waiting for others'
              : `${store.peers.length} other${store.peers.length > 1 ? 's' : ''} here`}
          {/if}
        {/snippet}
      </SessionView>
      {#if debug}<div class="space-y-2 px-4 pt-6">{@render debug()}</div>{/if}
    {:else if screen === 'patterns'}
      <header class="flex items-center gap-3 px-5 pt-4 pb-3">
        <h1 class="flex-1 text-[22px] font-bold">Patterns</h1>
        {@render playButton()}
      </header>
      <div class="px-4">
        <PatternLauncher
          song={store.instrumentsData}
          cues={store.cues}
          {dispatch}
          {position}
          {playing}
          {hostOnly}
          onEdit={(i) => open(i)}
        />
      </div>
    {:else if screen === 'mixer'}
      <header class="flex items-center gap-3 px-5 pt-4 pb-3">
        <h1 class="flex-1 text-[22px] font-bold">Mixer</h1>
        {@render playButton()}
      </header>
      <div class="px-4"><Mixer song={store.instrumentsData} {dispatch} /></div>
      <section
        class="bg-surface-900 border-surface-700 mx-4 mt-4 space-y-2 rounded-2xl border p-3"
        aria-label="Sound settings"
      >
        <SettingsPanel {isHost} />
      </section>
    {:else if current}
      <!-- the instrument's colour becomes the primary colour, so its steps, knobs and buttons wear it -->
      <div class="flex flex-col" style:--color-primary-500={color}>
        <header class="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
          <button
            class={iconButton}
            aria-label="Back to tracks"
            onclick={() => (screen = 'session')}><ChevronLeft size={20} /></button
          >
          <span
            class="flex size-9 flex-none items-center justify-center rounded-lg text-xs font-bold text-[#0B0C0F] {current.state ===
            TrackState.Muted
              ? 'opacity-40'
              : ''}"
            style:background={color}>{trackInitials(current.name)}</span
          >
          <div class="flex min-w-0 flex-1 flex-col">
            <h1 class="truncate text-lg leading-tight font-bold">{current.name}</h1>
            <span class="text-surface-300 truncate text-xs"
              >{trackKind(current.instrumentName)} · {store.scale.scaleKey}
              {store.scale.scaleMode}{current.state === TrackState.Muted
                ? ' · muted'
                : current.state === TrackState.Solo
                  ? ' · solo'
                  : ''}</span
            >
          </div>
          {@render playButton()}
          <InstrumentMenu
            instrumentData={edit?.data ?? current}
            dispatch={edit?.dispatch ?? dispatch}
            buttonClass={iconButton}
          >
            {#snippet extra(close)}
              <button
                class="btn preset-tonal justify-start"
                onclick={() => {
                  if (edit) randomizeCommands(edit.data).forEach((c) => edit.dispatch(c));
                  close();
                }}><Dices size={16} /> Randomize</button
              >
              <button
                class="btn preset-tonal justify-start"
                aria-pressed={current.state === TrackState.Muted}
                onclick={() => {
                  dispatch(setTrackStateCommand(current, TrackState.Muted));
                  close();
                }}
                ><VolumeX size={16} />
                {current.state === TrackState.Muted ? 'Unmute' : 'Mute'}</button
              >
              <button
                class="btn preset-tonal justify-start"
                aria-pressed={current.state === TrackState.Solo}
                onclick={() => {
                  dispatch(setTrackStateCommand(current, TrackState.Solo));
                  close();
                }}
                ><Headphones size={16} />
                {current.state === TrackState.Solo ? 'Unsolo' : 'Solo'}</button
              >
            {/snippet}
          </InstrumentMenu>
        </header>

        <div class="flex gap-1.5 overflow-x-auto px-4 pb-3" role="group" aria-label="Instruments">
          {#each store.instrumentsData.instrumentsData as data, index (data.id)}
            <button
              class="flex h-11 flex-none items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold {index ===
              currentIndex
                ? 'bg-surface-800 border-surface-500'
                : 'border-surface-700'}"
              aria-current={index === currentIndex}
              title={data.name}
              onclick={() => (selectedIndex = index)}
            >
              <span class="size-2.5 rounded-sm" style:background={trackColor(index)}></span>
              {data.name}
            </button>
          {/each}
        </div>

        {#if screen === 'edit' && edit}
          <div class="space-y-4 px-4">
            <PatternSlots data={current} cues={store.cues} {color} />
            {#if cueing}
              <CueBanner data={current} cues={store.cues} {color} {position} {playing} {hostOnly} />
            {/if}
            <div class={cueing ? 'cue-edge rounded-2xl p-2' : ''} data-cue={cueing || undefined}>
              <InputViewSwitcher
                instrumentData={edit.data}
                index={currentIndex}
                dispatch={edit.dispatch}
                {position}
                {playing}
                {now}
                maxVisibleSteps={16}
              />
            </div>
            <QuickRack
              instrumentData={edit.data}
              dispatch={edit.dispatch}
              onOpenRack={() => (screen = 'rack')}
            />
          </div>
        {:else}
          <div class="flex items-center justify-between px-5 pb-2">
            <h2 class="text-[15px] font-bold">Rack</h2>
            <span class="text-surface-300 text-xs">tap a module's name to fold it</span>
          </div>
          <div class="px-4">
            <RackModules
              instrumentData={edit?.data ?? current}
              dispatch={edit?.dispatch ?? dispatch}
            />
          </div>
        {/if}
      </div>
    {/if}
  </main>

  <nav
    class="bg-surface-950/95 border-surface-700 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur"
    aria-label="Screens"
  >
    {#if needsTap}
      <button class="btn preset-filled-primary-500 w-full rounded-none py-3" onclick={onTap}>
        <Volume2 size={20} /> Tap to hear
      </button>
    {/if}
    <div class="grid grid-cols-5 px-1 pt-1.5 pb-3">
      {#each tabs as tab (tab.id)}
        {@const Icon = tab.icon}
        {@const disabled = (tab.id === 'edit' || tab.id === 'rack') && !hasInstrument}
        <button
          class="flex h-13 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold disabled:opacity-30 {screen ===
          tab.id
            ? 'text-primary-500'
            : 'text-surface-300'}"
          aria-current={screen === tab.id ? 'page' : undefined}
          {disabled}
          onclick={() => (screen = tab.id)}><Icon size={22} />{tab.label}</button
        >
      {/each}
    </div>
  </nav>
</div>

{#snippet playButton()}
  <button
    class="flex size-11 flex-none items-center justify-center rounded-xl {playing
      ? 'bg-surface-100 text-surface-950'
      : 'bg-primary-500 text-primary-contrast-500'}"
    aria-label={playing ? 'Pause' : 'Play'}
    onclick={() => dispatch({ type: 'transport', action: 'toggle' })}
  >
    {#if playing}<Pause size={20} fill="currentColor" />{:else}<Play
        size={20}
        fill="currentColor"
      />{/if}
  </button>
{/snippet}

<style>
  .label-caps {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-surface-300);
  }
</style>
