<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import type { FundLetter } from '$lib/purchase/draftDetails';
	import Chip from './Chip.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { categoryOptions, formatDate } from './labels';
	import RecipientsEditor from './RecipientsEditor.svelte';
	import SourceCue from './SourceCue.svelte';

	let {
		editor,
		fundLetter,
		budgetLines,
		purchasers,
		templates,
		recentPurposes = [],
		userName,
		section
	}: {
		editor: RequestEditor;
		fundLetter: FundLetter;
		budgetLines: string[];
		purchasers: Doc<'purchasers'>[];
		templates: Doc<'businessPurposeTemplates'>[];
		recentPurposes?: string[];
		userName: string;
		section: 'why' | 'funding';
	} = $props();

	let showAllTemplates = $state(false);

	const form = $derived(editor.form);
	const categories = $derived(new Set(form?.documentationCategories ?? []));
	const asuoForced = $derived(fundLetter === 'I');
	const sortedTemplates = $derived([...templates].sort((a, b) => b.updatedAt - a.updatedAt));
	const visibleTemplates = $derived(
		showAllTemplates ? sortedTemplates : sortedTemplates.slice(0, 5)
	);
	const selectedTemplateId = $derived(
		sortedTemplates.find(
			(template) => template.businessPurposeTemplate === form?.businessPurposeText
		)?._id
	);
	const needsRecipients = $derived(
		categories.has('merchandise_apparel') || categories.has('gifts_prizes')
	);
	const purchaserIsSelf = $derived(form?.purchaserSource.kind === 'self');
	const purpose = $derived(form?.purpose ?? '');
	const purposeChips = $derived(
		recentPurposes.filter((item) => item.toLowerCase() !== purpose.trim().toLowerCase())
	);
	const usesPurpose = $derived((form?.businessPurposeText ?? '').includes('{Purpose}'));

	function addPurposeToSentence() {
		const text = (form?.businessPurposeText ?? '').trim();
		editor.update({
			businessPurposeText: `${text}${text === '' ? '' : ' '}It was for {Purpose}.`,
			businessPurposeTouched: true
		});
	}

	const selectedPurchaserId = $derived(
		form?.purchaserSource.kind === 'purchaser' ? form.purchaserSource.purchaserId : null
	);
</script>

