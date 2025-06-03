<script lang="ts">
  import { Tooltip } from '@skeletonlabs/skeleton-svelte';
  import { store } from '../lib/Store.svelte';

  let  ref: HTMLDivElement;
$effect(() =>{
  window.addEventListener('pointermove', e =>{
    if (ref) {
      ref.style.left = `${e.clientX}px`;
      ref.style.top = `${e.clientY}px`;
    }
  })
});
</script>

<div bind:this={ref} class="btn preset-filled w-32 h-32  fixed">AAAAAa</div>