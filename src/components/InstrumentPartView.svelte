<script lang="ts" generics="TPart extends InstrumentPartData">
  import { tick, type Component } from 'svelte';
  import type { InstrumentPartTyped, InstrumentPartData, IPartViewProps } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { diffFields } from '$lib/partFields';
  import { getPartType } from '$lib/Store.svelte';

  interface Props {
    /** The part as it is in the song. Read-only here. */
    partData: TPart;
    instrumentId: string;
    PartComponent: Component<IPartViewProps<InstrumentPartTyped<TPart>>>;
    dispatch: Dispatch;
  }
  let { partData, instrumentId, PartComponent, dispatch }: Props = $props();

  const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

  // The controls bind to a local copy of the part; the song itself is only changed by commands.
  // The copy follows the song, so edits by other peers (or randomize) show up in the controls.
  let draft = $state<TPart>(copy($state.snapshot(partData)) as TPart);
  $effect(() => {
    draft = copy($state.snapshot(partData)) as TPart;
  });

  /** "PartArpeggiator" -> "Arpeggiator", "PartTrackNotes" -> "Track notes" */
  const title = $derived(
    partData.partName
      .replace(/^Part/, '')
      .replace(/([a-z])([A-Z])/g, (_, a, b) => `${a} ${b.toLowerCase()}`)
  );

  /** The user changed a control: send what differs between the copy and the song. */
  async function onControlChange() {
    // let the control's new value reach the bound copy first
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
    const fields = diffFields(partData, draft);
    if (Object.keys(fields).length > 0) {
      dispatch({ type: 'setPartFields', instrumentId, partName: partData.partName, fields });
    }
  }
</script>

<!-- Input and change events bubble up from the controls; the draft is diffed into a command. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_click_events_have_key_events -->
<fieldset
  class="border-surface-200-800 rounded-container border px-3 pb-2"
  oninput={onControlChange}
  onchange={onControlChange}
  onclick={onControlChange}
>
  <legend class="px-1 text-xs font-semibold tracking-wide uppercase opacity-70">{title}</legend>
  <PartComponent
    part={getPartType(partData.partName) as InstrumentPartTyped<TPart>}
    bind:partData={draft}
  />
</fieldset>
