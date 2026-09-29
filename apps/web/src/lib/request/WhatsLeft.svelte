<script lang="ts">
	import type { UploadSlot } from '$lib/uploads.svelte';
	import type { RequestCheck } from '$convex/requestView';
	import FilePick from './FilePick.svelte';
	import PackagingQuestion from './PackagingQuestion.svelte';
	import type { LeftItem } from './whatsLeft';

	let {
		items,
		reading,
		ready,
		onjump,
		onfiles,
		onapproval,
		onconfirm,
		onpackaged
	}: {
		items: LeftItem[];
		reading: boolean;
		ready: boolean;
		onjump: (item: LeftItem) => void;
		onfiles: (files: File[], slot: UploadSlot) => void;
		onapproval: () => void;
		onconfirm: (checkId: string) => void;
		onpackaged: (packaged: boolean) => void;
	} = $props();

	function confirmLabel(check: RequestCheck) {
		if (check.id.startsWith('recipient-confirm')) return 'It’s theirs';
		if (check.id === 'approval-recheck') return 'Still matches';
		return 'It’s right';
	}

	function uploadLabel(check: RequestCheck) {
		return check.fileId !== null && check.slot !== 'receipt' ? 'Replace' : 'Add';
	}

	const collapsedCount = 3;
	let expanded = $state(false);
	const shown = $derived(expanded ? items : items.slice(0, collapsedCount));
	const hiddenCount = $derived(items.length - shown.length);
	const mobileCount = $derived(reading ? 1 : 2);
	const mobileHiddenCount = $derived(expanded ? 0 : Math.max(0, items.length - mobileCount));
</script>

<section id="whats-left" class="flex flex-col gap-3" aria-labelledby="left-heading">
	{#if items.length === 0 && ready}
		<h2 id="left-heading" class="text-lg font-semibold text-(--ink)">Everything’s here</h2>
		<p class="text-sm text-(--quiet)">Look it over, then fill it on Engage.</p>
	{:else}
		<h2 id="left-heading" class="text-lg font-semibold text-(--ink)">What’s left</h2>
		<ol class="flex flex-col border-t border-(--line)">
			{#if reading}
				<li class="flex items-center gap-3 border-b border-(--line) py-2 lg:py-3" role="status">
					<span class="pulse size-2 shrink-0 bg-(--marker-deep)" aria-hidden="true"></span>
					<span class="flex flex-col">
						<span class="text-sm font-medium text-(--ink)">Reading your receipt</span>
						<span class="text-sm text-(--quiet) max-lg:hidden"
							>The store, items, and total will fill in on their own.</span
						>
					</span>
				</li>
			{/if}
			{#each shown as item, index (item.key)}
				<li
					class={[
						'flex items-center gap-3 border-b border-(--line)',
						!expanded && 'compact',
						index >= mobileCount && !expanded && 'max-lg:hidden'
					]}
				>
					<span
						class={['size-2 shrink-0', item.blocking ? 'bg-(--ink)' : 'bg-(--marker-deep)']}
						aria-hidden="true"
					></span>
					{#if item.target.kind === 'link'}
						<a class="row" href={item.target.href}>
							<span class="text-sm font-medium text-(--ink)">{item.label}</span>
							<span class="detail text-sm text-(--quiet)">{item.detail}</span>
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
								<span class="detail text-sm text-(--quiet)">{item.detail}</span>
							</span>
							<span
								class="add shrink-0 border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink)"
								aria-hidden="true">Add</span
							>
						</FilePick>
						{#if slot === 'second_approval'}
							<button
								class="shrink-0 bg-(--pine) px-3 py-1.5 text-sm font-medium text-white hover:bg-(--pine-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
								type="button"
								onclick={onapproval}
							>
								Get it approved
							</button>
						{/if}
					{:else if item.target.kind === 'check' && item.target.check.action !== null}
						{@const check = item.target.check}
						{#if check.action === 'upload' && check.slot !== null}
							{@const slot = check.slot}
							<FilePick
								class="row-pick flex min-w-0 flex-1 items-center gap-3 py-3"
								label={item.label}
								multiple={slot === 'receipt'}
								onfiles={(files) => onfiles(files, slot)}
							>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="text-sm font-medium text-(--ink)">{item.label}</span>
									<span class="detail text-sm text-(--quiet)">{item.detail}</span>
								</span>
								<span
									class="add shrink-0 border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink)"
									aria-hidden="true">{uploadLabel(check)}</span
								>
							</FilePick>
						{:else}
							<span class="row">
								<span class="text-sm font-medium text-(--ink)">{item.label}</span>
								<span class="detail text-sm text-(--quiet)">{item.detail}</span>
							</span>
							{#if check.action === 'answer'}
								<PackagingQuestion value={null} onanswer={onpackaged} />
							{:else}
								<button
									class="shrink-0 border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink) hover:bg-(--ink) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
									type="button"
									onclick={() => onconfirm(check.id)}>{confirmLabel(check)}</button
								>
							{/if}
						{/if}
					{:else}
						<button class="row" type="button" onclick={() => onjump(item)}>
							<span class="text-sm font-medium text-(--ink)">{item.label}</span>
							{#if item.detail}<span class="detail text-sm text-(--quiet)">{item.detail}</span>{/if}
						</button>
					{/if}
				</li>
			{/each}
		</ol>
		{#if mobileHiddenCount > 0}
			<button
				class="self-start text-sm text-(--quiet) underline hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine) lg:hidden"
				type="button"
				onclick={() => (expanded = true)}
			>
				{mobileHiddenCount} more
			</button>
		{/if}
		{#if hiddenCount > 0}
			<button
				class="self-start text-sm text-(--quiet) underline hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine) max-lg:hidden"
				type="button"
				onclick={() => (expanded = true)}
			>
				{hiddenCount} more
			</button>
		{/if}
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

	@media (width < 64rem) {
		.compact .detail {
			display: none;
		}

		.compact .row,
		.compact :global(.row-pick) {
			padding-block: 0.5rem;
		}
	}

	button.row:hover span:first-child,
	a.row:hover span:first-child {
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
