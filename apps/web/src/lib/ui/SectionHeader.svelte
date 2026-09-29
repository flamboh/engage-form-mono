<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		count,
		hint,
		level = 2,
		action
	}: {
		title: string;
		count?: number;
		hint?: string;
		level?: 2 | 3;
		action?: Snippet;
	} = $props();
</script>

<div class="flex items-baseline gap-2.5 border-b border-ink pb-2.5">
	<svelte:element this={`h${level}`} class="text-[17px] font-[620] tracking-tight">
		{title}
	</svelte:element>
	{#if count !== undefined}
		<span class="text-[13.5px] text-quiet tabular-nums">{count}</span>
	{/if}
	{#if hint}
		<p class="ml-auto hidden text-[13px] text-quiet sm:block">{hint}</p>
	{/if}
	{#if action}
		<span class={hint ? '' : 'ml-auto'}>{@render action()}</span>
	{/if}
</div>
