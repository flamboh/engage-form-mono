<script lang="ts">
	import type { RequestView } from '$convex/requestView';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import { formatMoney, monthDay, shortDate } from './labels';

	let {
		view,
		allDetailsHref
	}: {
		view: RequestView;
		allDetailsHref: string;
	} = $props();

	const purchase = $derived(view.purchase);
	const approved = $derived(purchase.status === 'approved');
	const eventDate = $derived(view.finishAfter);
	const filledOn = $derived(purchase.lastFilledAt === null ? '' : monthDay(purchase.lastFilledAt));
	const milestones = $derived([
		{
			label: 'Bought',
			value: purchase.receiptDate ? monthDay(purchase.receiptDate) : '',
			done: true
		},
		{ label: 'Event', value: eventDate === null ? '' : monthDay(eventDate), done: true },
		{ label: 'Filled', value: filledOn, done: purchase.lastFilledAt !== null },
		{
			label: 'Approved',
			value: purchase.approvedAt === null ? '' : monthDay(purchase.approvedAt),
			done: approved
		}
	]);
	const eventText = $derived(
		[purchase.activity.name, ...purchase.activity.dates.map(shortDate)].filter(Boolean).join(', ')
	);
</script>

<div class="flex flex-col gap-8">
	<section class="card flex flex-col gap-5 px-5 py-5 sm:px-6" aria-labelledby="status-heading">
		<div class="flex flex-col gap-1.5">
			<h2 id="status-heading" class="text-xl font-semibold tracking-tight text-(--ink)">
				{approved ? 'Approved' : 'Waiting on Engage'}
			</h2>
			<p class="max-w-prose text-sm leading-relaxed text-(--quiet)">
				{#if approved}
					Engage approved it, so the budget counts it as spent.
				{:else}
					You filled this{filledOn ? ` on ${filledOn}` : ''}. Student Org Finance reviews it next.
					When Engage shows it approved, mark it here so the budget counts it as spent.
				{/if}
			</p>
		</div>
		<ol class="grid grid-cols-4 gap-0" aria-label="Timeline">
			{#each milestones as milestone, index (milestone.label)}
				<li
					class={[
						'flex flex-col gap-0.5 border-t-2 pt-2 pr-2',
						milestone.done ? 'border-(--pine)' : 'border-dashed border-(--quiet)',
						index === milestones.length - 1 && 'pr-0'
					]}
				>
					<span class="text-sm font-semibold text-(--ink)">{milestone.label}</span>
					<span class="text-sm text-(--quiet)">{milestone.value || '—'}</span>
				</li>
			{/each}
		</ol>
	</section>

	<section class="flex flex-col" aria-label="Summary">
		<FieldRow label="Total" value={formatMoney(purchase.totalAmount)} readonly />
		<FieldRow label="Event" value={eventText} readonly />
		<FieldRow label="Charged to" value={purchase.budgetLineItem} readonly />
		<a
			class="mt-4 self-start text-sm text-(--quiet) underline underline-offset-3 hover:text-(--ink)"
			href={allDetailsHref}>Show all details</a
		>
	</section>
</div>

<style>
	.card {
		border: 1px solid var(--line);
		background: var(--surface);
	}
</style>
