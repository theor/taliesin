<script lang="ts">
	import { fade } from 'svelte/transition';

	import * as popover from '@zag-js/popover';
	import { portal, useMachine, normalizeProps, mergeProps } from '@zag-js/svelte';
	import type { PopoverProps } from './types.js';

	const {
		arrow = false,
		zIndex = 'auto',
		// Base
		base = '',
		classes = '',
		// Trigger
		triggerBase = '',
		triggerBackground = '',
		triggerClasses = '',
		triggerAriaLabel = '',
		// Positioner
		positionerBase = '',
		positionerClasses = '',
		// Content
		contentBase = '',
		contentBackground = '',
		contentClasses = '',
		// Arrow
		arrowBase = '',
		arrowBackground = '!bg-surface-200 dark:!bg-surface-800',
		arrowClasses = '',
		// Snippets
		trigger,
		content,
		// Events
		onclick,
        pos,
		// Zag ---
		...zagProps
	}: PopoverProps & {pos: [number,number]} = $props();

    let triggerRef: HTMLElement = undefined!;
	// Zag
	const id = $props.id();
	const service = useMachine(popover.machine, () => ({
		id: id,
		...zagProps
	}));
	const api = $derived(popover.connect(service, normalizeProps));
	const triggerProps = $derived(mergeProps(api.getTriggerProps(), { onclick }));
	const contentProps = $derived(mergeProps(api.getContentProps(), {  }));
    $effect(() => {
        console.log($state.snapshot(pos));
        triggerRef.style.top = `${pos[1].toFixed()}px`;
        triggerRef.style.left = `${pos[0].toFixed()}px`;
    });
</script>

<span class="{base} {classes}" data-testid="popover">
	<!-- Snippet: Trigger -->
		<button bind:this={triggerRef} {...triggerProps} class="w-1 h-1 {triggerBase} {triggerBackground} {triggerClasses}" type="button" aria-label={triggerAriaLabel} style="position:fixed;">
		</button>
	<!-- Portal -->
	<div use:portal={{ disabled: !api.portalled }} {...api.getPositionerProps()} class="{positionerBase} {positionerClasses}">
		<!-- Popover -->
		{#if api.open}
			<div {...contentProps} transition:fade={{ duration: 100 }} style="z-index: {zIndex};" >
				<!-- Arrow -->
				{#if arrow}
					<div {...api.getArrowProps()}>
						<div {...api.getArrowTipProps()} class="{arrowBase} {arrowBackground} {arrowClasses}"></div>
					</div>
				{/if}
				<!-- Snippet: Content -->
				<div class="{contentBase} {contentBackground} {contentClasses}">{@render content?.()}</div>
			</div>
		{/if}
	</div>
</span>

<style>
	:global([data-part='arrow']) {
		--arrow-size: 10px;
	}
    :global([data-part='content']) {
        pointer-events: none !important;
    }
</style>
