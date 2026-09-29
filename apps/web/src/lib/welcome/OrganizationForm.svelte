<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { errorMessage } from '$lib/app/styles';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { SUGGESTED_BUDGET_LINES } from '$lib/welcome/defaults';
	import { useConvexClient } from 'convex-svelte';

	type FundLetter = Doc<'organizations'>['fundLetter'];

	let {
		submitLabel,
		onSaved,
		onCancel
	}: {
		submitLabel: string;
		onSaved: (id: Id<'organizations'>) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	const client = useConvexClient();
	const otherFunds: FundLetter[] = ['E', 'G', 'N', 'U', 'D', 'T'];

	let name = $state('');
	let indexNumber = $state('');
	let fundLetter = $state<FundLetter>('I');
	let budgetLines = $state<string[]>([]);
	let newLine = $state('');
	let saving = $state(false);
	let error = $state('');

	const suggestions = $derived(
		SUGGESTED_BUDGET_LINES.filter(
			(line) => !budgetLines.some((item) => item.toLowerCase() === line.toLowerCase())
		)
	);

	function addLine(line: string) {
		const value = line.trim();
		if (value === '' || budgetLines.some((item) => item.toLowerCase() === value.toLowerCase()))
			return;
		budgetLines = [...budgetLines, value];
	}

	function addTyped() {
		addLine(newLine);
		newLine = '';
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const lines = newLine.trim() ? [...budgetLines, newLine.trim()] : budgetLines;
		if (lines.length === 0) {
			error = 'Add at least one budget line item.';
			return;
		}
		error = '';
		saving = true;
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: name.trim(),
				indexNumber: indexNumber.trim(),
				fundLetter,
				budgetLines: lines.map((line) => ({ name: line, allocations: [] }))
			});
			newLine = '';
			budgetLines = lines;
			await onSaved(id);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-5" onsubmit={save}>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Organization name
		<input class="input" required placeholder="Ski & Snowboard Club" bind:value={name} />
	</label>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Index number
		<span class="text-xs font-normal text-quiet">The account number printed on your budget.</span>
		<input class="input" required bind:value={indexNumber} />
	</label>

	<fieldset class="flex flex-col gap-2 text-sm">
		<legend class="mb-1.5 font-medium">Is this budget funded by ASUO?</legend>
		<div class="flex flex-wrap gap-2">
			<Chip selected={fundLetter === 'I'} onclick={() => (fundLetter = 'I')}>
				Yes, student fee money
			</Chip>
			<Chip selected={fundLetter !== 'I'} onclick={() => (fundLetter = 'E')}>No, another fund</Chip>
		</div>
		{#if fundLetter !== 'I'}
			<label class="mt-2 flex flex-col gap-1.5 font-medium">
				Fund letter on your budget
				<select class="input" bind:value={fundLetter}>
					{#each otherFunds as fund (fund)}
						<option value={fund}>{fund}</option>
					{/each}
				</select>
			</label>
		{:else}
			<span class="text-xs text-quiet">
				ASUO-funded events need proof they were advertised. We’ll ask for it on each request.
			</span>
		{/if}
	</fieldset>

	<div class="flex flex-col gap-2 text-sm">
		<span class="font-medium">Budget line items</span>
		<span class="text-xs text-quiet">
			Use the names from your budget, spelled the way Engage shows them.
		</span>
		{#if budgetLines.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each budgetLines as line (line)}
					<li>
						<button
							class="line"
							type="button"
							aria-label={`Remove ${line}`}
							onclick={() => (budgetLines = budgetLines.filter((item) => item !== line))}
						>
							{line}
							<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
								<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex gap-2">
			<input
				class="input"
				placeholder="Add a line item"
				aria-label="New budget line item"
				bind:value={newLine}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						addTyped();
					}
				}}
			/>
			<Button variant="secondary" onclick={addTyped}>Add</Button>
		</div>
		{#if suggestions.length > 0}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				<span class="text-xs text-quiet">Common:</span>
				{#each suggestions as line (line)}
					<Chip variant="add" onclick={() => addLine(line)}>{line}</Chip>
				{/each}
			</div>
		{/if}
	</div>

	{#if error}<InlineError message={error} />{/if}
	<div class="flex items-center gap-4">
		<Button variant="primary" type="submit" busy={saving}>
			{saving ? 'Saving…' : submitLabel}
		</Button>
		{#if onCancel}<Button variant="quiet" onclick={onCancel}>Cancel</Button>{/if}
	</div>
</form>

<style>
	.line {
		display: inline-flex;
		min-height: 36px;
		align-items: center;
		gap: 8px;
		border: 1px solid var(--pine);
		background: var(--pine-soft);
		padding: 0 12px;
		font-size: 14px;
		color: var(--pine-deep);
		cursor: pointer;
	}

	.line:hover {
		background: var(--pine);
		color: white;
	}
</style>
