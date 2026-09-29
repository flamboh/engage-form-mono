<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { BudgetSummary, LedgerRow } from '$convex/authed/budget';
	import { errorMessage } from '$lib/errors';
	import { formatMoney } from '$lib/board/format';
	import { monthDay } from '$lib/request/labels';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import StatusPill from '$lib/ui/StatusPill.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { csvFilename, ledgerCsv } from './csv';

	type Filter =
		| { kind: 'all' }
		| { kind: 'line'; name: string }
		| { kind: 'unfinished' }
		| { kind: 'approved' };

	const PAGE_SIZE = 25;
	const CSV_PAGE_SIZE = 200;

	let {
		organizationId,
		organizationName,
		summary
	}: {
		organizationId: Id<'organizations'>;
		organizationName: string;
		summary: BudgetSummary;
	} = $props();

	const client = useConvexClient();
	let filter = $state<Filter>({ kind: 'all' });
	let pages = $state(1);
	let exporting = $state(false);
	let exportError = $state('');

	const approvedCount = $derived(summary.lines.reduce((sum, line) => sum + line.approvedCount, 0));
	const lineChips = $derived(summary.lines.filter((line) => line.purchases > 0));
	const filterArgs = $derived({
		organizationId,
		fiscalYear: summary.fiscalYear.year,
		...(filter.kind === 'line' ? { budgetLine: filter.name } : {}),
		...(filter.kind === 'unfinished' || filter.kind === 'approved' ? { stage: filter.kind } : {})
	});
	const ledgerQuery = useQuery(
		api.authed.budget.purchaseLedger,
		() => ({ ...filterArgs, paginationOpts: { numItems: PAGE_SIZE * pages, cursor: null } }),
		{ keepPreviousData: true }
	);
	const rows = $derived(ledgerQuery.data?.page ?? []);
	const total = $derived(rows.reduce((sum, row) => sum + row.totalAmount, 0));
	const expected = $derived.by(() => {
		if (filter.kind === 'all') return summary.purchases;
		if (filter.kind === 'approved') return approvedCount;
		if (filter.kind === 'unfinished') return summary.purchases - approvedCount;
		const name = filter.name;
		return summary.lines.find((line) => line.name === name)?.purchases ?? 0;
	});

	function choose(next: Filter) {
		filter = next;
		pages = 1;
	}

	const selected = (candidate: Filter) =>
		candidate.kind === filter.kind &&
		(candidate.kind !== 'line' || (filter.kind === 'line' && filter.name === candidate.name));

	function title(row: LedgerRow) {
		return row.vendor.trim() || row.itemDescription.trim() || 'Untitled request';
	}

	function eventLine(row: LedgerRow) {
		const last = row.eventDates.at(-1);
		const date = last ? last.slice(5).replace('-', '/') : '';
		return [row.eventName.trim(), date].filter((part) => part !== '').join(' ');
	}

	async function downloadCsv() {
		if (exporting) return;
		exporting = true;
		exportError = '';
		try {
			const all: LedgerRow[] = [];
			let cursor: string | null = null;
			for (;;) {
				const result: { page: LedgerRow[]; isDone: boolean; continueCursor: string } =
					await client.query(api.authed.budget.purchaseLedger, {
						...filterArgs,
						paginationOpts: { numItems: CSV_PAGE_SIZE, cursor }
					});
				all.push(...result.page);
				if (result.isDone) break;
				cursor = result.continueCursor;
			}
			const url = URL.createObjectURL(new Blob([ledgerCsv(all)], { type: 'text/csv' }));
			const link = document.createElement('a');
			link.href = url;
			link.download = csvFilename(organizationName, summary.fiscalYear.label);
			link.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			exportError = errorMessage(err);
		} finally {
			exporting = false;
		}
	}
</script>

