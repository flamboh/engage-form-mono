<script lang="ts">
	import type { Cue } from './types';

	let {
		source,
		label
	}: {
		source: Cue | undefined;
		label?: string;
	} = $props();

	const labels: Partial<Record<Cue, string>> = {
		receipt: 'from receipt',
		previous: 'same as last time',
		suggested: 'suggested',
		event: 'from the event',
		items: 'from items'
	};
	const text = $derived(label ?? (source === undefined ? '' : (labels[source] ?? '')));
</script>

{#if text}
	<span class="cue" class:document={source === 'receipt'}>{text}</span>
{/if}

<style>
	.cue {
		font-size: 12.5px;
		font-weight: 400;
		color: var(--quiet);
		white-space: nowrap;
	}

	.cue::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 5px;
		vertical-align: 1px;
		background: var(--marker-deep);
	}

	.document::before {
		background: var(--pine);
	}
</style>
