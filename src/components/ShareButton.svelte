<script lang="ts">
  import { getGlobalContext } from '$lib/context';
  import { Share2Icon } from '@lucide/svelte';
  import { Modal } from '@skeletonlabs/skeleton-svelte';
  import QrCode from './QRCode.svelte';

  /** Copies the jam's join link and shows it as a QR code. `iconOnly` for the phone header. */
  let { iconOnly = false }: { iconOnly?: boolean } = $props();

  const ctx = getGlobalContext();
  const url = new URL(window.location.href.split('?')[0]);
  url.searchParams.set('join', 'true');
  url.searchParams.set('room', ctx.roomId);
  // diagnostics and the signalling network must match on every device, so the link carries them along
  const here = new URLSearchParams(window.location.search);
  if (here.has('debug')) url.searchParams.set('debug', '');
  if (here.get('signal')) url.searchParams.set('signal', here.get('signal')!);

  function share() {
    navigator.clipboard?.writeText(url.toString()).catch((err) => {
      console.error('Failed to copy network URL:', err);
    });
  }
  let open = $state(false);
</script>

<Modal
  {open}
  onOpenChange={(e) => (open = e.open)}
  onclick={share}
  triggerBase={iconOnly
    ? 'bg-surface-900 border-surface-700 flex size-11 items-center justify-center rounded-xl border'
    : 'bg-surface-100 text-surface-950 flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold'}
  triggerAriaLabel={iconOnly ? 'Share jam link' : ''}
  contentBase="card bg-surface-100-900 text-surface-contrast-100-900 p-4 space-y-4 shadow-xl max-w-screen-sm"
  backdropClasses="backdrop-blur-sm"
>
  {#snippet trigger()}
    {#if iconOnly}<Share2Icon size={20} />{:else}<Share2Icon size={16} /> Share{/if}
  {/snippet}
  {#snippet content()}
    <header class="flex justify-between">
      <h2 class="h3">Share this jam</h2>
    </header>
    <article class="space-y-3">
      <p>Link copied. Others can scan this code or open the link to join.</p>
      <QrCode value={url.toString()} className="justify-center" />
      <p class="font-mono text-sm break-all opacity-70">{url.toString()}</p>
    </article>
    <footer class="flex justify-end gap-4">
      <a type="button" target="_blank" class="btn preset-tonal" href={url.toString()}>Open link</a>
      <button type="button" class="btn preset-filled" onclick={() => (open = false)}>Close</button>
    </footer>
  {/snippet}
</Modal>
