<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import { formatEventTime } from '$convex/events';
	import type { DocumentSlot, RequestView } from '$convex/requestView';
	import type { UploadSlot } from '$lib/uploads.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import ActivityQuestions from './ActivityQuestions.svelte';
	import BudgetLinePicker from './BudgetLinePicker.svelte';
	import BusinessPurposeCard from './BusinessPurposeCard.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { slotField } from './editor.svelte';
	import IdCardPicker from './IdCardPicker.svelte';
	import { shortDate, slotLabels } from './labels';
	import PurchaserPicker from './PurchaserPicker.svelte';
	import PurposeField from './PurposeField.svelte';
	import ReceiptFacts from './ReceiptFacts.svelte';
	import RecipientsEditor from './RecipientsEditor.svelte';
	import { effectiveCategories, hasFile, involves } from './steps';

	type Panel =
		| 'budget'
		| 'involves'
		| 'purpose'
		| 'event'
		| 'purchaser'
		| 'idCard'
		| 'recipients'
		| 'businessPurpose';

	let {
		editor,
		view,
		events,
		purchasers,
		budgetLines,
		fundLetter,
		recentPurposes,
		userName,
		organization,
		reading,
		locked,
		onfiles
	}: {
		editor: RequestEditor;
		view: RequestView;
		events: Doc<'events'>[];
		purchasers: Doc<'purchasers'>[];
		budgetLines: string[];
		fundLetter: string;
		recentPurposes: string[];
		userName: string;
		organization: Doc<'organizations'> | undefined;
		reading: boolean;
		locked: boolean;
		onfiles: (files: File[], slot: UploadSlot) => void;
	} = $props();

	let open = $state<Panel | null>(null);
	let picker = $state<HTMLInputElement | null>(null);
	let pickSlot = $state<DocumentSlot>('receipt');

	const form = $derived(editor.form);
	const purchase = $derived(view.purchase);
	const activity = $derived(form?.activity ?? purchase.activity);
	const categories = $derived(
		form === null ? [] : effectiveCategories(form, purchase.studentOrganization.fundLetter)
	);
	const involvesText = $derived(form === null ? '' : involves(form, fundLetter).join(', '));
	const self = $derived(form?.purchaserSource.kind === 'self');
	const giftish = $derived(
		categories.includes('gifts_prizes') || categories.includes('merchandise_apparel')
	);
	const documentSlots = $derived.by((): DocumentSlot[] => {
		const slots: DocumentSlot[] = ['receipt'];
		if (categories.includes('asuo_funds')) slots.push('publicity');
		if (self) slots.push('second_approval');
		if (categories.includes('food') || hasFile(form?.cateringWaiverFileId)) {
			slots.push('catering_waiver');
		}
		if (categories.includes('printing_services')) slots.push('printing_invoice');
		if (categories.includes('office_supplies_goods')) {
			slots.push('building_manager_approval', 'computer_price_quote');
		}
		if (categories.includes('merchandise_apparel')) slots.push('brand_approval');
		return slots;
	});

	function toggle(panel: Panel) {
		open = open === panel ? null : panel;
	}

	function filenameOf(slot: DocumentSlot) {
		if (form === null) return '';
		const ids =
			slot === 'receipt'
				? form.receiptFileIds
				: slot === 'recipient_list'
					? []
					: [form[slotField[slot]] as string | null];
		return view.documents
			.filter((document) => ids.includes(document.fileId))
			.map((document) => document.filename)
			.join(', ');
	}

	function documentValue(slot: DocumentSlot) {
		const name = filenameOf(slot);
		if (name !== '') return name;
		if (slot === 'catering_waiver' && purchase.foodIndividuallyPackaged === true) {
			return 'Not needed: sealed snacks';
		}
		if (
			slot === 'building_manager_approval' ||
			slot === 'computer_price_quote' ||
			slot === 'brand_approval'
		) {
			return 'Only if Engage asks';
		}
		return 'Still needed';
	}

	function pick(slot: DocumentSlot) {
		pickSlot = slot;
		picker?.click();
	}

	function commitDate(value: string) {
		editor.updateActivity({ dates: /^\d{4}-\d{2}-\d{2}$/.test(value) ? [value] : [] });
	}

	function commitAttendance(value: string) {
		const count = Math.round(Number(value.replace(/[^\d.]/g, '')));
		editor.updateActivity({ attendance: value.trim() === '' || !count ? null : count });
	}
