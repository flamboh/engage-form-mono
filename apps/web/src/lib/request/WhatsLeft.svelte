<script lang="ts">
	import type { UploadSlot } from '$lib/uploads.svelte';
	import FilePick from './FilePick.svelte';
	import type { LeftItem } from './whatsLeft';

	let {
		items,
		reading,
		deferReceiptFields,
		onjump,
		onfiles
	}: {
		items: LeftItem[];
		reading: boolean;
		deferReceiptFields: boolean;
		onjump: (item: LeftItem) => void;
		onfiles: (files: File[], slot: UploadSlot) => void;
	} = $props();

	const visible = $derived(
		deferReceiptFields ? items.filter((item) => !item.waitsForReceipt) : items
	);
</script>

<section id="whats-left" class="flex flex-col gap-3" aria-labelledby="left-heading">
	{#if visible.length === 0 && !reading}
		<h2 id="left-heading" class="text-lg font-semibold text-(--ink)">Everything’s here</h2>
		<p class="text-sm text-(--quiet)">Look it over, then fill it on Engage.</p>
	{:else}
		<h2 id="left-heading" class="text-lg font-semibold text-(--ink)">What’s left</h2>
		<ol class="flex flex-col border-t border-(--line)">
			{#if reading}
				<li class="flex items-center gap-3 border-b border-(--line) py-3" role="status">
					<span class="pulse size-2 shrink-0 bg-(--marker-deep)" aria-hidden="true"></span>
					<span class="flex flex-col">
						<span class="text-sm font-medium text-(--ink)">Reading your receipt</span>
						<span class="text-sm text-(--quiet)"
							>The store, items, and total will fill in on their own.</span
						>
					</span>
				</li>
			{/if}
			{#each visible as item (item.key)}
				<li class="flex items-center gap-3 border-b border-(--line)">
					<span
						class={['size-2 shrink-0', item.blocking ? 'bg-(--ink)' : 'bg-(--marker-deep)']}
						aria-hidden="true"
					></span>
					{#if item.target.kind === 'link'}
						<a class="row" href={item.target.href}>
							<span class="text-sm font-medium text-(--ink)">{item.label}</span>
							<span class="text-sm text-(--quiet)">{item.detail}</span>
						</a>
					{:else if item.target.kind === 'slot'}
						{@const slot = item.target.slot}
						<FilePick
							class="row-pick flex min-w-0 flex-1 items-center gap-3 py-3"
							label={item.label}
							multiple={slot === 'receipt'}
							onfiles={(files) => onfiles(files, slot)}
						>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="text-sm font-medium text-(--ink)">{item.label}</span>
								<span class="text-sm text-(--quiet)">{item.detail}</span>
							</span>
							<span
								class="add shrink-0 border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink)"
								aria-hidden="true">Add</span
							>
						</FilePick>
					{:else}
						<button class="row" type="button" onclick={() => onjump(item)}>
							<span class="text-sm font-medium text-(--ink)">{item.label}</span>
							{#if item.detail}<span class="text-sm text-(--quiet)">{item.detail}</span>{/if}
						</button>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.row {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		padding: 0.75rem 0;
		text-align: left;
	}

	.row:hover span:first-child {
		text-decoration: underline;
	}

	:global(.row-pick:hover .add) {
		background: var(--ink);
		color: white;
	}

	.row:focus-visible {
		outline: 2px solid var(--pine);
		outline-offset: 2px;
	}

	.pulse {
		animation: pulse 1.4s ease-in-out infinite;
	}

	@keyframes pulse {
		50% {
			opacity: 0.3;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.pulse {
			animation: none;
		}
	}
</style>
