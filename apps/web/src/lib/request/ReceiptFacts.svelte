<script lang="ts">
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import SourceCue from '$lib/ui/SourceCue.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { parseMoney } from './editor.svelte';
	import { formatMoney, shortDate, type ReviewField } from './labels';
	import ReviewPrompt from './ReviewPrompt.svelte';

	let {
		editor,
		reading,
		hero = true,
		locked = false
	}: { editor: RequestEditor; reading: boolean; hero?: boolean; locked?: boolean } = $props();

	let editingTotal = $state(false);

	const form = $derived(editor.form);
	const reviewFor = $derived(
		Object.fromEntries(editor.reviews.map((review) => [review.field, review])) as Partial<
			Record<ReviewField, (typeof editor.reviews)[number]>
		>
	);
	const total = $derived(form?.totalAmount ?? null);

	function commitTotal(value: string) {
		editingTotal = false;
		const amount = parseMoney(value);
		void editor.resolveReview('totalAmount', amount === null ? '0' : String(amount));
	}

	function editRow(field: ReviewField) {
		if (field === 'totalAmount' && hero) {
			editingTotal = true;
			return;
		}
		document.querySelector<HTMLButtonElement>(`#row-${field} button`)?.click();
	}

	function commitItems(value: string) {
		if (reviewFor.itemDescription) void editor.resolveReview('itemDescription', value);
		else editor.update({ itemDescription: value });
	}
</script>

{#snippet review(field: ReviewField)}
	{@const pending = reviewFor[field]}
	{#if pending && !locked}
		<div class="border-b border-(--line) pb-3 sm:pl-[10rem]">
			<ReviewPrompt
				{field}
				value={pending.value}
				alternatives={pending.alternatives}
				onpick={(value) => void editor.resolveReview(field, value)}
				onother={() => editRow(field)}
			/>
		</div>
	{/if}
{/snippet}

{#snippet shimmerRow(label: string, width: string)}
	<div
		class="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 border-b border-(--line) py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
	>
		<span class="text-sm text-(--quiet)">{label}</span>
		<span class="shimmer h-5 {width} max-w-full" aria-label={`Reading the ${label.toLowerCase()}`}
		></span>
	</div>
{/snippet}

<section class="flex flex-col" aria-busy={reading} aria-label="Receipt">
	{#if hero}
		<div
			id="field-totalAmount"
			class="flex flex-col items-start gap-1 border-b border-(--line) pb-5"
		>
			<span class="flex items-baseline gap-2.5 text-sm text-(--quiet)">
				Total
				{#if !reviewFor.totalAmount && total !== null}
					<SourceCue source={editor.sourceOf('totalAmount')} />
				{/if}
			</span>
			{#if reading && total === null}
				<span class="shimmer h-12 w-48" aria-label="Reading the total"></span>
			{:else if editingTotal}
				<input
					class="w-48 border border-(--pine) bg-(--surface) px-2 py-1 text-4xl font-semibold tabular-nums outline-none"
					inputmode="decimal"
					aria-label="Total"
					value={total === null ? '' : total.toFixed(2)}
					onblur={(event) => commitTotal(event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key === 'Enter') commitTotal(event.currentTarget.value);
						if (event.key === 'Escape') editingTotal = false;
					}}
					{@attach (node) => {
						node.focus();
						node.select();
					}}
				/>
			{:else}
				<button
					class="-mx-1 px-1 text-left text-5xl font-semibold tracking-tight text-(--ink) tabular-nums hover:bg-(--pine-soft) focus-visible:outline-2 focus-visible:outline-(--pine) sm:text-6xl"
					class:marker={reviewFor.totalAmount !== undefined}
					type="button"
					aria-label={`Total: ${formatMoney(total) || 'not set'}. Edit`}
					onclick={() => (editingTotal = true)}
				>
					{#if total === null}<span class="text-3xl text-(--quiet)">Add total</span
						>{:else}{formatMoney(total)}{/if}
				</button>
			{/if}
			{#if reviewFor.totalAmount}
				<ReviewPrompt
					field="totalAmount"
					value={reviewFor.totalAmount.value}
					alternatives={reviewFor.totalAmount.alternatives}
					onpick={(value) => void editor.resolveReview('totalAmount', value)}
					onother={() => (editingTotal = true)}
				/>
			{/if}
		</div>
	{:else}
		<div id="row-totalAmount">
			<FieldRow
				label="Total"
				value={total === null ? '' : total.toFixed(2)}
				display={formatMoney(total)}
				type="money"
				placeholder="Add the total"
				cue={reviewFor.totalAmount ? undefined : editor.sourceOf('totalAmount')}
				readonly={locked}
				oncommit={commitTotal}
			/>
		</div>
		{@render review('totalAmount')}
	{/if}

	{#if reading && !form?.vendor}
		{@render shimmerRow('Store', 'w-48')}
	{:else}
		<div id="row-vendor">
			<FieldRow
				label="Store"
				value={form?.vendor ?? ''}
				placeholder="Where it was bought"
				cue={reviewFor.vendor || !form?.vendor ? undefined : editor.sourceOf('vendor')}
				readonly={locked}
				oncommit={(value) => void editor.resolveReview('vendor', value)}
			/>
		</div>
		{@render review('vendor')}
	{/if}

	{#if reading && !form?.itemDescription}
		{@render shimmerRow('Items', 'w-72')}
	{:else}
		<div id="row-itemDescription">
			<FieldRow
				label="Items"
				value={form?.itemDescription ?? ''}
				type="textarea"
				placeholder="What was bought"
				cue={reviewFor.itemDescription || !form?.itemDescription
					? undefined
					: editor.sourceOf('itemDescription')}
				readonly={locked}
				oncommit={commitItems}
			/>
		</div>
		{@render review('itemDescription')}
	{/if}

	{#if reading && !editor.receiptDate}
		{@render shimmerRow('Bought', 'w-28')}
	{:else}
		<div id="row-receiptDate">
			<FieldRow
				label="Bought"
				value={editor.receiptDate}
				display={editor.receiptDate ? shortDate(editor.receiptDate) : ''}
				type="date"
				placeholder="The date on the receipt"
				cue={reviewFor.receiptDate || !editor.receiptDate ? undefined : 'receipt'}
				readonly={locked}
				oncommit={(value) => void editor.resolveReview('receiptDate', value)}
			/>
		</div>
		{@render review('receiptDate')}
	{/if}
</section>

<style>
	.marker {
		background: linear-gradient(
			transparent 60%,
			var(--marker) 60%,
			var(--marker) 92%,
			transparent 92%
		);
	}
</style>
