<script lang="ts">
    import { goto } from '$app/navigation';
    import { strudel } from '$lib';
    import { Modal } from '@skeletonlabs/skeleton-svelte';
    $effect(() => {
        setTimeout(() => {
            strudel.stop();
            
        }, 400);
    });
  </script>
  
  <Modal
    open={true}
    contentBase="card bg-surface-100-900 text-surface-contrast-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
    backdropClasses="backdrop-blur-sm" backdropBackground="bg-primary-900-100"
  >
    {#snippet trigger()}Open Modal{/snippet}
    {#snippet content()}
      <header class="flex justify-between">
        <h2 class="h2">Modal Example</h2>
      </header>
      <article>
        <p class="opacity-60">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Nam, ab adipisci. Libero cumque sunt quis error veritatis amet, expedita
          voluptatem. Quos repudiandae consequuntur voluptatem et dicta quas, reprehenderit velit excepturi?
        </p>
      </article>
      <footer class="flex justify-center gap-4">
        <button type="button" class="btn btn-lg preset-filled-primary-500" onclick={() => goto(`/?host&room=${crypto.randomUUID()}`)}>Host</button>
        <!-- <button type="button" class="btn preset-filled" onclick={modalClose}>Confirm</button> -->
      </footer>
    {/snippet}
  </Modal>
