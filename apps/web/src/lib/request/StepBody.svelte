<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import type { DocumentSlot, RequestCheck, RequestView } from '$convex/requestView';
	import type { UploadSlot } from '$lib/uploads.svelte';
	import Button from '$lib/ui/Button.svelte';
	import SourceCue from '$lib/ui/SourceCue.svelte';
	import ActivityQuestions from './ActivityQuestions.svelte';
	import BudgetLinePicker from './BudgetLinePicker.svelte';
	import BusinessPurposeCard from './BusinessPurposeCard.svelte';
	import CategoryPicker from './CategoryPicker.svelte';
	import DropTarget from './DropTarget.svelte';
	import type { RequestEditor } from './editor.svelte';
	import FilePick from './FilePick.svelte';
	import IdCardPicker from './IdCardPicker.svelte';
	import { slotHints, slotLabels } from './labels';
	import PackagingQuestion from './PackagingQuestion.svelte';
	import PurchaserPicker from './PurchaserPicker.svelte';
	import ReceiptFacts from './ReceiptFacts.svelte';
	import RecipientsEditor from './RecipientsEditor.svelte';
	import type { Step } from './steps';

	let {
		step,
		editor,
		view,
		events,
		purchasers,
		budgetLines,
		userName,
		organization,
		reading,
		onfiles,
		onapproval
	}: {
		step: Step;
		editor: RequestEditor;
		view: RequestView;
		events: Doc<'events'>[];
		purchasers: Doc<'purchasers'>[];
		budgetLines: string[];
		userName: string;
		organization: Doc<'organizations'> | undefined;
		reading: boolean;
		onfiles: (files: File[], slot: UploadSlot) => void;
		onapproval: () => void;
	} = $props();

	const form = $derived(editor.form);
	const food = $derived(
		(form?.documentationCategories ?? []).includes('food') ||
			view.purchase.foodIndividuallyPackaged != null
	);
	const optionalSlots = $derived.by((): DocumentSlot[] => {
		const categories = form?.documentationCategories ?? [];
		const slots: DocumentSlot[] = [];
		if (categories.includes('printing_services')) slots.push('printing_invoice');
		if (categories.includes('office_supplies_goods')) {
			slots.push('building_manager_approval', 'computer_price_quote');
		}
		if (categories.includes('merchandise_apparel')) slots.push('brand_approval');
		return slots;
	});
	const notes = $derived(step.checks.filter((check) => check.action !== 'answer'));
	const reasons = $derived(
		step.blockingReasons.filter((reason) => !notes.some((check) => check.title === reason))
	);

	function confirmLabel(check: RequestCheck) {
		if (check.id.startsWith('recipient-confirm')) return 'It’s theirs';
		if (check.id === 'approval-recheck') return 'Still matches';
		return 'It’s right';
	}
</script>