<section class="flex flex-col" aria-labelledby="purchases-heading">
	<div class="flex flex-wrap items-baseline gap-x-3 gap-y-3 border-b border-ink pb-2.5">
		<h2 id="purchases-heading" class="text-lg font-semibold">Purchases</h2>
		<span class="text-sm text-quiet">{summary.purchases} this year</span>
		<div class="filters flex gap-1.5 sm:ml-auto">
			<Chip selected={selected({ kind: 'all' })} onclick={() => choose({ kind: 'all' })}>
				All lines
			</Chip>
			{#each lineChips as line (line.name)}
				<Chip
					selected={selected({ kind: 'line', name: line.name })}
					onclick={() => choose({ kind: 'line', name: line.name })}
				>
					{line.name || 'No budget line'}
				</Chip>
			{/each}
			{#if summary.purchases - approvedCount > 0}
				<Chip
					selected={selected({ kind: 'unfinished' })}
					onclick={() => choose({ kind: 'unfinished' })}
				>
					Unfinished
				</Chip>
			{/if}
			{#if approvedCount > 0}
				<Chip
					selected={selected({ kind: 'approved' })}
					onclick={() => choose({ kind: 'approved' })}
				>
					Approved
				</Chip>
			{/if}
			<Button
				variant="secondary"
				size="sm"
				busy={exporting}
				disabled={summary.purchases === 0}
				onclick={downloadCsv}
			>
				{exporting ? 'Preparing CSV…' : 'Download CSV'}
			</Button>
		</div>
	</div>

	{#if exportError}
		<p class="mt-3 text-sm text-alert" role="alert">{exportError}</p>
	{/if}

	{#if ledgerQuery.error}
		<p class="mt-3 text-sm text-alert" role="alert">{errorMessage(ledgerQuery.error)}</p>
	{:else if ledgerQuery.data === undefined}
		<p class="py-6 text-sm text-quiet">Loading purchases…</p>
	{:else if rows.length === 0}
		<p class="py-6 text-sm text-quiet">No purchases this fiscal year yet.</p>
	{:else}
		<table class="ledger" aria-busy={ledgerQuery.isStale}>
			<thead>
				<tr>
					<th scope="col">Bought</th>
					<th scope="col">Vendor</th>
					<th scope="col" class="c-items">Items</th>
					<th scope="col" class="c-line">Line</th>
					<th scope="col" class="c-status">Status</th>
					<th scope="col" class="num">Amount</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr>
						<td class="whitespace-nowrap tabular-nums">{monthDay(row.receiptDate)}</td>
						<td class="min-w-0">
							<a
								class="font-medium underline-offset-4 hover:underline"
								href="/app/org/{organizationId}/purchase/{row.id}">{title(row)}</a
							>
							{#if eventLine(row)}
								<span class="sub">{eventLine(row)}</span>
							{/if}
						</td>
						<td class="c-items">
							<span class="line-clamp-2">{row.itemDescription}</span>
						</td>
						<td class="c-line">{row.budgetLineItem}</td>
						<td class="c-status"><StatusPill stage={row.stage} /></td>
						<td class="num">{formatMoney(row.totalAmount)}</td>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="2">Showing {rows.length} of {Math.max(expected, rows.length)}</td>
					<td class="c-items"></td>
					<td class="c-line"></td>
					<td class="c-status"></td>
					<td class="num">{formatMoney(total)}</td>
				</tr>
			</tfoot>
		</table>
		{#if !ledgerQuery.data.isDone}
			<div class="pt-4">
				<Button variant="quiet" size="sm" busy={ledgerQuery.isStale} onclick={() => (pages += 1)}>
					Show more
				</Button>
			</div>
		{/if}
	{/if}
</section>

<style>
	.filters {
		flex-wrap: wrap;
	}

	.ledger {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	.ledger th,
	.ledger td {
		padding: 11px 12px 11px 0;
		border-bottom: 1px solid var(--line);
		text-align: left;
		vertical-align: middle;
	}

	.ledger th {
		font-weight: 500;
		font-size: 12.5px;
		color: var(--quiet);
	}

	.ledger .num {
		padding-right: 0;
		text-align: right;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}

	.ledger tfoot td {
		border-top: 1px solid var(--ink);
		border-bottom: 0;
		font-weight: 600;
	}

	.sub {
		display: block;
		color: var(--quiet);
		font-size: 13px;
	}

	@media (max-width: 640px) {
		.filters {
			width: 100%;
			flex-wrap: nowrap;
			overflow-x: auto;
			padding-bottom: 2px;
		}

		.ledger {
			table-layout: fixed;
		}

		.ledger thead,
		.ledger .c-items,
		.ledger .c-line,
		.ledger .c-status {
			display: none;
		}

		.ledger td {
			padding: 10px 8px 10px 0;
		}

		.ledger td:first-child {
			width: 58px;
		}

		.ledger td.num {
			width: 84px;
		}

		.sub {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>
