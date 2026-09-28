<script lang="ts">
	import type { RequestEditor } from './editor.svelte';
	import { parseMoney } from './editor.svelte';
	import EditableValue from './EditableValue.svelte';
	import { formatDate, formatMoney } from './labels';
	import ReviewPrompt from './ReviewPrompt.svelte';
	import SourceCue from './SourceCue.svelte';
	import type { ReviewField } from './whatsLeft';

	let { editor, reading }: { editor: RequestEditor; reading: boolean } = $props();

	let editing = $state<Record<ReviewField, boolean>>({
		vendor: false,
		totalAmount: false,
		receiptDate: false,
		itemDescription: false
	});

	const form = $derived(editor.form);
	const reviewFor = $derived(
		Object.fromEntries(editor.reviews.map((review) => [review.field, review])) as Partial<
			Record<ReviewField, (typeof editor.reviews)[number]>
		>
	);
	const total = $derived(form?.totalAmount ?? null);

	function commitTotal(value: string) {
		const amount = parseMoney(value);
		void editor.resolveReview('totalAmount', amount === null ? '0' : String(amount));
	}
</script>

<section class="flex flex-col gap-5" aria-labelledby="summary-heading" aria-busy={reading}>
	<h2 id="summary-heading" class="sr-only">Purchase</h2>

	<div id="field-totalAmount" class="flex flex-col items-start gap-1">
		<span class="flex items-baseline gap-2 text-sm text-(--quiet)">
			Total
			{#if !reviewFor.totalAmount && total !== null}
				<SourceCue source={editor.sourceOf('totalAmount')} />
			{/if}
		</span>
		{#if reading && total === null}
			<span class="shimmer h-11 w-40" aria-label="Reading the total"></span>
		{:else}
			<EditableValue
				class="text-4xl font-semibold tracking-tight text-(--ink) tabular-nums sm:text-5xl"
				label="Total"
				placeholder="Add total"
				value={total === null ? '' : total.toFixed(2)}
				display={formatMoney(total)}
				type="money"
				highlight={reviewFor.totalAmount !== undefined}
				bind:editing={editing.totalAmount}
				oncommit={commitTotal}
			/>
		{/if}
		{#if reviewFor.totalAmount}
			<ReviewPrompt
				field="totalAmount"
				value={reviewFor.totalAmount.value}
				alternatives={reviewFor.totalAmount.alternatives}
				onpick={(value) => void editor.resolveReview('totalAmount', value)}
				onother={() => (editing.totalAmount = true)}
			/>
		{/if}
	</div>

	<dl
		class="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-x-6"
	>
		<dt class="flex flex-col pt-0.5 text-sm text-(--quiet)">
			Store
			{#if !reviewFor.vendor && form?.vendor}<SourceCue source={editor.sourceOf('vendor')} />{/if}
		</dt>
		<dd id="field-vendor" class="min-w-0">
			{#if reading && !form?.vendor}
				<span class="shimmer block h-6 w-48" aria-label="Reading the store"></span>
			{:else}
				<EditableValue
					class="text-base font-medium text-(--ink)"
					label="Store"
					placeholder="Add store"
					value={form?.vendor ?? ''}
					highlight={reviewFor.vendor !== undefined}
					bind:editing={editing.vendor}
					oncommit={(value) => void editor.resolveReview('vendor', value)}
				/>
			{/if}
			{#if reviewFor.vendor}
				<ReviewPrompt
					field="vendor"
					value={reviewFor.vendor.value}
					alternatives={reviewFor.vendor.alternatives}
					onpick={(value) => void editor.resolveReview('vendor', value)}
					onother={() => (editing.vendor = true)}
				/>
			{/if}
		</dd>

		<dt class="flex flex-col pt-0.5 text-sm text-(--quiet)">
			Items
			{#if !reviewFor.itemDescription && form?.itemDescription}<SourceCue
					source={editor.sourceOf('itemDescription')}
				/>{/if}
		</dt>
		<dd id="field-itemDescription" class="min-w-0">
			{#if reading && !form?.itemDescription}
				<span class="shimmer block h-6 w-64 max-w-full" aria-label="Reading the items"></span>
			{:else}
				<EditableValue
					class="text-base text-(--ink)"
					label="Items"
					placeholder="Describe what was bought"
					value={form?.itemDescription ?? ''}
					highlight={reviewFor.itemDescription !== undefined}
					bind:editing={editing.itemDescription}
					oncommit={(value) =>
						reviewFor.itemDescription
							? void editor.resolveReview('itemDescription', value)
							: editor.update({ itemDescription: value })}
				/>
			{/if}
			{#if reviewFor.itemDescription}
				<ReviewPrompt
					field="itemDescription"
					value={reviewFor.itemDescription.value}
					alternatives={reviewFor.itemDescription.alternatives}
					onpick={(value) => void editor.resolveReview('itemDescription', value)}
					onother={() => (editing.itemDescription = true)}
				/>
			{/if}
		</dd>

		<dt class="pt-0.5 text-sm text-(--quiet)">Receipt date</dt>
		<dd id="field-receiptDate" class="min-w-0">
			{#if reading && !editor.receiptDate}
				<span class="shimmer block h-6 w-32" aria-label="Reading the receipt date"></span>
			{:else}
				<EditableValue
					class="text-base text-(--ink)"
					label="Receipt date"
					placeholder="Add date"
					type="date"
					value={editor.receiptDate}
					display={formatDate(editor.receiptDate)}
					highlight={reviewFor.receiptDate !== undefined}
					bind:editing={editing.receiptDate}
					oncommit={(value) => void editor.resolveReview('receiptDate', value)}
				/>
			{/if}
			{#if reviewFor.receiptDate}
				<ReviewPrompt
					field="receiptDate"
					value={reviewFor.receiptDate.value}
					alternatives={reviewFor.receiptDate.alternatives}
					onpick={(value) => void editor.resolveReview('receiptDate', value)}
					onother={() => (editing.receiptDate = true)}
				/>
			{/if}
		</dd>
	</dl>
</section>
