<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BoardItem } from '$convex/authed/board';
	import { requestFacts } from '$lib/board/format';

	let {
		item,
		href,
		muted = false,
		children
	}: {
		item: BoardItem;
		href: string;
		muted?: boolean;
		children?: Snippet;
	} = $props();

	const facts = $derived(requestFacts(item));
	const title = $derived(
		item.vendor.trim() ||
			item.itemDescription.trim() ||
			(item.receiptCount > 0 ? 'Receipt added' : 'New request')
	);
	const detail = $derived(item.vendor.trim() ? facts.slice(1) : facts);
</script>

<li
	class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6"
	class:text-stone-500={muted}
>
	<a class="group flex min-w-0 flex-1 flex-col gap-0.5" {href}>
		<span class="truncate font-medium group-hover:underline group-hover:underline-offset-4">
			{title}
		</span>
		<span class="flex flex-wrap gap-x-3 text-sm text-stone-500 tabular-nums">
			{#each detail as part (part)}
				<span>{part}</span>
			{:else}
				<span>Nothing read yet</span>
			{/each}
		</span>
	</a>
	{#if children}
		<div class="flex shrink-0 items-center">{@render children()}</div>
	{/if}
</li>