{#snippet checkList()}
	{#if notes.length > 0}
		<ul class="flex flex-col gap-2">
			{#each notes as check (check.id)}
				<li
					class={[
						'flex flex-wrap items-center justify-between gap-3 border-l-2 bg-(--surface) px-3 py-2.5',
						check.severity === 'blocking' ? 'border-(--alert)' : 'border-(--marker-deep)'
					]}
				>
					<span class="flex min-w-0 flex-col">
						<span class="text-sm font-medium text-(--ink)">{check.title}</span>
						<span class="text-sm text-(--quiet)">{check.detail}</span>
					</span>
					{#if check.action === 'confirm'}
						<Button
							variant="secondary"
							size="sm"
							onclick={() => void editor.confirmCheck(check.id)}
						>
							{confirmLabel(check)}
						</Button>
					{:else if check.action === 'upload' && check.slot !== null}
						{@const slot = check.slot}
						<FilePick
							class="inline-flex min-h-8 shrink-0 items-center border border-(--ink) bg-(--surface) px-3 text-sm font-semibold text-(--ink)"
							label={`${check.fileId === null ? 'Add' : 'Replace'} ${slotLabels[slot]}`}
							multiple={slot === 'receipt'}
							onfiles={(files) => onfiles(files, slot)}
						>
							{check.fileId !== null && slot !== 'receipt' ? 'Replace' : 'Add'}
						</FilePick>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet reasonList()}
	{#if reasons.length > 0}
		<ul class="flex flex-col gap-1 text-sm text-(--ink)">
			{#each reasons as reason (reason)}
				<li class="flex items-baseline gap-2">
					<span class="size-2 shrink-0 bg-(--marker-deep)" aria-hidden="true"></span>
					{#if /^Finish (your profile|the organization details)/.test(reason)}
						<a class="underline underline-offset-3" href="/app/settings">{reason}</a>
					{:else}
						{reason}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

{#snippet looksRight(fields: ('activity' | 'purchaserSource')[])}
	{#if step.state !== 'done' && step.blockingReasons.length === 0}
		<div>
			<Button
				variant="secondary"
				size="sm"
				data-advance
				onclick={() => void editor.confirmFields(fields)}
			>
				Looks right
			</Button>
		</div>
	{/if}
{/snippet}

<div class="flex flex-col gap-4">
	{#if step.id === 'receipt'}
		{#if (form?.receiptFileIds.length ?? 0) === 0 && !reading}
			<DropTarget slot="receipt" label="Drop a photo or PDF of the receipt" multiple {onfiles} />
		{/if}
		<ReceiptFacts {editor} {reading} hero={false} />
		<div class="flex flex-col gap-2">
			<span class="text-sm text-(--quiet)">Charged to</span>
			<BudgetLinePicker {editor} {budgetLines} />
		</div>
		{@render checkList()}
	{:else if step.id === 'categories'}
		{@const fundLetter = view.purchase.studentOrganization.fundLetter}
		{@const source = editor.sourceOf('documentationCategories')}
		{@const picked = (form?.documentationCategories ?? []).some(
			(category) => category !== 'asuo_funds' || fundLetter !== 'I'
		)}
		<p class="text-sm text-(--quiet)">
			Food, prizes, printing and a few others need extra documents. Tap any that apply.
			<SourceCue
				source={source === 'suggested' ? 'items' : source === 'previous' ? source : undefined}
			/>
		</p>
		<CategoryPicker {editor} {fundLetter} />
		{#if step.state !== 'done'}
			<div>
				<Button
					variant="secondary"
					size="sm"
					data-advance
					onclick={() => void editor.confirmFields(['documentationCategories'])}
				>
					{picked ? 'Looks right' : 'Nothing special'}
				</Button>
			</div>
		{/if}
	{:else if step.id === 'event'}
		<ActivityQuestions {editor} {events} />
		{@render looksRight(['activity'])}
	{:else if step.id === 'purchaser'}
		<PurchaserPicker {editor} {purchasers} {userName} {organization} />
		{#if form?.purchaserSource.kind === 'self'}
			<p class="text-sm text-(--quiet)">Since you paid, another officer approves it below.</p>
		{/if}
		{@render looksRight(['purchaserSource'])}
	{:else if step.id === 'idCard'}
		<p class="text-sm text-(--quiet)">
			{form?.purchaserSource.kind === 'self'
				? 'Engage needs both sides of your UO ID card to reimburse you. We keep them in Settings for next time.'
				: 'Engage needs both sides of their UO ID card to reimburse them. We save them with their details.'}
		</p>
		<IdCardPicker {editor} />
	{:else if step.id === 'packaging'}
		<p class="text-sm text-(--quiet)">
			Sealed single-serving snacks and canned drinks don’t need a catering waiver. A shared tray or
			anything served does.
		</p>
		<PackagingQuestion
			value={view.purchase.foodIndividuallyPackaged ?? null}
			onanswer={(packaged) => void editor.answerFoodPackaging(packaged)}
		/>
	{:else if step.id === 'cateringWaiver'}
		<p class="text-sm text-(--quiet)">
			Food that wasn’t individually packaged needs a signed waiver from University Catering.
		</p>
		{#if form?.cateringWaiverFileId == null}
			<DropTarget slot="catering_waiver" label="Drop the signed catering waiver" {onfiles} />
		{/if}
		{@render checkList()}
	{:else if step.id === 'recipients'}
		<RecipientsEditor
			recipients={form?.recipients ?? []}
			onchange={(recipients, debounce) => editor.update({ recipients }, { debounce })}
		/>
		{@render reasonList()}
		{@render checkList()}
	{:else if step.id === 'officeLocation'}
		<label class="flex max-w-md flex-col gap-1.5">
			<span class="text-sm text-(--quiet)">An office or room on campus</span>
			<input
				class="input"
				value={form?.officeLocation ?? ''}
				placeholder="EMU 101"
				oninput={(event) =>
					editor.update({ officeLocation: event.currentTarget.value }, { debounce: true })}
			/>
		</label>
	{:else if step.id === 'publicity'}
		<p class="text-sm text-(--quiet)">
			ASUO-funded events need proof they were advertised a week ahead. It should name the date{food
				? ' and mention snacks'
				: ''}.
		</p>
		{#if form?.publicityFileId == null}
			<DropTarget slot="publicity" label="Drop the flyer or a screenshot of the post" {onfiles} />
		{/if}
		{@render checkList()}
	{:else if step.id === 'secondApproval'}
		{#if form?.secondApprovalFileId == null}
			<p class="text-sm text-(--quiet)">
				We’ll write the email with this purchase’s items, total and event. Send it to another signer
				and drop their reply here.
			</p>
			<div class="flex flex-wrap items-center gap-3">
				<Button variant="primary" size="sm" onclick={onapproval}>Get it approved</Button>
				<FilePick
					class="inline-flex min-h-[2.125rem] items-center border border-(--ink) bg-(--surface) px-3 text-sm font-semibold text-(--ink)"
					label="Add their reply"
					onfiles={(files) => onfiles(files, 'second_approval')}
				>
					I have their reply
				</FilePick>
			</div>
		{/if}
		{@render checkList()}
	{:else if step.id === 'otherDocs'}
		{#each optionalSlots as slot (slot)}
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">{slotLabels[slot]}</span>
				<DropTarget {slot} label={slotHints[slot] ?? ''} {onfiles} />
			</div>
		{/each}
		{@render checkList()}
	{:else if step.id === 'review'}
		{@render reasonList()}
		<BusinessPurposeCard
			{editor}
			text={view.businessPurposeText}
			missing={view.businessPurposeMissing}
		/>
	{/if}
</div>
