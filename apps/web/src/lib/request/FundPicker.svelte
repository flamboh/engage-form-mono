<script lang="ts">
	import { untrack } from 'svelte';
	import {
		budgetOptions,
		fundLabel,
		funds,
		fundText,
		optionLabel,
		sameOption,
		splitProblem,
		type BudgetOption,
		type BudgetSplit,
		type Fund
	} from '$convex/funds';
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { editAmount, startFundSync, toggleOption } from './fundSplits';

	let {
		editor,
		budgetLines
	}: { editor: RequestEditor; budgetLines: { name: string; fund: Fund }[] } = $props();

	const splits = $derived(editor.form?.budgetSplits ?? []);
	const total = $derived(editor.form?.totalAmount ?? null);
	const groups = $derived(
		funds
			.map((fund) => ({
				fund,
				options: budgetOptions(budgetLines).filter((option) => option.fund === fund)
			}))
			.filter((group) => group.options.length > 0)
	);
	const custom = $derived(budgetLines.length > 0);
	const problem = $derived(
		splits.length > 1 && total !== null ? splitProblem(splits, total) : null
	);

	let sync = $state(untrack(() => startFundSync(splits, total)));
	let typing = $state<{ index: number; text: string } | null>(null);

	function save(result: { splits: BudgetSplit[]; sync: typeof sync }, debounce: boolean) {
		sync = result.sync;
		editor.update({ budgetSplits: result.splits }, { debounce });
	}

	function toggle(option: BudgetOption) {
		typing = null;
		save(toggleOption(splits, option, total, sync), false);
	}

	function typeAmount(index: number, text: string) {
		typing = { index, text };
		const amount = Number(text.replace(/[$,]/g, '')) || 0;
		save(editAmount(splits, index, amount, total, sync), true);
	}

	function shown(amount: number | null) {
		return amount === null || amount === 0 ? '' : String(Number(amount.toFixed(2)));
	}
</script>

<div class="flex flex-col gap-3">
	{#each groups as group (group.fund)}
		<div class="flex flex-wrap items-center gap-2" role="group" aria-label={fundLabel[group.fund]}>
			{#if custom}
				<span class="w-full text-xs text-(--quiet)">{fundLabel[group.fund]}</span>
			{/if}
			{#each group.options as option (optionLabel(option))}
				<Chip
					selected={splits.some((split) => sameOption(split, option))}
					onclick={() => toggle(option)}
				>
					{optionLabel(option)}
				</Chip>
			{/each}
		</div>
	{/each}
	{#if splits.length > 1}
		<div class="flex max-w-sm flex-col gap-2">
			{#each splits as split, index (optionLabel(split))}
				<label class="grid grid-cols-[1fr_8rem] items-center gap-3 text-sm text-(--ink)">
					<span>{optionLabel(split)}</span>
					<input
						class="input tabular-nums"
						inputmode="decimal"
						placeholder="$"
						aria-label={`Amount from ${optionLabel(split)}`}
						value={typing?.index === index ? typing.text : shown(split.amount)}
						oninput={(event) => typeAmount(index, event.currentTarget.value)}
						onblur={() => (typing = null)}
					/>
				</label>
			{/each}
		</div>
	{/if}
	{#if splits.length > 0 && total !== null && total > 0}
		<p class="text-xs text-(--quiet)">
			{#if problem === null}
				Engage gets “{fundText(splits, total)}”.
			{:else}
				<span class="text-(--alert)">{problem}</span>
			{/if}
		</p>
	{/if}
</div>