</script>

{#snippet panel(name: Panel, content: import('svelte').Snippet)}
	{#if open === name && !locked}
		<div class="border-b border-(--line) py-4 sm:col-span-2">
			{@render content()}
		</div>
	{/if}
{/snippet}

{#snippet group(title: string, rows: import('svelte').Snippet)}
	<section class="flex flex-col" aria-label={title}>
		<h2 class="border-b border-(--ink) pb-2 text-base font-semibold text-(--ink)">{title}</h2>
		<div class="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-12">
			{@render rows()}
		</div>
	</section>
{/snippet}

<input
	bind:this={picker}
	class="hidden"
	type="file"
	accept="image/*,application/pdf,.heic,.heif"
	multiple={pickSlot === 'receipt'}
	onchange={(event) => {
		const files = Array.from(event.currentTarget.files ?? []);
		event.currentTarget.value = '';
		if (files.length > 0) onfiles(files, pickSlot);
	}}
/>

<div class="flex flex-col gap-10">
	{#snippet purchaseRows()}
		<div class="sm:col-span-2">
			<ReceiptFacts {editor} {reading} hero={false} {locked} />
		</div>
		<FieldRow
			label="Charged to"
			value={form?.budgetLineItem ?? ''}
			actionLabel="Change"
			readonly={locked}
			onaction={() => toggle('budget')}
		/>
		<FieldRow
			label="Involves"
			value={involvesText}
			placeholder="Nothing special"
			cue={editor.sourceOf('documentationCategories') === 'suggested' ? 'items' : undefined}
			actionLabel="Change"
			readonly={locked}
			onaction={() => toggle('involves')}
		/>
		{#snippet budgetPanel()}
			<BudgetLinePicker {editor} {budgetLines} onpicked={() => (open = null)} />
		{/snippet}
		{#snippet involvesPanel()}
			<CategoryPicker {editor} {fundLetter} />
		{/snippet}
		{@render panel('budget', budgetPanel)}
		{@render panel('involves', involvesPanel)}
		<FieldRow
			label="For"
			value={form?.purpose ?? ''}
			placeholder="What it was for"
			readonly={locked}
			onaction={() => toggle('purpose')}
		/>
		{#if categories.includes('office_supplies_goods')}
			<FieldRow
				label="Kept in"
				value={form?.officeLocation ?? ''}
				placeholder="Office or room"
				readonly={locked}
				oncommit={(value) => editor.update({ officeLocation: value })}
			/>
		{/if}
		{#snippet purposePanel()}
			<PurposeField {editor} {recentPurposes} autofocus />
		{/snippet}
		{@render panel('purpose', purposePanel)}
	{/snippet}
	{@render group('Purchase', purchaseRows)}

	{#snippet eventRows()}
		<FieldRow
			label="Event"
			value={activity.name}
			placeholder="Which event"
			cue={activity.name ? editor.sourceOf('activity') : undefined}
			actionLabel="Change"
			readonly={locked}
			onaction={() => toggle('event')}
		/>
		{#if activity.dates.length > 1}
			<FieldRow
				label="Dates"
				value={activity.dates.join(', ')}
				display={activity.dates.length + ' dates'}
				actionLabel="Change"
				readonly={locked}
				onaction={() => toggle('event')}
			/>
		{:else}
			<FieldRow
				label="Date"
				value={activity.dates[0] ?? ''}
				display={activity.dates[0] ? shortDate(activity.dates[0]) : ''}
				type="date"
				placeholder="When it happened"
				readonly={locked}
				oncommit={commitDate}
			/>
		{/if}
		<FieldRow
			label="Time"
			value={activity.time}
			display={formatEventTime(activity.time)}
			type="time"
			placeholder="Start time"
			readonly={locked}
			oncommit={(value) => editor.updateActivity({ time: value })}
		/>
		<FieldRow
			label="Room"
			value={activity.location}
			placeholder="Building and room"
			readonly={locked}
			oncommit={(value) => editor.updateActivity({ location: value })}
		/>
		<FieldRow
			label="Attendance"
			value={activity.attendance === null ? '' : String(activity.attendance)}
			display={activity.attendance === null ? '' : `about ${activity.attendance}`}
			type="number"
			placeholder="How many students"
			readonly={locked}
			oncommit={commitAttendance}
		/>
		<FieldRow
			label="Open to all"
			value={activity.openToAllStudents ? 'Yes' : 'No, members only'}
			actionLabel="Change"
			readonly={locked}
			onaction={() => editor.updateActivity({ openToAllStudents: !activity.openToAllStudents })}
		/>
		{#snippet eventPanel()}
			<ActivityQuestions {editor} {events} />
		{/snippet}
		{@render panel('event', eventPanel)}
	{/snippet}
	{@render group('Event', eventRows)}

	{#snippet peopleRows()}
		<FieldRow
			label="Paid by"
			value={self ? `You, ${form?.purchaser.name ?? userName}` : (form?.purchaser.name ?? '')}
			cue={editor.sourceOf('purchaserSource')}
			actionLabel="Change"
			readonly={locked}
			onaction={() => toggle('purchaser')}
		/>
		<FieldRow
			label="UO ID"
			value={hasFile(form?.purchaser.idCardFrontFileId) && hasFile(form?.purchaser.idCardBackFileId)
				? 'Front and back on file'
				: 'Still needed'}
			actionLabel={hasFile(form?.purchaser.idCardBackFileId) ? 'Replace' : 'Add'}
			readonly={locked}
			onaction={() => toggle('idCard')}
		/>
		<FieldRow
			label="Recipients"
			value={giftish
				? (form?.recipients ?? [])
						.map((recipient) => recipient.name)
						.filter(Boolean)
						.join(', ')
				: 'Not a gift or prize'}
			placeholder="Who received them"
			actionLabel="Change"
			readonly={locked || !giftish}
			onaction={() => toggle('recipients')}
		/>
		<FieldRow label="Requester" value={purchase.requester.name} readonly />
		{#snippet purchaserPanel()}
			<PurchaserPicker {editor} {purchasers} {userName} {organization} />
		{/snippet}
		{#snippet idPanel()}
			<IdCardPicker {editor} />
		{/snippet}
		{#snippet recipientsPanel()}
			<RecipientsEditor
				recipients={form?.recipients ?? []}
				onchange={(recipients, debounce) => editor.update({ recipients }, { debounce })}
			/>
		{/snippet}
		{@render panel('purchaser', purchaserPanel)}
		{@render panel('idCard', idPanel)}
		{@render panel('recipients', recipientsPanel)}
	{/snippet}
	{@render group('People', peopleRows)}

	{#snippet documentRows()}
		{#each documentSlots as slot (slot)}
			{@const has = filenameOf(slot) !== ''}
			<FieldRow
				label={slotLabels[slot]}
				value={documentValue(slot)}
				actionLabel={has ? (slot === 'receipt' ? 'Add' : 'Replace') : 'Add'}
				readonly={locked}
				onaction={() => pick(slot)}
			/>
		{/each}
	{/snippet}
	{@render group('Documents', documentRows)}

	{#snippet engageRows()}
		<FieldRow label="Type" value="Personal Reimbursement" readonly />
		<FieldRow label="Why reimburse" value={purchase.reimbursementReason} readonly />
		<div class="sm:col-span-2">
			<FieldRow
				label="Business Purpose"
				value={form?.businessPurposeOverride ?? view.businessPurposeText}
				placeholder="Written once the event facts are confirmed"
				actionLabel={open === 'businessPurpose' ? 'Close' : 'Customize'}
				readonly={locked}
				onaction={() => toggle('businessPurpose')}
			/>
		</div>
		{#snippet purposeCard()}
			<BusinessPurposeCard
				{editor}
				text={view.businessPurposeText}
				missing={view.businessPurposeMissing}
			/>
		{/snippet}
		{@render panel('businessPurpose', purposeCard)}
	{/snippet}
	{@render group('Engage fields', engageRows)}
</div>
