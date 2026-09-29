<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { BoardItem } from '$convex/authed/board';
	import { todayInEugene } from '$convex/lifecycle';
	import AppShell from '$lib/app/AppShell.svelte';
	import { errorMessage } from '$lib/errors';
	import ReceiptDrop from '$lib/board/ReceiptDrop.svelte';
	import RequestRow from '$lib/board/RequestRow.svelte';
	import SentBackDialog from '$lib/board/SentBackDialog.svelte';
	import {
		daysLeftLabel,
		daysLeftTone,
		formatDay,
		formatEventDay,
		formatMoney
	} from '$lib/board/format';
	import { prefetchRequest } from '$lib/request/prefetch';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import Banner from '$lib/ui/Banner.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import { startUploads, uploadsFor } from '$lib/uploads.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	const today = todayInEugene(Date.now());
	const boardQuery = useQuery(api.authed.board.organizationBoard, () => ({
		organizationId,
		today
	}));
	const board = $derived(boardQuery.data);
	const pendingFillQuery = useQuery(api.authed.extension.getPendingFill, () => ({}));
	const fillingId = $derived(pendingFillQuery.data?.purchaseRequestId ?? null);

	let starting = $state(false);
	let busyId = $state<Id<'purchaseRequests'> | null>(null);
	let sendingBack = $state<BoardItem | null>(null);
	let error = $state('');

	const trackedId = $derived(page.url.searchParams.get('tracked'));
	const allItems = $derived(
		board
			? [...board.readyToFill, ...board.toFinish, ...board.afterEvent, ...board.waitingOnEngage]
			: []
	);
	const tracked = $derived(allItems.find((item) => item.id === trackedId) ?? null);
	const empty = $derived(allItems.length === 0);
	const purchasesHref = $derived(
		board?.organization.hasAllocations
			? `/app/org/${organizationId}/budget`
			: `/app/settings#org-${organizationId}`
	);

	const requestHref = (id: Id<'purchaseRequests'>) => `/app/org/${organizationId}/purchase/${id}`;

	function titleOf(item: BoardItem) {
		return item.vendor.trim() || item.itemDescription.trim() || 'Your request';
	}

	function trackedMessage(item: BoardItem) {
		if (item.stage !== 'after_event') return `${titleOf(item)} is saved in To finish.`;
		const when = item.finishAfter ? formatEventDay(item.finishAfter) : 'the event';
		return `${titleOf(item)} is tracked. It moves to To finish after ${when}.`;
	}

	function dismissTracked() {
		const url = new URL(page.url);
		url.searchParams.delete('tracked');
		void goto(url, { replaceState: true, noScroll: true, keepFocus: true });
	}

	function dismissLater() {
		const timer = setTimeout(dismissTracked, 7000);
		return () => clearTimeout(timer);
	}

	async function startRequest(files: File[]) {
		const session = clerkContext.currentSession;
		if (!session || starting) return;
		starting = true;
		error = '';
		try {
			const created = client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
				organizationId
			});
			if (files.length > 0) startUploads(session, created, files, 'auto');
			const id = await created;
			prefetchRequest(client, id, organizationId);
			await goto(requestHref(id));
		} catch (err) {
			error = errorMessage(err);
		} finally {
			starting = false;
		}
	}

	async function fillOnEngage(item: BoardItem) {
		if (busyId !== null) return;
		const tab = window.open('about:blank', '_blank');
		busyId = item.id;
		error = '';
		try {
			const { engageUrl } = await client.mutation(api.authed.extension.requestFill, {
				purchaseRequestId: item.id
			});
			if (tab) {
				tab.opener = null;
				tab.location.href = engageUrl;
			} else {
				window.location.href = engageUrl;
			}
		} catch (err) {
			tab?.close();
			error = errorMessage(err);
		} finally {
			busyId = null;
		}
	}

	async function markApproved(item: BoardItem) {
		busyId = item.id;
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.markApproved, { id: item.id });
		} catch (err) {
			error = errorMessage(err);
		} finally {
			busyId = null;
		}
	}

	async function markSentBack(item: BoardItem, note: string) {
		busyId = item.id;
		error = '';
		try {
			await client.mutation(api.authed.board.markSentBack, { purchaseRequestId: item.id, note });
			sendingBack = null;
		} catch (err) {
			error = errorMessage(err);
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head>
	<title>{board?.organization.name ?? 'Requests'} · Engage Form</title>
</svelte:head>

{#snippet days(item: BoardItem)}
	{#if item.daysLeft !== null}
		<span class="days {daysLeftTone(item.daysLeft)}">{daysLeftLabel(item.daysLeft)}</span>
	{/if}
{/snippet}

{#snippet group(
	title: string,
	hint: string,
	items: BoardItem[],
	next: Snippet<[BoardItem]>,
	actions?: Snippet<[BoardItem]>
)}
	{#if items.length > 0}
		<section class="flex flex-col" aria-label={title}>
			<SectionHeader {title} count={items.length} {hint} />
			<ul>
				{#each items as item (item.id)}
					<RequestRow
						{item}
						href={requestHref(item.id)}
						fresh={item.id === trackedId}
						{next}
						{actions}
					/>
				{/each}
			</ul>
		</section>
	{/if}
{/snippet}

{#snippet readyNext(item: BoardItem)}
	<span class="square bg-pine" class:reading={item.reading} aria-hidden="true"></span>
	{#if item.reading}
		<span class="text-quiet">Reading receipt…</span>
	{:else if item.finishAfter === null}
		Everything's in
	{:else if item.finishAfter < today}
		Event was {formatEventDay(item.finishAfter)}
	{:else}
		Event is {formatEventDay(item.finishAfter)}
	{/if}
	<span class="sm:hidden">{@render days(item)}</span>
{/snippet}

{#snippet readyActions(item: BoardItem)}
	<span class="hidden sm:inline">{@render days(item)}</span>
	{#if fillingId === item.id && busyId !== item.id}
		<span class="flex items-center gap-2 text-sm" role="status">
			<span class="filling square bg-pine" aria-hidden="true"></span>
			Filling…
			<Button variant="quiet" onclick={() => fillOnEngage(item)}>Open again</Button>
		</span>
	{:else}
		<Button
			variant="primary"
			size="sm"
			disabled={busyId !== null}
			busy={busyId === item.id}
			onclick={() => fillOnEngage(item)}
		>
			{busyId === item.id ? 'Opening Engage…' : 'Fill on Engage'}
		</Button>
	{/if}
{/snippet}

{#snippet finishNext(item: BoardItem)}
	{@const uploads = uploadsFor(item.id).filter((upload) => upload.status !== 'attached')}
	{#if uploads.some((upload) => upload.status === 'failed')}
		<span class="square bg-alert" aria-hidden="true"></span>
		<span class="text-alert">Receipt didn't upload</span>
	{:else if uploads.length > 0}
		<span class="square hollow" aria-hidden="true"></span>
		<span class="text-quiet">Uploading receipt…</span>
	{:else if item.reading}
		<span class="square hollow reading" aria-hidden="true"></span>
		<span class="text-quiet">Reading receipt…</span>
	{:else}
		<span class="square bg-marker-deep" aria-hidden="true"></span>
		<span class="truncate">{item.nextStep ?? 'Check it over'}</span>
	{/if}
	{@render days(item)}
{/snippet}

{#snippet afterNext(item: BoardItem)}
	<span class="square hollow" aria-hidden="true"></span>
	<span class="truncate">
		Come back after {item.finishAfter ? formatEventDay(item.finishAfter) : 'the event'}
	</span>
	{@render days(item)}
{/snippet}

{#snippet afterActions(item: BoardItem)}
	<span class="hidden sm:inline">
		<Button variant="quiet" href={requestHref(item.id)}>Finish now</Button>
	</span>
{/snippet}

{#snippet waitingNext(item: BoardItem)}
	<span class="square hollow border-pine" aria-hidden="true"></span>
	{item.lastFilledAt === null ? 'Filled' : `Filled ${formatDay(item.lastFilledAt)}`}
{/snippet}

{#snippet waitingActions(item: BoardItem)}
	<span class="hidden sm:inline">
		<Button variant="quiet" disabled={busyId === item.id} onclick={() => (sendingBack = item)}>
			Sent back
		</Button>
	</span>
	<Button
		variant="secondary"
		size="sm"
		disabled={busyId === item.id}
		busy={busyId === item.id}
		onclick={() => markApproved(item)}
	>
		Mark approved
	</Button>
{/snippet}

<AppShell {organizationId}>
	<main
		class="mx-auto flex max-w-[920px] flex-col gap-[26px] px-4 pt-[18px] pb-24 sm:gap-9 sm:px-6 sm:pt-8"
	>
		<ReceiptDrop busy={starting} onFiles={startRequest} onEmpty={() => startRequest([])} />

		{#if error}
			<Banner message={error} />
		{/if}

		{#if boardQuery.error}
			<Banner message={errorMessage(boardQuery.error)} />
		{:else if board}
			<div class="flex flex-col gap-[26px] sm:gap-9">
				{#if empty}
					<EmptyState
						title="Nothing to finish"
						body="Drop a receipt when you buy something. It waits here until Engage approves it."
					/>
				{/if}
				{@render group(
					'Ready to fill',
					'Everything Engage asks for is in.',
					board.readyToFill,
					readyNext,
					readyActions
				)}
				{@render group('To finish', 'These need you now.', board.toFinish, finishNext)}
				{@render group(
					'After the event',
					'Tracked. Come back after the event, or finish now.',
					board.afterEvent,
					afterNext,
					afterActions
				)}
				{@render group(
					'Waiting on Engage',
					'Filled. Mark it when Engage says approved.',
					board.waitingOnEngage,
					waitingNext,
					waitingActions
				)}
			</div>
			{#if !empty || board.approvedThisYear.count > 0}
				<div
					class="-mt-[26px] flex items-center justify-between gap-4 border-b border-line py-3.5 text-sm text-quiet sm:-mt-9"
				>
					<span class="tabular-nums">
						{board.approvedThisYear.count} approved this year{board.approvedThisYear.count > 0
							? `, ${formatMoney(board.approvedThisYear.total)}`
							: ''}
					</span>
					<a class="text-ink underline underline-offset-3" href={purchasesHref}>
						See all purchases
					</a>
				</div>
			{/if}
		{:else}
			<p class="text-sm text-quiet">Loading requests…</p>
		{/if}
	</main>

	{#if tracked}
		{#key tracked.id}
			<div
				class="toast fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3.5 bg-ink px-4 py-3 text-[13.5px] text-white shadow-[0_10px_24px_-10px_rgb(0_0_0/0.5)] sm:bottom-6 sm:w-auto sm:text-sm sm:whitespace-nowrap"
				role="status"
				{@attach dismissLater}
			>
				<span class="flex-1">{trackedMessage(tracked)}</span>
				<a class="text-marker underline underline-offset-3" href={requestHref(tracked.id)}>Open</a>
				<button
					class="text-white/70 hover:text-white"
					type="button"
					aria-label="Dismiss"
					onclick={dismissTracked}
				>
					<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
						<path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" />
					</svg>
				</button>
			</div>
		{/key}
	{/if}

	{#if sendingBack}
		<SentBackDialog
			vendor={titleOf(sendingBack)}
			busy={busyId === sendingBack.id}
			onconfirm={(note) => sendingBack && markSentBack(sendingBack, note)}
			oncancel={() => (sendingBack = null)}
		/>
	{/if}
</AppShell>

<style>
	.square {
		width: 8px;
		height: 8px;
		flex: none;
	}

	.square.hollow {
		background: transparent;
		border: 1.5px solid var(--quiet);
	}

	.square.hollow.border-pine {
		border-color: var(--pine);
	}

	.days {
		font-size: 12.5px;
		color: var(--quiet);
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.days.soon {
		background: var(--marker);
		color: var(--ink);
		padding: 2px 6px;
		font-weight: 550;
	}

	.days.late {
		background: var(--alert);
		color: white;
		padding: 2px 6px;
		font-weight: 550;
	}

	.filling,
	.reading {
		animation: blink 1.4s ease-in-out infinite;
	}

	@keyframes blink {
		50% {
			opacity: 0.25;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.filling,
		.reading {
			animation: none;
		}
	}
</style>
