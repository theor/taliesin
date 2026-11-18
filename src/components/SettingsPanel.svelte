<script lang="ts">
  import { store } from '$lib';

  /** Who makes the sound, and acoustic calibration. Shown in the desktop settings popover and the phone mixer. */
  let { isHost }: { isHost: boolean } = $props();

  const calibration = store.calibration;
  const calibrationNote = $derived.by(() => {
    if (calibration.running) return 'Listening… keep the room quiet';
    return Object.values(calibration.results)
      .map((r) => (r.status === 'ok' ? `calibrated (${Math.round(r.delay * 1000)} ms)` : r.reason))
      .join(' · ');
  });
</script>

{#if isHost}
  <h3 class="h6">Who plays the sound</h3>
  <label class="flex items-start gap-2 text-sm">
    <input
      type="checkbox"
      class="checkbox mt-1"
      checked={store.transport.hostOnly}
      onchange={(e) => store.transport.setHostOnly(e.currentTarget.checked)}
    />
    <span>
      Only this device plays
      <span class="block text-xs opacity-70"
        >Everyone else follows the playhead but stays silent. Off: every device plays the song
        itself.</span
      >
    </span>
  </label>
{/if}
<h3 class="h6">Sound sync</h3>
{#if isHost}
  {#if store.peers.length > 0}
    <button
      class="btn preset-tonal w-full"
      disabled={calibration.running || store.transport.playing}
      title="The host's microphone listens while each device plays a test sound, so every device can be lined up with this one. Stop the song and keep the room quiet."
      onclick={() => calibration.run(store.peers)}>Calibrate</button
    >
    {#if calibrationNote}<p class="text-sm" data-testid="calibration-note">
        {calibrationNote}
      </p>{/if}
    <p class="text-xs opacity-70">
      Lines every device up with this one when they sit in the same room. Stop the song first and
      keep the room quiet.
    </p>
  {:else}
    <p class="text-sm opacity-70">Calibration is offered once someone has joined the jam.</p>
  {/if}
{:else if calibration.applied !== undefined}
  <button
    class="btn preset-outlined w-full"
    title="Calibrated by the host. Click to go back to the browser's own estimate."
    onclick={() => calibration.reset()}>Synced {Math.round(calibration.applied * 1000)} ms ✕</button
  >
{:else}
  <p class="text-sm opacity-70">The host can line this device up from their settings.</p>
{/if}
