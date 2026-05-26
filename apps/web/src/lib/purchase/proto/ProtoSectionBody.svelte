<script lang="ts">
	import { requirementPanelsForState, type ProtoState } from './dummyData';

	type Props = {
		sectionId: string;
		state: ProtoState;
		onChange: () => void;
	};

	let { sectionId, state = $bindable(), onChange }: Props = $props();

	const categoryOptions: { value: ProtoState['documentationCategories'][number]; label: string }[] =
		[
			{ value: 'food', label: 'Food' },
			{ value: 'printing_services', label: 'Printing Services' },
			{ value: 'office_supplies_goods', label: 'Office Supplies/Goods' },
			{ value: 'merchandise_apparel', label: 'Merchandise/Apparel' },
			{ value: 'gifts_prizes', label: 'Gifts/Prizes' }
		];

	const panels = $derived(requirementPanelsForState(state));
	const asuoFundsChecked = $derived(
		state.fundLetter === 'I' || state.documentationCategories.includes('asuo_funds')
	);

	function toggleCategory(
		category: ProtoState['documentationCategories'][number],
		checked: boolean
	) {
		state.documentationCategories = checked
			? [...state.documentationCategories.filter((c) => c !== category), category]
			: state.documentationCategories.filter((c) => c !== category);
		onChange();
	}

	function uploadLabel(panelId: string): string {
		return state.uploads[panelId] ?? 'No file selected';
	}

	function toggleUpload(panelId: string) {
		state.uploads[panelId] = state.uploads[panelId]
			? null
			: `${panelId.replace(/_/g, '-')}-sample.pdf`;
		onChange();
	}
</script>

