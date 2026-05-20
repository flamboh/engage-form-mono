<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import FilePicker from '$lib/purchase/FilePicker.svelte';
	import { requirementPanelsFor, type DocumentationCategory, type FundLetter } from './builderFlow';

	type Recipient = { name: string; uo95: string; reason: string; value: number };
	type UploadKind =
		| 'receipt'
		| 'second_approval'
		| 'publicity'
		| 'catering_waiver'
		| 'printing_invoice'
		| 'brand_approval'
		| 'building_manager_approval'
		| 'computer_price_quote';

	type Props = {
		documentationCategories: DocumentationCategory[];
		fundLetter: FundLetter;
		purchaserIsSelf: boolean;
		recipients: Recipient[];
		receiptFileIds: Id<'files'>[];
		secondApprovalFileId: Id<'files'> | null;
		publicityFileId: Id<'files'> | null;
		cateringWaiverFileId: Id<'files'> | null;
		printingInvoiceFileId: Id<'files'> | null;
		brandApprovalFileId: Id<'files'> | null;
		officeLocation: string;
		buildingManagerApprovalFileId: Id<'files'> | null;
		computerPriceQuoteFileId: Id<'files'> | null;
		uploadRequestFile: (kind: UploadKind, input: HTMLInputElement) => Promise<void>;
		onChange: () => void;
	};

	let {
		documentationCategories,
		fundLetter,
		purchaserIsSelf,
		recipients = $bindable(),
		receiptFileIds,
		secondApprovalFileId,
		publicityFileId,
		cateringWaiverFileId,
		printingInvoiceFileId,
		brandApprovalFileId,
		officeLocation = $bindable(),
		buildingManagerApprovalFileId,
		computerPriceQuoteFileId,
		uploadRequestFile,
		onChange
	}: Props = $props();

	const panels = $derived(
		requirementPanelsFor({
			categories: documentationCategories,
			fundLetter,
			purchaserIsSelf
		})
	);

	function addRecipient() {
		recipients = [...recipients, { name: '', uo95: '', reason: '', value: 0 }];
		onChange();
	}

	function removeRecipient(index: number) {
		recipients = recipients.filter((_, itemIndex) => itemIndex !== index);
		onChange();
	}
</script>

{#each panels as panel (panel.id)}
	<section class="panel">
		<div class="flex items-center justify-between gap-3">
			<h2>{panel.title}</h2>
			<span class="text-xs font-medium text-stone-500">
				{panel.required ? 'Required' : 'Optional'}
			</span>
		</div>

		{#if panel.id === 'receipts'}
			<FilePicker
				label="Receipts"
				multiple
				status={`${receiptFileIds.length}/3 uploaded`}
				onFiles={(input) => uploadRequestFile('receipt', input)}
			/>
		{:else if panel.id === 'publicity'}
			<FilePicker
				label="Publicity proof"
				status={publicityFileId ? 'Uploaded' : 'Required'}
				onFiles={(input) => uploadRequestFile('publicity', input)}
			/>
		{:else if panel.id === 'catering_waiver'}
			<FilePicker
				label="Catering waiver"
				status={cateringWaiverFileId ? 'Uploaded' : 'Required'}
				onFiles={(input) => uploadRequestFile('catering_waiver', input)}
			/>
		{:else if panel.id === 'printing_invoice'}
			<FilePicker
				label="Printing invoice"
				status={printingInvoiceFileId ? 'Uploaded' : 'Required'}
				onFiles={(input) => uploadRequestFile('printing_invoice', input)}
			/>
		{:else if panel.id === 'office_location'}
			<label>
				<span>Office location</span>
				<input class="field" bind:value={officeLocation} oninput={onChange} />
			</label>
		{:else if panel.id === 'building_manager_approval'}
			<FilePicker
				label="Building manager approval"
				status={buildingManagerApprovalFileId ? 'Uploaded' : 'Optional'}
				onFiles={(input) => uploadRequestFile('building_manager_approval', input)}
			/>
		{:else if panel.id === 'computer_price_quote'}
			<FilePicker
				label="Computer price quote"
				status={computerPriceQuoteFileId ? 'Uploaded' : 'Optional'}
				onFiles={(input) => uploadRequestFile('computer_price_quote', input)}
			/>
		{:else if panel.id === 'recipients'}
			<div class="mt-4 space-y-3">
				{#each recipients as recipient, index (index)}
					<div class="grid gap-3 rounded-md border border-stone-200 p-3 md:grid-cols-3">
						<input
							class="field"
							placeholder="Name"
							bind:value={recipient.name}
							oninput={onChange}
						/>
						<input
							class="field"
							placeholder="UO 95"
							bind:value={recipient.uo95}
							oninput={onChange}
						/>
						<div class="recipient-value">
							<div class="currency-field">
								<span>$</span>
								<input
									class="field"
									type="number"
									step="0.01"
									placeholder="Value"
									bind:value={recipient.value}
									oninput={onChange}
								/>
							</div>
							<button class="secondary" type="button" onclick={() => removeRecipient(index)}>
								Remove
							</button>
						</div>
					</div>
				{/each}
			</div>
			<button class="secondary mt-3" type="button" onclick={addRecipient}>Add recipient</button>
		{:else if panel.id === 'brand_approval'}
			<FilePicker
				label="Brand approval"
				status={brandApprovalFileId ? 'Uploaded' : 'Optional'}
				onFiles={(input) => uploadRequestFile('brand_approval', input)}
			/>
		{:else if panel.id === 'second_approval'}
			<FilePicker
				label="Second approval"
				status={secondApprovalFileId ? 'Uploaded' : 'Required'}
				onFiles={(input) => uploadRequestFile('second_approval', input)}
			/>
		{/if}
	</section>
{/each}

<style>
	.panel {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		background: white;
		padding: 1.25rem;
	}

	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	label > span {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(87 83 78);
	}

	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.45rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
		transition-property: background-color, transform;
		transition-duration: 120ms;
	}

	.secondary:hover {
		background: rgb(250 250 249);
	}

	.secondary:active {
		transform: scale(0.96);
	}

	.currency-field {
		position: relative;
	}

	.currency-field > span {
		position: absolute;
		left: 0.75rem;
		top: 50%;
		color: rgb(120 113 108);
		font-size: 0.875rem;
		transform: translateY(-50%);
	}

	.currency-field .field {
		padding-left: 1.45rem;
		font-variant-numeric: tabular-nums;
	}

	.recipient-value {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
	}
</style>
