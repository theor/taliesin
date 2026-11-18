<script lang="ts">
  import { store } from '$lib';
  import { RouterIcon, UsersIcon } from '@lucide/svelte';
  import ShareButton from './ShareButton.svelte';
</script>

<div class="flex items-center gap-2 sm:gap-4">
  <p class="chip {store.host ? 'preset-filled' : 'preset-outlined'}">
    {#if store.host}
      <RouterIcon size={16} />{/if}
    {store.host ? 'Host' : 'Guest'}<span class="hidden sm:inline">
      · {store.id().substring(0, 4)}</span
    >
  </p>
  <ShareButton />
  <p
    class="chip {store.status() === 'connected' ? 'preset-filled-success-500' : 'preset-outlined'}"
    title={store.status()}
  >
    <UsersIcon size={14} />
    <span class="hidden sm:inline">{store.status()} ·</span>
    {store.peers.length}
  </p>
</div>
