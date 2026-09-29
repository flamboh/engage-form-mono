<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import { currentFiscalYear, fiscalYearLabel } from '$convex/budget';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import { SUGGESTED_BUDGET_LINES } from '$lib/welcome/defaults';

	type BudgetLine = Doc<'organizations'>['budgetLines'][number];

	let {
		lines,
		budgetHref,
		onsave
	}: {
		lines: BudgetLine[];
		budgetHref: string | null;
		onsave: (lines: BudgetLine[]) => Promise<string | null>;
	} = $props();

	const currentYear = currentFiscalYear(Date.now());
	let year = $state(currentYear);
	let adding = $state(false);
	let newLine = $state('');
	let error = $state('');

	const years = $derived(
		[
			...new Set([
				currentYear - 1,
				currentYear,
				...lines.flatMap((line) => line.allocations.map((item) => item.fiscalYear))
			])
		].sort((a, b) => a - b)
	);
	const suggestions = $derived(
		SUGGESTED_BUDGET_LINES.filter(
			(name) => !lines.some((line) => line.name.toLowerCase() === name.toLowerCase())
		)
	);

	function amountFor(line: BudgetLine) {
		const amount = line.allocations.find((item) => item.fiscalYear === year)?.amount;
		return amount === undefined
			? ''
			: amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	}

	async function save(next: BudgetLine[]) {
		error = (await onsave(next)) ?? '';
	}

	async function setAllocation(line: BudgetLine, input: HTMLInputElement) {
		const raw = input.value.replace(/[$,\s]/g, '');
		const amount = raw === '' ? null : Number(raw);
		if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
			error = 'Enter an amount like 1500 or 1,500.00.';
			input.value = amountFor(line);
			return;
		}
		const allocations = [
			...line.allocations.filter((item) => item.fiscalYear !== year),
			...(amount === null ? [] : [{ fiscalYear: year, amount: Math.round(amount * 100) / 100 }])
		].sort((a, b) => a.fiscalYear - b.fiscalYear);
		input.value =
			amount === null
				? ''
				: amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		await save(lines.map((item) => (item.name === line.name ? { ...item, allocations } : item)));
	}

	async function addLine(name: string) {
		const value = name.trim();
		if (value === '') return;
		if (lines.some((line) => line.name.toLowerCase() === value.toLowerCase())) {
			error = `${value} is already a line.`;
			return;
		}
		await save([...lines, { name: value, allocations: [] }]);
		newLine = '';
		adding = false;
	}

	async function removeLine(line: BudgetLine) {
		await save(lines.filter((item) => item.name !== line.name));
	}
</script>

<div class="flex flex-col">
	<SectionHeader title="Budget lines" level={3}>
		{#snippet action()}
			<Button variant="quiet" size="sm" onclick={() => (adding = !adding)}>Add line</Button>
		{/snippet}
	</SectionHeader>
	<div class="years" role="group" aria-label="Fiscal year">
		<span>Allocated in</span>
		{#each years as option (option)}
			<Chip selected={option === year} onclick={() => (year = option)}>
				{fiscalYearLabel(option)}
			</Chip>
		{/each}
	</div>
	<table>
		<thead>
			<tr>
				<th scope="col">Line, as Engage spells it</th>
				<th scope="col" class="num">Allocated {fiscalYearLabel(year)}, optional</th>
				<th scope="col"><span class="sr-only">Remove</span></th>
			</tr>
		</thead>
		<tbody>
			{#each lines as line (line.name)}
				<tr>
					<td>{line.name}</td>
					<td class="num">
						{#key year}
							<input
								inputmode="decimal"
								placeholder="Not tracked"
								aria-label={`${line.name} allocated in ${fiscalYearLabel(year)}`}
								value={amountFor(line)}
								onchange={(event) => setAllocation(line, event.currentTarget)}
								onkeydown={(event) => {
									if (event.key === 'Enter') event.currentTarget.blur();
								}}
							/>
						{/key}
					</td>
					<td class="remove">
						<button
							type="button"
							aria-label={`Remove ${line.name}`}
							disabled={lines.length === 1}
							onclick={() => removeLine(line)}
						>
							<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
								<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" />
							</svg>
						</button>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
	{#if adding}
		<div class="add">
			<div class="flex gap-2">
				<input
					class="input"
					placeholder="Line name, as Engage spells it"
					aria-label="New budget line"
					bind:value={newLine}
					{@attach (node) => node.focus()}
					onkeydown={(event) => {
						if (event.key === 'Enter') addLine(newLine);
						if (event.key === 'Escape') adding = false;
					}}
				/>
				<Button variant="secondary" onclick={() => addLine(newLine)}>Add</Button>
			</div>
			{#if suggestions.length > 0}
				<div class="flex flex-wrap gap-2">
					{#each suggestions as name (name)}
						<Chip variant="add" onclick={() => addLine(name)}>{name}</Chip>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}
	<p class="hint">
		Add allocations and a Budget tab shows what’s spent and left.
		{#if budgetHref}<a href={budgetHref}>Open Budget</a>{/if}
	</p>
</div>

<style>
	.years {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 10px 0 4px;
		font-size: 13px;
		color: var(--quiet);
	}

	.years span {
		margin-right: 4px;
	}

	.years :global(.chip) {
		min-height: 30px;
		font-size: 13px;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14.5px;
	}

	th {
		border-bottom: 1px solid var(--line);
		padding: 8px 0;
		text-align: left;
		font-size: 12.5px;
		font-weight: 500;
		color: var(--quiet);
	}

	td {
		border-bottom: 1px solid var(--line);
		padding: 9px 0;
	}

	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	td input {
		width: 110px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 5px 8px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	td input::placeholder {
		color: var(--faint);
	}

	.remove {
		width: 36px;
		text-align: right;
	}

	.remove button {
		display: inline-grid;
		width: 28px;
		height: 28px;
		place-items: center;
		border: 0;
		background: none;
		color: var(--faint);
		cursor: pointer;
	}

	.remove button:hover:not(:disabled) {
		color: var(--alert);
	}

	.remove button:disabled {
		visibility: hidden;
	}

	.add {
		display: flex;
		flex-direction: column;
		gap: 10px;
		border-bottom: 1px solid var(--line);
		padding: 12px 0;
	}

	.hint {
		margin: 0;
		padding: 12px 0 0;
		font-size: 13.5px;
		color: var(--quiet);
	}

	.hint a {
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
