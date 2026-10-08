<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { hasAllocations } from '$convex/budget';
	import { fundLabel } from '$convex/funds';
	import AppShell from '$lib/app/AppShell.svelte';
	import { errorMessage } from '$lib/errors';
	import { formatMoney } from '$lib/board/format';
	import Ledger from '$lib/budget/Ledger.svelte';
	import LineMeter from '$lib/budget/LineMeter.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	let fiscalYear = $state<number | undefined>(undefined);

	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const organization = $derived(
		savedQuery.data?.organizations.find((org) => org._id === organizationId)
	);
	const tracking = $derived(organization ? hasAllocations(organization.budgetLines) : undefined);
	const summaryQuery = useQuery(
		api.authed.budget.budgetSummary,
		() => (tracking ? { organizationId, fiscalYear } : 'skip'),
		{ keepPreviousData: true }
	);
	const summary = $derived(summaryQuery.data);
	const over = $derived(summary !== undefined && summary.totals.remaining < 0);
	const settingsHref = $derived(`/app/settings#org-${organizationId}`);

	const groups = $derived(
		(summary?.funds ?? []).map((fund) => {
			const lines = (summary?.lines ?? []).filter((line) => line.fund === fund.fund);
			return {
				fund: fund.fund,
				lines:
					fund.allocated === null && lines.length === 1 && lines[0]?.name === fundLabel[fund.fund]
						? []
						: lines,
				total: {
					...fund,
					name: fundLabel[fund.fund],
					purchases: lines.reduce((sum, line) => sum + line.purchases, 0),
					approvedCount: lines.reduce((sum, line) => sum + line.approvedCount, 0),
					pendingVendors: [...new Set(lines.flatMap((line) => line.pendingVendors))].slice(0, 3)
				}
			};
		})
	);

	function leftLabel(remaining: number | null) {
		if (remaining === null) return 'Not tracked';
		return remaining < 0 ? `${formatMoney(-remaining)} over` : formatMoney(remaining);
	}
</script>

<svelte:head>
	<title>Budget · {organization?.name ?? 'Engage Form'}</title>
</svelte:head>

