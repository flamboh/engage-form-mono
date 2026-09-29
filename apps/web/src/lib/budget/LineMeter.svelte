<script lang="ts">
	import type { BudgetSummary } from '$convex/authed/budget';
	import { formatMoney } from '$lib/board/format';

	type Line = BudgetSummary['lines'][number];
	type Segment = { key: 'spent' | 'pending'; width: number; tip: string };

	let { line }: { line: Line } = $props();

	const uid = $props.id();
	const tracked = $derived(line.allocated !== null);
	const scale = $derived(Math.max(line.allocated ?? 0, line.spent + line.pending));
	const overBy = $derived(line.remaining !== null && line.remaining < 0 ? -line.remaining : 0);
	const name = $derived(line.name || 'No budget line');

	const segments = $derived.by(() => {
		if (scale <= 0) return [];
		const items: Segment[] = [];
		if (line.spent > 0) {
			items.push({
				key: 'spent',
				width: (line.spent / scale) * 100,
				tip: `${name}: ${formatMoney(line.spent)} spent (${line.approvedCount} approved)`
			});
		}
		if (line.pending > 0) {
			const vendors = line.pendingVendors.length > 0 ? ` (${line.pendingVendors.join(', ')})` : '';
			const over = overBy > 0 ? `. ${formatMoney(overBy)} over the allocation` : '';
			items.push({
				key: 'pending',
				width: (line.pending / scale) * 100,
				tip: `${name}: ${formatMoney(line.pending)} pending${vendors}${over}`
			});
		}
		return items;
	});

	const summary = $derived(
		line.allocated === null
			? `${name}: not tracked. ${formatMoney(line.spent)} spent, ${formatMoney(line.pending)} pending.`
			: `${name}: ${formatMoney(line.spent)} spent and ${formatMoney(line.pending)} pending of ${formatMoney(line.allocated)} allocated. ${
					overBy > 0
						? `Over by ${formatMoney(overBy)}.`
						: `${formatMoney(line.remaining ?? 0)} left.`
				}`
	);

	let tip = $state<{ key: Segment['key']; text: string; x: number; y: number } | null>(null);

	function showAt(segment: Segment, x: number, y: number) {
		const edge = Math.min(160, window.innerWidth / 2);
		tip = {
			key: segment.key,
			text: segment.tip,
			x: Math.min(Math.max(x, edge), window.innerWidth - edge),
			y
		};
	}

	function showAbove(segment: Segment, element: HTMLElement) {
		const rect = element.getBoundingClientRect();
		showAt(segment, rect.left + rect.width / 2, rect.top);
	}

	function hide(segment: Segment) {
		if (tip?.key === segment.key) tip = null;
	}
</script>

<svelte:window onscroll={() => (tip = null)} />

{#if tracked}
	<div class="meter" class:over={overBy > 0} role="group" aria-label={summary}>
		{#each segments as segment (segment.key)}
			<button
				class="segment {segment.key}"
				type="button"
				style:width="{segment.width}%"
				aria-label={segment.tip}
				aria-describedby={tip?.key === segment.key ? `${uid}-tip` : undefined}
				onpointermove={(event) => showAt(segment, event.clientX, event.clientY)}
				onpointerleave={() => hide(segment)}
				onfocus={(event) => showAbove(segment, event.currentTarget)}
				onblur={() => hide(segment)}
				onclick={(event) => showAbove(segment, event.currentTarget)}
			></button>
		{/each}
	</div>
{:else}
	<div class="meter none" role="img" aria-label={summary}></div>
{/if}

{#if tip}
	<div id="{uid}-tip" class="tip" role="tooltip" style:left="{tip.x}px" style:top="{tip.y}px">
		{tip.text}
	</div>
{/if}

<style>
	.meter {
		display: flex;
		gap: 2px;
		height: 14px;
		width: 100%;
		background: var(--pine-soft);
	}

	.meter.over {
		background: var(--alert-soft);
		outline: 1.5px solid var(--alert);
		outline-offset: 1px;
	}

	.meter.none {
		height: 2px;
		margin: 6px 0;
		background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 8px);
	}

	.segment {
		display: block;
		height: 100%;
		min-width: 3px;
		padding: 0;
		border: 0;
		cursor: default;
	}

	.segment:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}

	.spent {
		background: var(--pine);
	}

	.pending {
		background: repeating-linear-gradient(135deg, var(--pine) 0 2px, #9cc5ae 2px 5px);
	}

	.tip {
		position: fixed;
		z-index: 50;
		transform: translate(-50%, calc(-100% - 10px));
		max-width: min(24rem, calc(100vw - 2rem));
		padding: 7px 10px;
		background: var(--ink);
		color: white;
		font-size: 13px;
		line-height: 1.4;
		pointer-events: none;
	}
</style>
