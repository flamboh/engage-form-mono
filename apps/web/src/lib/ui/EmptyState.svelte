<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, body, action }: { title: string; body?: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-start gap-3 border border-line bg-surface px-6 py-8">
	<p class="text-lg font-semibold text-ink">{title}</p>
	{#if body}
		<p class="max-w-prose text-sm text-quiet">{body}</p>
	{/if}
	{#if action}
		{@render action()}
	{/if}
</div>
