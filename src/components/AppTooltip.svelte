<script lang="ts">
  import { store } from '../lib/Store.svelte';
  import { Popover } from '@skeletonlabs/skeleton-svelte';
  import RoPopover from './ROPopover.svelte';
  import { onMount } from 'svelte';
  let pos = $state([100, 0]);
  onMount(() => {
    console.log('AppTooltip mounted');
    window.addEventListener('pointermove', (e: PointerEvent) => {
      pos = [e.clientX, e.clientY];
      // console.log('onpointermove', pos);
    });
  });

</script>

<!-- btn preset-filled w-32 h-32  fixed -->
<RoPopover
  {pos}
  open={true}
  positioning={{ placement: 'top' }}
  positionerClasses="pointer-events-none select-none touch-none"
  contentBase="card bg-surface-200-800/70 p-4 space-y-4 max-w-[320px]"
>
  <!-- {#snippet trigger()}
<button>Hello StackBlitz!</button>
{/snippet} -->
  {#snippet content()}
    <header class="flex justify-between">
      <p class="text-xl font-bold">Popover Example</p>
    </header>
    <article>
      <p class="opacity-60">
        This will display a basic popover with a header and body. This also includes a title,
        description, and close button.
      </p>
    </article>
  {/snippet}
</RoPopover>
