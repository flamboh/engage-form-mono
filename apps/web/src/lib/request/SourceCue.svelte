<script lang="ts">
	import type { FieldSource } from './editor.svelte';

	let { source }: { source: FieldSource | undefined } = $props();

	const labels: Partial<Record<FieldSource, string>> = {
		receipt: 'from receipt',
		previous: 'same as last time',
		suggested: 'suggested'
	};
	const text = $derived(source === undefined ? '' : (labels[source] ?? ''));
</script>

{#if text}
	<span class="cue text-xs text-(--quiet)">{text}</span>
{/if}

<style>
	.cue {
		font-weight: 400;
		white-space: nowrap;
	}
</style>