<AppShell {organizationId}>
	<main class="mx-auto flex max-w-5xl flex-col px-4 pt-6 pb-16 text-ink sm:px-6 sm:pt-10">
		<h1 class="sr-only">Budget</h1>
		{#if savedQuery.error || summaryQuery.error}
			<p class="text-sm text-alert" role="alert">
				{errorMessage(savedQuery.error ?? summaryQuery.error)}
			</p>
		{:else if tracking === false}
			<EmptyState
				title="Add what each line was allocated to see what's left"
				body="Budget lines without an allocation still work for requests. Once any line has one, this page shows what's spent, what's pending and what's left for the year."
			>
				{#snippet action()}
					<Button variant="primary" href={settingsHref}>Add allocations</Button>
				{/snippet}
			</EmptyState>
		{:else if summary === undefined}
			<p class="text-sm text-quiet">Loading budget…</p>
		{:else}
			<div
				class="flex flex-wrap items-end gap-x-8 gap-y-5 border-b border-line pb-5"
				aria-busy={summaryQuery.isStale}
			>
				<div>
					<p class="hero tabular-nums" class:text-alert={over}>
						{formatMoney(Math.abs(summary.totals.remaining))}
					</p>
					<p class="mt-1.5 text-sm text-quiet">
						{over ? 'over the' : 'left of'}
						{formatMoney(summary.totals.allocated)} allocated
					</p>
				</div>
				<div
					class="flex flex-wrap items-center gap-2.5 text-sm sm:ml-auto"
					role="group"
					aria-labelledby="fiscal-year-label"
				>
					<span class="text-quiet" id="fiscal-year-label">Fiscal year</span>
					{#each summary.fiscalYears as year (year.year)}
						<Chip
							selected={year.year === summary.fiscalYear.year}
							onclick={() => (fiscalYear = year.year)}
						>
							{year.label}
						</Chip>
					{/each}
				</div>
			</div>

			<div
				class="mt-4.5 mb-1 flex flex-wrap gap-x-4.5 gap-y-2 text-[13px] text-quiet"
				aria-hidden="true"
			>
				<span class="inline-flex items-center gap-1.5"
					><i class="swatch spent"></i>Spent: approved</span
				>
				<span class="inline-flex items-center gap-1.5">
					<i class="swatch pending"></i>Pending: not approved yet
				</span>
				<span class="inline-flex items-center gap-1.5"><i class="swatch left"></i>Left</span>
			</div>

			<table class="lines">
				<caption class="sr-only">
					Administrative and Programming funds and their budget lines for {summary.fiscalYear
						.label}: allocated, spent, pending and left
				</caption>
				<thead>
					<tr>
						<th scope="col">Line</th>
						<th scope="col"><span class="sr-only">Meter</span></th>
						<th scope="col">Allocated</th>
						<th scope="col">Spent</th>
						<th scope="col">Pending</th>
						<th scope="col">Left</th>
					</tr>
				</thead>
				{#snippet row(line: (typeof groups)[number]['total'], fundRow: boolean)}
					{@const overBy = line.remaining !== null && line.remaining < 0}
					<tr class:fund-row={fundRow}>
						<th scope="row" class="c-name">
							{line.name || 'No budget line'}
							{#if overBy}
								<span class="over-note">Over by {formatMoney(-(line.remaining ?? 0))}</span>
							{/if}
						</th>
						<td class="c-meter"><LineMeter {line} /></td>
						<td class="c-alloc" class:text-quiet={line.allocated === null}>
							{line.allocated === null ? 'Not tracked' : formatMoney(line.allocated)}
						</td>
						<td class="c-spent">{formatMoney(line.spent)}</td>
						<td class="c-pend">{formatMoney(line.pending)}</td>
						<td
							class="c-left"
							class:neg={overBy}
							class:na={line.remaining === null}
							class:text-quiet={line.remaining === null}
						>
							{leftLabel(line.remaining)}
						</td>
					</tr>
				{/snippet}
				{#each groups as group (group.fund)}
					<tbody>
						{@render row(group.total, true)}
						{#each group.lines as line (line.name)}
							{@render row(line, false)}
						{/each}
					</tbody>
				{/each}
			</table>

			<div class="mt-11">
				{#key summary.fiscalYear.year}
					<Ledger {organizationId} organizationName={organization?.name ?? ''} {summary} />
				{/key}
			</div>
		{/if}
	</main>
</AppShell>

<style>
	.hero {
		font-size: 52px;
		font-weight: 620;
		letter-spacing: -0.035em;
		line-height: 1;
	}

	.swatch {
		display: inline-block;
		width: 12px;
		height: 12px;
	}

	.swatch.spent {
		background: var(--pine);
	}

	.swatch.pending {
		background: repeating-linear-gradient(135deg, var(--pine) 0 2px, #9cc5ae 2px 5px);
	}

	.swatch.left {
		background: var(--pine-soft);
		border: 1px solid #c7dccf;
	}

	.lines {
		width: 100%;
		margin-top: 6px;
		border-collapse: collapse;
	}

	.lines thead th {
		padding: 10px 0 8px 16px;
		border-bottom: 1px solid var(--ink);
		color: var(--quiet);
		font-size: 12.5px;
		font-weight: 500;
		text-align: right;
		white-space: nowrap;
	}

	.lines thead th:first-child,
	.lines thead th:nth-child(2) {
		padding-left: 0;
		text-align: left;
	}

	.lines td,
	.lines tbody th {
		padding: 12px 0 12px 16px;
		border-bottom: 1px solid var(--line);
		font-size: 14.5px;
		font-variant-numeric: tabular-nums;
		text-align: right;
		white-space: nowrap;
	}

	.lines .c-name {
		padding-left: 0;
		font-weight: 550;
		text-align: left;
		white-space: normal;
	}

	.lines .fund-row th,
	.lines .fund-row td {
		padding-top: 18px;
		border-bottom-color: var(--ink);
		font-weight: 650;
	}

	.lines tr:not(.fund-row) .c-name {
		padding-left: 14px;
		font-weight: 450;
	}

	.lines .c-meter {
		width: 38%;
		text-align: left;
	}

	.lines .neg {
		color: var(--alert);
		font-weight: 600;
	}

	.over-note {
		display: block;
		margin-top: 4px;
		color: var(--alert);
		font-size: 12.5px;
		font-weight: 550;
	}

	@media (max-width: 640px) {
		.hero {
			font-size: 40px;
		}

		.lines thead {
			display: none;
		}

		.lines tr {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 6px 10px;
			padding: 12px 0;
			border-bottom: 1px solid var(--line);
		}

		.lines td,
		.lines tbody th {
			padding: 0;
			border: 0;
		}

		.lines .c-meter {
			grid-column: 1 / -1;
			grid-row: 2;
			width: auto;
		}

		.lines .c-alloc,
		.lines .c-spent,
		.lines .c-pend {
			display: none;
		}

		.lines .c-left {
			grid-column: 2;
			grid-row: 1;
		}

		.lines .c-left::after {
			content: ' left';
			color: var(--quiet);
			font-weight: 400;
		}

		.lines .c-left.neg::after,
		.lines .c-left.na::after {
			content: '';
		}
	}
</style>
