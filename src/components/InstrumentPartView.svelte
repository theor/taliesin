<script lang="ts" generics="TPart extends InstrumentPartData">
  import type { Component } from 'svelte';
  import {
    type InstrumentPartTyped,
    store,
    type InstrumentData,
    type InstrumentPartData,
    type IPartViewProps
  } from '$lib';
  import { getPartType } from '$lib/Store.svelte';
  import { Pane } from 'svelte-tweakpane-ui';
  import { type Pane as TpPane } from 'tweakpane';
  interface Props {
    partData: TPart;
    instrumentData: InstrumentData;
    PartComponent: Component<IPartViewProps<InstrumentPartTyped<TPart>>>;
    partIndex: number;
    instrumentIndex: number;
  }
  let {
    instrumentIndex,
    partData = $bindable(),
    PartComponent,
    instrumentData = $bindable(),
    partIndex = 0
  }: Props = $props();

  let pane: TpPane = $state(undefined! as TpPane);

  $effect(() => {
    // console.log('PartView c', $effect.tracking(), partData, instrumentData, instrumentData.parts[partIndex]);
    // console.log(pane);
    pane.on('change', (e) => {
      // console.log('PartView pane change',e, partData);

      setTimeout(() => {
        store.updatePart(instrumentIndex, partIndex, partData);

      }, 100);
    });

    
    // console.log('PartView instrumentData', instrumentData);
    // console.log('PartView partIndex', partIndex);
  });
</script>

<Pane position="inline" title={partData.partName} bind:tpPane={pane}>
  <PartComponent
    part={getPartType(partData.partName) as InstrumentPartTyped<TPart>}
    bind:partData={partData}
  />
</Pane>
