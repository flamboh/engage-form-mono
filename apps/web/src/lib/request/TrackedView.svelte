<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import ActivityQuestions from './ActivityQuestions.svelte';
	import BudgetLinePicker from './BudgetLinePicker.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { monthDay, shortDate } from './labels';
	import PurposeField from './PurposeField.svelte';
	import ReceiptFacts from './ReceiptFacts.svelte';

	let {
		editor,
		reading,
		events,
		budgetLines,
		recentPurposes,
		finishAfter,
		deadline,
		today
	}: {
		editor: RequestEditor;
		reading: boolean;
		events: Doc<'events'>[];
		budgetLines: string[];
		recentPurposes: string[];
		finishAfter: string | null;
		deadline: string | null;
		today: string;
	} = $props();

	let changing = $state<'purpose' | 'budget' | 'event' | null>(null);

	const form = $derived(editor.form);
	const activity = $derived(form?.activity);
	const eventText = $derived(
		activity === undefined || activity.name.trim() === ''
			? ''
			: [activity.name, ...activity.dates.map(shortDate)].join(', ')
	);
	const eventAhead = $derived(finishAfter !== null && finishAfter > today);

	function toggle(section: 'purpose' | 'budget' | 'event') {
		changing = changing === section ? null : section;
	}
</script>

<div class="flex flex-col gap-8">
	<ReceiptFacts {editor} {reading} />

	{#if reading}
		<section class="flex flex-col gap-3" aria-labelledby="while-reading">
			<h2 id="while-reading" class="text-lg font-semibold text-(--ink)">
				While it reads: what’s it for?
			</h2>
			<PurposeField {editor} {recentPurposes} />
		</section>
	{:else}
		<section class="-mt-8 flex flex-col" aria-label="What it’s for">
			<FieldRow
				label="For"
				value={form?.purpose ?? ''}
				placeholder="What it was for"
				actionLabel={form?.purpose ? 'Edit' : 'Add'}
				onaction={() => toggle('purpose')}
			/>
			{#if changing === 'purpose'}
				<div class="border-b border-(--line) py-3 sm:pl-[10rem]">
					<PurposeField {editor} {recentPurposes} autofocus />
				</div>
			{/if}
			<FieldRow
				label="Charged to"
				value={form?.budgetLineItem ?? ''}
				placeholder="Pick a budget line"
				cue={editor.sourceOf('budgetLineItem')}
				actionLabel="Change"
				onaction={() => toggle('budget')}
			/>
			{#if changing === 'budget'}
				<div class="border-b border-(--line) py-3 sm:pl-[10rem]">
					<BudgetLinePicker {editor} {budgetLines} onpicked={() => (changing = null)} />
				</div>
			{/if}
			<FieldRow
				label="Event"
				value={eventText}
				placeholder="Which event it was for"
				cue={eventText ? editor.sourceOf('activity') : undefined}
				actionLabel={changing === 'event' ? 'Close' : 'Change'}
				onaction={() => toggle('event')}
			/>
			{#if changing === 'event'}
				<div class="border-b border-(--line) py-4">
					<ActivityQuestions {editor} {events} />
				</div>
			{/if}
		</section>

		<p class="note px-5 py-4 text-sm leading-relaxed text-(--ink)">
			<strong class="font-semibold">Nothing else to do today.</strong>
			{#if eventAhead && finishAfter !== null}
				Come back after {shortDate(finishAfter)}.
			{:else}
				Finish whenever you’re ready.
			{/if}
			{#if deadline !== null}
				Submit by <strong class="font-semibold">{monthDay(deadline)}</strong>: 30 days from the
				receipt.
			{/if}
		</p>
	{/if}
</div>

<style>
	.note {
		border: 1px solid var(--line);
		border-left: 3px solid var(--marker-deep);
		background: var(--surface);
	}
</style>
