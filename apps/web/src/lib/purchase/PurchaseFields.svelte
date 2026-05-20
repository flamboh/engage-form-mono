<script lang="ts">
	import type { DocumentationCategory, FundLetter } from './builderFlow';

	type TypeOfPurchase =
		| 'personal_reimbursement'
		| 'internal_po'
		| 'external_po'
		| 'pcard'
		| 'co_sponsorship_payment'
		| 'service_agreement_or_purchase_order_for_service';
	type Props = {
		typeOfPurchase: TypeOfPurchase;
		documentationCategories: DocumentationCategory[];
		fundLetter: FundLetter;
		requesterName: string;
		vendor: string;
		itemDescription: string;
		totalAmount: number;
		budgetLineItem: string;
		budgetLineOptions: string[];
		onChange: () => void;
	};

	const typeOfPurchaseOptions: { value: TypeOfPurchase; label: string; disabled: boolean }[] = [
		{ value: 'personal_reimbursement', label: 'Personal Reimbursement', disabled: false },
		{ value: 'internal_po', label: 'Internal PO', disabled: true },
		{ value: 'external_po', label: 'External PO', disabled: true },
		{ value: 'pcard', label: 'PCARD', disabled: true },
		{ value: 'co_sponsorship_payment', label: 'Co-Sponsorship Payment', disabled: true },
		{
			value: 'service_agreement_or_purchase_order_for_service',
			label: 'Service Agreement or Purchase Order for Service',
			disabled: true
		}
	];
	const documentationCategoryOptions: { value: DocumentationCategory; label: string }[] = [
		{ value: 'food', label: 'Food' },
		{ value: 'printing_services', label: 'Printing Services' },
		{ value: 'office_supplies_goods', label: 'Office Supplies/Goods' },
		{ value: 'merchandise_apparel', label: 'Merchandise/Apparel' },
		{ value: 'gifts_prizes', label: 'Gifts/Prizes' }
	];

	let {
		typeOfPurchase = $bindable(),
		documentationCategories = $bindable(),
		fundLetter,
		requesterName,
		vendor = $bindable(),
		itemDescription = $bindable(),
		totalAmount = $bindable(),
		budgetLineItem = $bindable(),
		budgetLineOptions,
		onChange
	}: Props = $props();

	const asuoFundsImplicit = $derived(fundLetter === 'I');
	const asuoFundsChecked = $derived(
		asuoFundsImplicit || documentationCategories.includes('asuo_funds')
	);

	function setDocumentationCategory(category: DocumentationCategory, checked: boolean) {
		documentationCategories = checked
			? [...documentationCategories.filter((item) => item !== category), category]
			: documentationCategories.filter((item) => item !== category);
		onChange();
	}
</script>

<section class="panel">
	<h2>Type of Purchase</h2>
	<div class="type-grid">
		{#each typeOfPurchaseOptions as option (option.value)}
			<label class:disabled={option.disabled}>
				<input
					type="radio"
					value={option.value}
					disabled={option.disabled}
					bind:group={typeOfPurchase}
					onchange={onChange}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</section>

<section class="panel">
	<h2>Documentation Categories</h2>
	<div class="type-grid">
		<label class:disabled={asuoFundsImplicit}>
			<input
				type="checkbox"
				checked={asuoFundsChecked}
				disabled={asuoFundsImplicit}
				onchange={(event) => setDocumentationCategory('asuo_funds', event.currentTarget.checked)}
			/>
			<span>ASUO Funds</span>
		</label>
		{#each documentationCategoryOptions as option (option.value)}
			<label>
				<input
					type="checkbox"
					checked={documentationCategories.includes(option.value)}
					onchange={(event) => setDocumentationCategory(option.value, event.currentTarget.checked)}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
</section>

<section class="panel">
	<h2>Common Facts</h2>
	<div class="grid gap-4 md:grid-cols-2">
		<label>
			<span>Requester</span>
			<input class="field" value={requesterName} readonly />
		</label>
		<label>
			<span>Fund Letter</span>
			<input class="field" value={fundLetter} readonly />
		</label>
		<label><span>Vendor</span><input class="field" bind:value={vendor} oninput={onChange} /></label>
		<label
			><span>Item Description</span><input
				class="field"
				bind:value={itemDescription}
				oninput={onChange}
			/></label
		>
		<label>
			<span>Total</span>
			<div class="currency-field">
				<span>$</span>
				<input
					class="field"
					type="number"
					step="0.01"
					bind:value={totalAmount}
					oninput={onChange}
				/>
			</div>
		</label>
		<label>
			<span>Budget line item</span>
			{#if budgetLineOptions.length > 0}
				<select class="field" bind:value={budgetLineItem} onchange={onChange}>
					{#each budgetLineOptions as line (line)}
						<option value={line}>{line}</option>
					{/each}
				</select>
			{:else}
				<input class="field" bind:value={budgetLineItem} oninput={onChange} />
			{/if}
		</label>
	</div>
</section>

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

	label > span {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(87 83 78);
	}

	.type-grid {
		display: grid;
		gap: 0.5rem;
	}

	.type-grid label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgb(214 211 209);
		border-radius: 0.375rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}

	.type-grid label > span {
		margin: 0;
		color: rgb(28 25 23);
	}

	.type-grid .disabled {
		background: rgb(250 250 249);
		color: rgb(120 113 108);
	}

	.type-grid .disabled > span {
		color: rgb(120 113 108);
	}
</style>
