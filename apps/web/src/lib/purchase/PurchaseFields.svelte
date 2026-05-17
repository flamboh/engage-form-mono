<script lang="ts">
	type Props = {
		eventDate: string;
		vendor: string;
		itemDescription: string;
		totalAmount: number;
		budgetLineItem: string;
		reimbursementReason: string;
		budgetLineOptions: string[];
		onChange: () => void;
	};

	let {
		eventDate = $bindable(),
		vendor = $bindable(),
		itemDescription = $bindable(),
		totalAmount = $bindable(),
		budgetLineItem = $bindable(),
		reimbursementReason = $bindable(),
		budgetLineOptions,
		onChange
	}: Props = $props();
</script>

<section class="panel">
	<h2>Purchase</h2>
	<div class="grid gap-4 md:grid-cols-2">
		<label>
			<span>Event date</span>
			<input class="field" type="date" bind:value={eventDate} oninput={onChange} />
		</label>
		<label><span>Vendor</span><input class="field" bind:value={vendor} oninput={onChange} /></label>
		<label
			><span>Item</span><input
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
		<label class="md:col-span-2">
			<span>Why reimbursement was used</span>
			<input class="field" bind:value={reimbursementReason} oninput={onChange} />
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
</style>
