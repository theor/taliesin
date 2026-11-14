<script lang="ts">
	import { store } from "$lib";
    import { getGlobalContext } from "$lib/context";
    import { RouterIcon, Share, ShareIcon } from "@lucide/svelte";
    import { Modal } from "@skeletonlabs/skeleton-svelte";
    import QrCode from "./QRCode.svelte";


    // const network = {
    //     id: '12345',
    //     status: 'active'
    // }; 
    const ctx = getGlobalContext();
    const url = new URL(window.location.href.split('?')[0]);
        url.searchParams.set('join', 'true');
        url.searchParams.set('room', ctx.roomId);

    function share() {
        navigator.clipboard.writeText(url.toString()).then(() => {
            console.log('Network URL copied to clipboard:', url.toString());
        }).catch(err => {
            console.error('Failed to copy network URL:', err);
        });
    }
    let showShareModal = $state(false);
</script>
<div class="flex items-center gap-4">
    <p></p>
    <p class="chip {store.host ? "preset-filled" : "preset-outlined"}">
        {#if store.host} <RouterIcon size=16/>{/if}
        {store.id().substring(0,4)}
    </p>
   


    <Modal
    open={showShareModal}  onOpenChange={(e) => (showShareModal = e.open)}
    contentBase="card bg-surface-100-900 text-surface-contrast-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
    backdropClasses="backdrop-blur-sm" backdropBackground="bg-primary-900-100"
  >
    {#snippet trigger()} <button class="btn btn-sm preset-filled-primary-500" onclick={share}>
        <ShareIcon size={16}/>
        Share
    </button>{/snippet}
    {#snippet content()}
      <header class="flex justify-between">
        <h2 class="h2">Sharing a jam</h2>
      </header>
      <article>
        <p class="text-4xl mb-4">
          Link copied to clipboard !
        </p>
        <p>
        <QrCode value={url.toString()} className="justify-center" />
    </p>
      </article>
      <footer class="flex justify-end gap-4">
        <a type="button" target="_blank" class="btn preset-filled-tonal" href={url.toString()}>Open link</a>
        <button type="button" class="btn preset-filled" onclick={() => showShareModal = false}>Close</button>
      </footer>
    {/snippet}
  </Modal>
    <p class="chip {store.status() === 'connected' ? 'preset-filled-success-500' : 'preset-outlined'}">
        {store.status()} · {store.peers.length}
    </p>

</div>
