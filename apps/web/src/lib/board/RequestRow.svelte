<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { BoardItem } from '$convex/authed/board';
	import { formatDay, formatMoney, formatShortDate } from '$lib/board/format';

	let {
		item,
		href,
		fresh = false,
		next,
		actions
	}: {
		item: BoardItem;
		href: string;
		fresh?: boolean;
		next: Snippet<[BoardItem]>;
		actions?: Snippet<[BoardItem]>;
	} = $props();

	const title = $derived(
		item.vendor.trim() ||
			item.itemDescription.trim() ||
			(item.receiptCount > 0 ? 'Receipt added' : 'New request')
	);
	const meta = $derived(
		[
			item.totalAmount > 0 ? formatMoney(item.totalAmount) : '',
			item.budgetLineItem.trim(),
			item.receiptDate ? formatShortDate(item.receiptDate) : ''
		].filter((part) => part !== '')
	);
</script>

<li
	class="row relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 border-b border-line py-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_auto] sm:gap-5 sm:py-3.5"
	class:fresh
>
	<a class="min-w-0 after:absolute after:inset-0" {href}>
		<span class="title block truncate font-[560]">{title}</span>
		<span class="mt-0.5 flex flex-wrap gap-x-3 text-[13.5px] text-quiet tabular-nums">
			{#each meta as part, index (index)}
				<span>{part}</span>
			{:else}
				<span>Started {formatDay(item.updatedAt)}</span>
			{/each}
		</span>
	</a>
	<div
		class="col-span-2 row-start-2 flex min-w-0 items-center gap-2.5 text-[13.5px] sm:col-span-1 sm:row-start-auto sm:text-sm"
	>
		{@render next(item)}
	</div>
	<div
		class="relative col-start-2 row-start-1 flex items-center justify-end gap-3 sm:col-start-auto sm:row-start-auto sm:min-w-[150px]"
	>
		{@render actions?.(item)}
	</div>
</li>

<style>
	.row:hover .title {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.fresh {
		background: linear-gradient(90deg, var(--marker-soft), transparent 70%);
		animation: fresh 2.4s ease-out 1;
	}

	@keyframes fresh {
		from {
			background-color: var(--marker);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.fresh {
			animation: none;
		}
	}
</style>
