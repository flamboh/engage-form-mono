<script lang="ts">
	import type { FieldSource } from './editor.svelte';

	let { source }: { source: FieldSource | undefined } = $props();

	const text = $derived(
		source === 'receipt' ? 'from receipt' : source === 'default' ? 'same as last time' : ''
	);
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
