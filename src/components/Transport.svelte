<script lang="ts">
	import { Play, Square, Ban } from '@lucide/svelte';
	import { strudel } from '$lib';
    let isPlaying = strudel.isPlaying;
</script>

<div>
	<button on:click={() => strudel.toggle()}>
		{#if $isPlaying}
			<Square size={20} />
		{:else}
			<Play size={20} />
		{/if}
        </button>
		<!-- stop -->
		<button on:click={() => strudel.stop()}><Ban size={20} /></button>
	
</div>
