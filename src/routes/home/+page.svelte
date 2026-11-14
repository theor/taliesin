<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { strudel } from '$lib';
  import { newRoomCode, parseRoom } from '$lib/room';

  // arriving here from a jam: make sure nothing keeps playing
  $effect(() => {
    const id = setTimeout(() => {
      try {
        strudel.stop();
      } catch {
        // the audio engine is not initialised yet: nothing to stop
      }
    }, 400);
    return () => clearTimeout(id);
  });

  let joinInput = $state('');
  let room = $derived(parseRoom(joinInput));
  const showError = $derived(joinInput.trim() !== '' && !room);

  const host = () => goto(`${base}/?host&room=${newRoomCode()}`);
  const join = () => room && goto(`${base}/?join&room=${encodeURIComponent(room)}`);
</script>

<main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
  <header class="space-y-1 text-center">
    <h1 class="h1">Taliesin</h1>
    <p class="opacity-60">Jam on a step sequencer with friends, in the browser.</p>
  </header>

  <section class="card preset-filled-surface-100-900 space-y-3 p-4">
    <h2 class="h3">Start a jam</h2>
    <p class="opacity-60">You keep the tempo; friends join with a link or a code.</p>
    <button type="button" class="btn btn-lg preset-filled-primary-500 w-full" onclick={host}>
      Start a jam
    </button>
  </section>

  <section class="card preset-filled-surface-100-900 space-y-3 p-4">
    <h2 class="h3">Join a jam</h2>
    <form
      class="space-y-3"
      onsubmit={(e) => {
        e.preventDefault();
        join();
      }}
    >
      <input
        class="input"
        placeholder="Paste a link or type a code"
        aria-label="Jam link or code"
        autocapitalize="characters"
        autocomplete="off"
        bind:value={joinInput}
      />
      {#if showError}
        <p class="text-error-500 text-sm">That doesn't look like a jam link or code.</p>
      {/if}
      <button type="submit" class="btn btn-lg preset-filled w-full" disabled={!room}>Join</button>
    </form>
  </section>
</main>
