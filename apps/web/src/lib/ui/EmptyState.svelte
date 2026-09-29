<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, body, action }: { title: string; body?: string; action?: Snippet } = $props();
</script>

<div class="empty">
	<p>
		<b>{title}</b>
		{#if body}{body}{/if}
	</p>
	{#if action}<div class="action">{@render action()}</div>{/if}
</div>

<style>
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 18px 0;
	}

	p {
		margin: 0;
		max-width: 60ch;
		font-size: 14.5px;
		line-height: 1.55;
		color: var(--quiet);
	}

	b {
		font-weight: 600;
		color: var(--ink);
	}
</style>