{#if sectionId === 'setup'}
	<div class="space-y-4">
		<label>
			<span>Student organization</span>
			<select
				class="field"
				value={state.organizationName}
				onchange={(e) => {
					state.organizationName = e.currentTarget.value;
					onChange();
				}}
			>
				<option>Album Listening Club</option>
				<option>Outdoor Program</option>
				<option>Campus Film Society</option>
			</select>
		</label>
		<div class="grid gap-4 md:grid-cols-2">
			<label>
				<span>Index number</span>
				<input class="field" value={state.organizationIndex} readonly />
			</label>
			<label>
				<span>Fund letter</span>
				<input class="field" value={state.fundLetter} readonly />
			</label>
		</div>
		<fieldset class="space-y-2">
			<legend class="mb-2 text-sm font-semibold">Purchaser</legend>
			<label class="option-row">
				<input
					type="radio"
					checked={state.purchaserIsSelf}
					onchange={() => {
						state.purchaserIsSelf = true;
						state.purchaserName = 'Alex Johnson';
						onChange();
					}}
				/>
				<span>I am the purchaser (Alex Johnson)</span>
			</label>
			<label class="option-row">
				<input
					type="radio"
					checked={!state.purchaserIsSelf}
					onchange={() => {
						state.purchaserIsSelf = false;
						state.purchaserName = 'Jordan Lee';
						onChange();
					}}
				/>
				<span>Someone else is purchasing (Jordan Lee)</span>
			</label>
		</fieldset>
	</div>
{:else if sectionId === 'type'}
	<label class="option-row selected">
		<input type="radio" checked />
		<span>Personal Reimbursement</span>
	</label>
	<p class="text-sm text-stone-500">
		Other purchase types (Internal PO, PCARD, etc.) are disabled in the current product scope.
	</p>
{:else if sectionId === 'categories'}
	<div class="type-grid">
		<label class="option-row" class:disabled={state.fundLetter === 'I'}>
			<input type="checkbox" checked={asuoFundsChecked} disabled={state.fundLetter === 'I'} />
			<span>ASUO Funds</span>
		</label>
		{#each categoryOptions as option (option.value)}
			<label class="option-row">
				<input
					type="checkbox"
					checked={state.documentationCategories.includes(option.value)}
					onchange={(e) => toggleCategory(option.value, e.currentTarget.checked)}
				/>
				<span>{option.label}</span>
			</label>
		{/each}
	</div>
{:else if sectionId === 'facts'}
	<div class="grid gap-4 md:grid-cols-2">
		<label>
			<span>Requester</span>
			<input class="field" value="Alex Johnson" readonly />
		</label>
		<label>
			<span>Vendor</span>
			<input class="field" bind:value={state.vendor} oninput={onChange} />
		</label>
		<label class="md:col-span-2">
			<span>Item description</span>
			<input class="field" bind:value={state.itemDescription} oninput={onChange} />
		</label>
		<label>
			<span>Total</span>
			<div class="currency-field">
				<span>$</span>
				<input
					class="field"
					type="number"
					step="0.01"
					bind:value={state.totalAmount}
					oninput={onChange}
				/>
			</div>
		</label>
		<label>
			<span>Budget line item</span>
			<select class="field" bind:value={state.budgetLineItem} onchange={onChange}>
				{#each state.budgetLines as line (line)}
					<option value={line}>{line}</option>
				{/each}
			</select>
		</label>
	</div>
{:else if sectionId === 'requirements'}
	<div class="space-y-4">
		{#each panels as panel (panel.id)}
			<div class="requirement-card">
				<div class="flex items-center justify-between gap-3">
					<h3>{panel.title}</h3>
					<span class="badge" class:required={panel.required}
						>{panel.required ? 'Required' : 'Optional'}</span
					>
				</div>
				{#if panel.id === 'office_location'}
					<label>
						<span>Office location</span>
						<input class="field" bind:value={state.officeLocation} oninput={onChange} />
					</label>
				{:else if panel.id === 'recipients'}
					{#if state.recipients.length === 0}
						<p class="text-sm text-stone-500">No recipients added.</p>
					{:else}
						{#each state.recipients as recipient (recipient.uo95)}
							<p class="text-sm">{recipient.name} · {recipient.uo95}</p>
						{/each}
					{/if}
				{:else}
					<button class="upload-stub" type="button" onclick={() => toggleUpload(panel.id)}>
						<span class="upload-name">{uploadLabel(panel.id)}</span>
						<span class="upload-action">{state.uploads[panel.id] ? 'Remove' : 'Attach sample'}</span
						>
					</button>
				{/if}
			</div>
		{/each}
	</div>
{:else if sectionId === 'purpose'}
	<label>
		<span>Business purpose</span>
		<textarea class="field min-h-32" bind:value={state.businessPurposeText} oninput={onChange}
		></textarea>
	</label>
	<p class="text-xs text-stone-500">
		Template variables like {'{vendor}'} would auto-fill in production.
	</p>
{:else if sectionId === 'review'}
	<dl class="review-grid">
		<div>
			<dt>Organization</dt>
			<dd>{state.organizationName}</dd>
		</div>
		<div>
			<dt>Purchaser</dt>
			<dd>{state.purchaserName}{state.purchaserIsSelf ? ' (you)' : ''}</dd>
		</div>
		<div>
			<dt>Vendor</dt>
			<dd>{state.vendor}</dd>
		</div>
		<div>
			<dt>Item</dt>
			<dd>{state.itemDescription}</dd>
		</div>
		<div>
			<dt>Total</dt>
			<dd>${state.totalAmount.toFixed(2)}</dd>
		</div>
		<div>
			<dt>Categories</dt>
			<dd>{state.documentationCategories.join(', ')}</dd>
		</div>
		<div class="md:col-span-2">
			<dt>Business purpose</dt>
			<dd>{state.businessPurposeText}</dd>
		</div>
	</dl>
{/if}

<style>
	label > span,
	legend {
		display: block;
		margin-bottom: 0.35rem;
		font-size: 0.8125rem;
		font-weight: 500;
		color: rgb(87 83 78);
	}

	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.type-grid {
		display: grid;
		gap: 0.5rem;
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		border: 1px solid rgb(214 211 209);
		border-radius: 0.375rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}

	.option-row.selected {
		border-color: rgb(28 25 23);
		background: rgb(250 250 249);
	}

	.option-row.disabled {
		background: rgb(250 250 249);
		color: rgb(120 113 108);
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

	.requirement-card {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.375rem;
		padding: 1rem;
	}

	.requirement-card h3 {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.badge {
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgb(120 113 108);
	}

	.badge.required {
		color: rgb(180 83 9);
	}

	.upload-stub {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		border: 1px dashed rgb(214 211 209);
		border-radius: 0.375rem;
		padding: 0.65rem 0.75rem;
		font-size: 0.8125rem;
		text-align: left;
	}

	.upload-stub:hover {
		background: rgb(250 250 249);
	}

	.upload-name {
		color: rgb(68 64 60);
	}

	.upload-action {
		font-weight: 500;
		color: rgb(120 113 108);
	}

	.review-grid {
		display: grid;
		gap: 0.75rem 1.5rem;
	}

	@media (min-width: 768px) {
		.review-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	.review-grid dt {
		font-size: 0.75rem;
		font-weight: 500;
		color: rgb(120 113 108);
	}

	.review-grid dd {
		margin-top: 0.15rem;
		font-size: 0.875rem;
	}
</style>
