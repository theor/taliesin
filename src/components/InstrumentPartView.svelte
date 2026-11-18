<script lang="ts">
  import { untrack, type Component } from 'svelte';
  import type { InstrumentPart, InstrumentPartData, IPartViewProps } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { diffFields } from '$lib/partFields';
  import { getPartType, partTitle } from '$lib/parts.svelte';
  import { getControlStyle } from '$lib/controlStyle';
  import { ChevronDown, Power } from '@lucide/svelte';

  interface Props {
    /** The part as it is in the song. Read-only here. */
    partData: InstrumentPartData;
    instrumentId: string;
    PartComponent: Component<IPartViewProps<InstrumentPart<any>>>;
    dispatch: Dispatch;
    /** A small caption in the rack module's header (the part's role, where no group header says it). */
    kicker?: string;
  }
  let { partData, instrumentId, PartComponent, dispatch, kicker }: Props = $props();

  const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  // The controls bind to a local copy of the part; the song itself is only changed by commands.
  // The copy follows the song, so edits by other peers (or randomize) show up in the controls.
  let draft = $state(copy($state.snapshot(partData)));
  $effect(() => {
    draft = copy($state.snapshot(partData));
  });
  // Whatever a control changed in the copy is sent as a command. Reads the song untracked: when the song
  // changes, the effect above refreshes the copy first, and the copy then equals the song (nothing to send).
  $effect(() => {
    const edited = $state.snapshot(draft);
    const song = untrack(() => $state.snapshot(partData));
    const fields = diffFields(song, edited);
    if (Object.keys(fields).length > 0) {
      untrack(() =>
        dispatch({ type: 'setPartFields', instrumentId, partName: partData.partName, fields })
      );
    }
  });

  const title = $derived(partTitle(partData.partName));

  const rack = getControlStyle() === 'rack';
  /** Parts that can be switched off have an `enabled` field; the rack puts its switch in the header. */
  const switchable = $derived(typeof (draft as { enabled?: unknown }).enabled === 'boolean');
  const enabled = $derived((draft as { enabled?: boolean }).enabled !== false);
  const setEnabled = (on: boolean) => ((draft as { enabled?: boolean }).enabled = on);
  /** A folded module still shows its settings in one line. */
  const summary = $derived(
    Object.entries(draft)
      .filter(
        ([k, v]) => k !== 'partName' && k !== 'enabled' && v !== null && typeof v !== 'object'
      )
      .slice(0, 3)
      .map(([, v]) => (typeof v === 'boolean' ? (v ? 'on' : 'off') : String(v)))
      .join(' · ')
  );
  // which modules are folded is this device's choice, remembered per part type
  const foldKey = (name: string) => `taliesin:rack-folded:${name}`;
  function loadFolded(name: string) {
    try {
      return localStorage.getItem(foldKey(name)) === '1';
    } catch {
      return false;
    }
  }
  let collapsed = $state(loadFolded(untrack(() => partData.partName)));
  function toggle() {
    collapsed = !collapsed;
    try {
      localStorage.setItem(foldKey(partData.partName), collapsed ? '1' : '0');
    } catch {
      // not remembering is fine
    }
  }
</script>

{#if rack}
  <!-- one module of the instrument's rack: a header that folds it, then its controls on a 4-column grid -->
  <section
    class="bg-surface-900 border-surface-700 rounded-2xl border"
    aria-label={title}
    data-part={partData.partName}
  >
    <div class="flex items-center">
      {#if switchable}
        <button
          type="button"
          class="flex size-11 flex-none items-center justify-center"
          aria-label="{title} on"
          aria-pressed={enabled}
          onclick={() => setEnabled(!enabled)}
        >
          <span
            class="flex size-6 items-center justify-center rounded-full {enabled
              ? 'bg-primary-500 text-primary-contrast-500'
              : 'bg-surface-800 border-surface-600 text-surface-300 border'}"
            ><Power size={13} strokeWidth={3} /></span
          >
        </button>
      {/if}
      <button
        type="button"
        class="flex min-h-11 flex-1 items-center gap-2 pr-3 text-left {switchable ? '' : 'pl-3'}"
        aria-expanded={!collapsed}
        onclick={toggle}
      >
        {#if !switchable}
          <span class="bg-primary-500 size-2 flex-none rounded-full" aria-hidden="true"></span>
        {/if}
        <span class="flex-1 text-xs font-bold tracking-[0.08em] uppercase">{title}</span>
        {#if collapsed}
          <span class="text-surface-300 max-w-[55%] truncate font-mono text-xs">{summary}</span>
        {:else if kicker}
          <span class="text-surface-400 text-[10px] font-semibold tracking-[0.08em] uppercase"
            >{kicker}</span
          >
        {/if}
        <ChevronDown
          size={16}
          class="text-surface-300 flex-none transition-transform {collapsed ? '-rotate-90' : ''}"
        />
      </button>
    </div>
    {#if !collapsed}
      <div
        class="grid grid-cols-4 gap-x-2 gap-y-3 px-3 pb-3 {enabled ? '' : 'opacity-60'}"
        data-testid="rack-controls"
      >
        <PartComponent part={getPartType(partData.partName)!} bind:partData={draft as any} />
      </div>
    {/if}
  </section>
{:else}
  <fieldset class="border-surface-200-800 rounded-container border px-3 pb-2">
    <legend class="px-1 text-xs font-semibold tracking-wide uppercase opacity-70">{title}</legend>
    <PartComponent part={getPartType(partData.partName)!} bind:partData={draft as any} />
  </fieldset>
{/if}
