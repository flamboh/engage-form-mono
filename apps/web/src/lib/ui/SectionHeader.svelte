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

<div class="section-header" class:small={level === 3}>
	<svelte:element this={`h${level}`} class="title">{title}</svelte:element>
	{#if count !== undefined}<span class="count">{count}</span>{/if}
	{#if hint || action}
		<div class="end">
			{#if hint}<p class="hint">{hint}</p>{/if}
			{#if action}{@render action()}{/if}
		</div>
	{/if}
</div>

<style>
	.section-header {
		display: flex;
		align-items: baseline;
		gap: 10px;
		border-bottom: 1px solid var(--ink);
		padding-bottom: 10px;
	}

	.title {
		margin: 0;
		font-size: 17px;
		font-weight: 620;
		letter-spacing: -0.005em;
	}

	.small {
		padding-bottom: 8px;
	}

	.small .title {
		font-size: 15px;
	}

	.count {
		font-size: 13.5px;
		color: var(--quiet);
		font-variant-numeric: tabular-nums;
	}

	.end {
		margin-left: auto;
		display: flex;
		align-items: baseline;
		gap: 14px;
	}

	.hint {
		margin: 0;
		font-size: 13px;
		color: var(--quiet);
	}

	@media (max-width: 640px) {
		.hint {
			display: none;
		}
	}
</style>
