<script lang="ts">
	import { store } from '$lib';
	import { getInstrumentIcon } from '$lib/Store.svelte';
	import { Slider } from 'svelte-tweakpane-ui';
</script>

<div class="w-full grid grid-flow-col gap-2 auto-cols-min">
	{#each store.instrumentsData.instrumentsData as instrumentData, index}
        {@const Icon = getInstrumentIcon(instrumentData.instrumentName)}
		<div
			class="card preset-filled-surface-100-900 border-[1px] border-surface-200-800 card-hover divide-surface-200-800 block w-sm divide-y overflow-hidden"
		>
			<header class="flex flex-row gap-2 p-4">
                <Icon size="36"/>
				<h3 class="h3">{instrumentData.name}</h3>
			</header>
			<article class="space-y-4 p-4 h-64 overflow-y-auto">
				<Slider
                    label="Volume"
                    bind:value={instrumentData.volume}
                    min={0}
                    max={1}
                    step={0.01}
                    />
			</article>
		</div>
	{/each}
</div>
