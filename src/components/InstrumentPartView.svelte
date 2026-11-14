<script lang="ts" generics="TPart extends InstrumentPartData">
  import { tick, type Component } from 'svelte';
  import type { InstrumentPartTyped, InstrumentPartData, IPartViewProps } from '$lib';
  import type { Dispatch } from '$lib/commands';
  import { diffFields } from '$lib/partFields';
  import { getPartType } from '$lib/Store.svelte';
  import { Pane } from 'svelte-tweakpane-ui';
  import { type Pane as TpPane } from 'tweakpane';

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

  let pane: TpPane = $state(undefined! as TpPane);

  /** The user changed a control: send what differs between the copy and the song. */
  async function onPaneChange() {
    // let the control's new value reach the bound copy first
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();
    const fields = diffFields(partData, draft);
    if (Object.keys(fields).length > 0) {
      dispatch({ type: 'setPartFields', instrumentId, partName: partData.partName, fields });
    }
  }
  $effect(() => {
    if (!pane) return;
    pane.on('change', onPaneChange);
    return () => pane.off('change', onPaneChange);
  });
</script>

<Pane position="inline" title={partData.partName} bind:tpPane={pane}>
  <PartComponent
    part={getPartType(partData.partName) as InstrumentPartTyped<TPart>}
    bind:partData={draft}
  />
</Pane>