{#if section === 'why'}
	<div class="flex flex-col gap-7">
		<div id="field-why" class="flex flex-col gap-3">
			<label class="text-lg font-semibold text-(--ink)" for="purpose-input">What was it for?</label>
			<input
				id="purpose-input"
				class="input"
				maxlength="200"
				autocomplete="off"
				placeholder="Prizes for trivia night"
				value={purpose}
				oninput={(event) => editor.update({ purpose: event.currentTarget.value }, { debounce: true })}
			/>
			{#if purposeChips.length > 0}
				<div class="flex flex-wrap items-center gap-2" aria-label="Recent answers">
					<span class="text-xs text-(--quiet)">Recent</span>
					{#each purposeChips as item (item)}
						<Chip onclick={() => editor.update({ purpose: item })}>{item}</Chip>
					{/each}
				</div>
			{/if}
			{#if purpose.trim() !== '' && !usesPurpose}
				<p class="text-sm text-(--quiet)">
					Your Business Purpose sentence doesn’t mention this yet.
					<button class="text-(--pine) underline" type="button" onclick={addPurposeToSentence}
						>Add it</button
					>
				</p>
			{/if}
			{#if sortedTemplates.length > 0}
				<div class="flex flex-col gap-2 pt-1">
					<span class="text-sm text-(--quiet)">Or start from a saved sentence</span>
					<div class="flex flex-wrap gap-2">
						{#each visibleTemplates as template (template._id)}
							<Chip
								selected={template._id === selectedTemplateId}
								disabled={editor.busy}
								onclick={() => void editor.applyTemplate(template._id)}
							>
								{template.title}
							</Chip>
						{/each}
						{#if sortedTemplates.length > visibleTemplates.length}
							<button
								class="px-2 text-sm text-(--quiet) underline hover:text-(--ink)"
								type="button"
								onclick={() => (showAllTemplates = true)}
							>
								{sortedTemplates.length - visibleTemplates.length} more
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<div id="field-activityDate" class="flex flex-col gap-1.5">
			<span class="flex items-baseline gap-2">
				<label class="text-sm font-medium text-(--ink)" for="activity-date">When was the event?</label>
				<SourceCue source={editor.sourceOf('activityDate')} />
			</span>
			<div class="flex flex-wrap items-center gap-2">
				<input
					id="activity-date"
					class="input max-w-56"
					type="date"
					value={form?.activityDate ?? ''}
					onchange={(event) => editor.update({ activityDate: event.currentTarget.value })}
				/>
				{#if !form?.activityDate && editor.receiptDate}
					<Chip onclick={() => editor.update({ activityDate: editor.receiptDate })}>
						Same day as the receipt, {formatDate(editor.receiptDate)}
					</Chip>
				{/if}
			</div>
		</div>

		<fieldset id="field-purchaser" class="flex flex-col gap-3">
			<legend class="mb-3 flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
				Who paid? <SourceCue source={editor.sourceOf('purchaserSource')} />
			</legend>
			<div class="flex flex-wrap gap-2">
				<Chip selected={purchaserIsSelf} onclick={() => editor.choosePurchaserSelf()}>
					Me{userName ? `, ${userName.split(' ')[0]}` : ''}
				</Chip>
				{#each purchasers as purchaser (purchaser._id)}
					<Chip
						selected={purchaser._id === selectedPurchaserId}
						onclick={() => editor.choosePurchaser(purchaser)}
					>
						{purchaser.name}
					</Chip>
				{/each}
				<a
					class="inline-flex min-h-9 items-center px-2 text-sm text-(--quiet) underline hover:text-(--ink)"
					href="/app/saved">Someone else</a
				>
			</div>
			{#if purchaserIsSelf && !form?.secondApprovalFileId}
				<p class="text-sm text-(--quiet)">
					Since you paid, another officer needs to approve it. Add their Second Approval with your
					documents.
				</p>
			{/if}
		</fieldset>

		{#if needsRecipients}
			<fieldset id="field-recipients" class="flex flex-col gap-3">
				<legend class="mb-3 text-lg font-semibold text-(--ink)">Who received them?</legend>
				<RecipientsEditor
					recipients={form?.recipients ?? []}
					onchange={(recipients, debounce) => editor.update({ recipients }, { debounce })}
				/>
			</fieldset>
		{/if}
	</div>
{:else}
	<div class="flex flex-col gap-7">
		<fieldset id="field-budget" class="flex flex-col gap-3">
			<legend class="mb-3 flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
				Which budget line? <SourceCue source={editor.sourceOf('budgetLineItem')} />
			</legend>
			<div class="flex flex-wrap gap-2">
				{#each budgetLines as line (line)}
					<Chip
						selected={form?.budgetLineItem === line}
						onclick={() => editor.update({ budgetLineItem: line })}
					>
						{line}
					</Chip>
				{/each}
			</div>
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-1 flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
				Does it involve any of these? <SourceCue
					source={editor.sourceOf('documentationCategories')}
				/>
			</legend>
			<p class="mb-2 text-sm text-(--quiet)">
				Each one tells Engage which extra documents to expect.
			</p>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each categoryOptions as option (option.value)}
					{@const forced = option.value === 'asuo_funds' && asuoForced}
					{@const on = forced || categories.has(option.value)}
					<label
						class="toggle flex cursor-pointer items-start gap-3 border px-3 py-2.5"
						class:is-on={on}
						class:is-forced={forced}
					>
						<input
							class="mt-1 size-4 accent-(--pine)"
							type="checkbox"
							checked={on}
							disabled={forced}
							onchange={(event) => editor.toggleCategory(option.value, event.currentTarget.checked)}
						/>
						<span class="flex flex-col">
							<span class="text-sm font-medium text-(--ink)">{option.label}</span>
							<span class="text-xs text-(--quiet)">
								{forced
									? 'Always on: this organization spends student fee money, so events must be promoted.'
									: option.hint}
							</span>
						</span>
					</label>
				{/each}
			</div>
		</fieldset>

		{#if categories.has('office_supplies_goods')}
			<label id="field-officeLocation" class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">Where will the supplies be kept?</span>
				<input
					class="input"
					value={form?.officeLocation ?? ''}
					placeholder="EMU 101"
					oninput={(event) =>
						editor.update({ officeLocation: event.currentTarget.value }, { debounce: true })}
				/>
			</label>
		{/if}
	</div>
{/if}

<style>
	.toggle {
		border-color: var(--line);
		background: white;
	}

	.toggle:focus-within {
		outline: 2px solid var(--pine);
		outline-offset: 2px;
	}

	.toggle.is-on {
		border-color: var(--pine);
		background: var(--pine-soft);
	}

	.toggle.is-forced {
		cursor: default;
	}
</style>
