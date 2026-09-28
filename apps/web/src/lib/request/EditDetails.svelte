<script lang="ts">
	import type { DocumentSlot } from '$convex/requestView';
	import type { UploadSlot } from '$lib/uploads.svelte';
	import DropTarget from './DropTarget.svelte';
	import type { Purchase, RequestEditor } from './editor.svelte';
	import { slotHints, slotLabels } from './labels';

	let {
		editor,
		purchase,
		optionalSlots,
		open = $bindable(false),
		onfiles
	}: {
		editor: RequestEditor;
		purchase: Purchase;
		optionalSlots: DocumentSlot[];
		open?: boolean;
		onfiles: (files: File[], slot: UploadSlot) => void;
	} = $props();

	const form = $derived(editor.form);
</script>

<details id="field-details" class="group border-t border-(--line)" bind:open>
	<summary
		class="flex cursor-pointer list-none items-center justify-between py-4 text-sm font-medium text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
	>
		Edit details
		<span class="text-(--quiet) transition-transform group-open:rotate-45" aria-hidden="true"
			>+</span
		>
	</summary>

	<div class="flex flex-col gap-8 pb-8">
		<div class="grid gap-5 sm:grid-cols-2">
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">Type of Purchase</span>
				<span class="text-sm text-(--quiet)">Personal Reimbursement</span>
			</div>
			<div class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">Reimbursement reason</span>
				<span class="text-sm text-(--quiet)"
					>{purchase.reimbursementReason || 'Filled in for you'}</span
				>
			</div>
			<label class="flex flex-col gap-1.5 sm:col-span-2">
				<span class="text-sm font-medium text-(--ink)">Item description</span>
				<textarea
					class="input min-h-20"
					value={form?.itemDescription ?? ''}
					oninput={(event) =>
						editor.update({ itemDescription: event.currentTarget.value }, { debounce: true })}
				></textarea>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">Store</span>
				<input
					class="input"
					value={form?.vendor ?? ''}
					oninput={(event) =>
						editor.update({ vendor: event.currentTarget.value }, { debounce: true })}
				/>
			</label>
			<label class="flex flex-col gap-1.5">
				<span class="text-sm font-medium text-(--ink)">Office location</span>
				<input
					class="input"
					value={form?.officeLocation ?? ''}
					oninput={(event) =>
						editor.update({ officeLocation: event.currentTarget.value }, { debounce: true })}
				/>
			</label>
		</div>

		{#if optionalSlots.length > 0}
			<div class="flex flex-col gap-2">
				<h3 class="text-sm font-medium text-(--ink)">Other documents</h3>
				{#each optionalSlots as slot (slot)}
					<DropTarget
						{slot}
						title={slotLabels[slot]}
						hint={slotHints[slot] ?? ''}
						compact
						{onfiles}
					/>
				{/each}
			</div>
		{/if}

		<div class="grid gap-6 sm:grid-cols-3">
			{@render facts('You', [
				purchase.requester.name,
				purchase.requester.email,
				purchase.requester.phone,
				purchase.requester.uo95
			])}
			{@render facts('Purchaser', [
				form?.purchaser.name ?? '',
				form?.purchaser.uo95 ?? '',
				form?.purchaser.permanentAddress ?? ''
			])}
			{@render facts('Student Organization', [
				purchase.studentOrganization.name,
				`Index ${purchase.studentOrganization.indexNumber}`,
				`Fund letter ${purchase.studentOrganization.fundLetter}`
			])}
		</div>
		<p class="text-xs text-(--quiet)">
			Change these on <a class="underline" href="/app/saved">your saved data</a>. New requests pick
			up the changes.
		</p>
	</div>
</details>

{#snippet facts(title: string, lines: string[])}
	<div class="flex flex-col gap-1">
		<span class="text-sm font-medium text-(--ink)">{title}</span>
		{#each lines.filter((line) => line.trim() !== '') as line, index (index)}
			<span class="text-sm break-words text-(--quiet)">{line}</span>
		{/each}
	</div>
{/snippet}
