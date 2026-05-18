<script lang="ts">
	type Recipient = { name: string; uo95: string; reason: string; value: number };

	type Props = {
		recipients: Recipient[];
		onChange: () => void;
	};

	let { recipients = $bindable(), onChange }: Props = $props();

	function addRecipient() {
		recipients = [...recipients, { name: '', uo95: '', reason: '', value: 0 }];
		onChange();
	}

	function removeRecipient(index: number) {
		recipients = recipients.filter((_, itemIndex) => itemIndex !== index);
		onChange();
	}
</script>

<section class="panel">
	<div class="flex items-center justify-between">
		<h2>Recipients</h2>
		<button class="secondary" type="button" onclick={addRecipient}>Add recipient</button>
	</div>
	<div class="mt-4 space-y-3">
		{#each recipients as recipient, index (index)}
			<div class="grid gap-3 rounded-md border border-stone-200 p-3 md:grid-cols-4">
				<input class="field" placeholder="Name" bind:value={recipient.name} oninput={onChange} />
				<input class="field" placeholder="UO 95" bind:value={recipient.uo95} oninput={onChange} />
				<input
					class="field"
					placeholder="Reason"
					bind:value={recipient.reason}
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
					<button class="secondary" type="button" onclick={() => removeRecipient(index)}
						>Remove</button
					>
					{#if recipient.value > 0 && recipient.value < 10}
						<p
							class="recipient-note"
							title="SOFS guidelines do not require recipient details for gifts under $10."
						>
							Recipient details are optional for gifts under $10.
						</p>
					{/if}
				</div>
			</div>
		{/each}
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

	.recipient-note {
		grid-column: 1 / -1;
		color: rgb(87 83 78);
		font-size: 0.75rem;
		line-height: 1.25;
	}
</style>
