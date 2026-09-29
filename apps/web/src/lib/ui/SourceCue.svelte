<script lang="ts">
	import type { FieldSource } from '$lib/request/editor.svelte';

	let { source }: { source: FieldSource | 'event' | 'items' | undefined } = $props();

	const labels: Partial<Record<FieldSource | 'event' | 'items', string>> = {
		receipt: 'from receipt',
		previous: 'same as last time',
		suggested: 'suggested',
		event: 'from the event',
		items: 'from items'
	};
	const text = $derived(source === undefined ? '' : (labels[source] ?? ''));
	const read = $derived(source === 'receipt' || source === 'items');
</script>

{#if text}
	<span class="cue inline-flex items-center gap-1.5 text-xs text-(--quiet)">
		<span class="size-1.5 shrink-0" class:read aria-hidden="true"></span>{text}
	</span>
{/if}

<style>
	.cue {
		font-weight: 400;
		white-space: nowrap;
	}

	.cue > span {
		background: var(--marker-deep);
	}

	.cue > span.read {
		background: var(--pine);
	}
</style>
