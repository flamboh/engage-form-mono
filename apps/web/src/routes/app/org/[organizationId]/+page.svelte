<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import type { BoardItem } from '$convex/authed/board';
	import AppShell from '$lib/app/AppShell.svelte';
	import { errorMessage } from '$lib/app/styles';
	import ReceiptDrop from '$lib/board/ReceiptDrop.svelte';
	import RequestRow from '$lib/board/RequestRow.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { startUploads } from '$lib/uploads.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	const boardQuery = useQuery(api.authed.board.organizationBoard, () => ({ organizationId }));
	const board = $derived(boardQuery.data);

	let starting = $state(false);
	let busyId = $state<Id<'purchaseRequests'> | null>(null);
	let error = $state('');

	const requestHref = (id: Id<'purchaseRequests'>) => `/app/org/${organizationId}/purchase/${id}`;

	async function startRequest(files: File[]) {
		const session = clerkContext.currentSession;
		if (!session || starting) return;
		starting = true;
		error = '';
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
				organizationId
			});
			if (files.length > 0) void startUploads(session, id, files, 'auto');
			await goto(requestHref(id));
		} catch (err) {
			error = errorMessage(err);
		} finally {
			starting = false;
		}
	}

	async function fillOnEngage(item: BoardItem) {
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
</script>

<svelte:head>
	<title>{board?.organization.name ?? 'Requests'} · Engage Form</title>
</svelte:head>

<AppShell {organizationId}>
	<main class="mx-auto flex max-w-5xl flex-col gap-10 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
		<div class="flex items-end justify-between gap-4">
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">
				{board?.organization.name ?? ' '}
			</h1>
			<button
				class="inline-flex h-10 shrink-0 items-center rounded-full border border-stone-300 px-4 text-sm font-medium hover:border-stone-900 disabled:opacity-60"
				type="button"
				disabled={starting}
				onclick={() => startRequest([])}
			>
				New request
			</button>
		</div>

		<ReceiptDrop busy={starting} onFiles={startRequest} />

		{#if error}
			<p class="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
				{error}
			</p>
		{/if}

		{#if boardQuery.error}
			<p class="text-sm text-red-700">{errorMessage(boardQuery.error)}</p>
		{:else if board}
			<section class="flex flex-col gap-3" aria-labelledby="needs-info">
				<h2 id="needs-info" class="flex items-baseline gap-2 text-lg font-semibold">
					Needs info
					<span class="text-sm font-normal text-stone-500">{board.needsInfo.length || ''}</span>
				</h2>
				{#if board.needsInfo.length === 0}
					<p class="text-sm text-stone-500">
						Requests you start wait here until they have everything Engage asks for.
					</p>
				{:else}
					<ul class="divide-y divide-stone-200 border-y border-stone-200">
						{#each board.needsInfo as item (item.id)}
							<RequestRow {item} href={requestHref(item.id)}>
								{#if item.reading}
									<span class="text-sm text-stone-500">Reading receipt…</span>
								{:else if item.nextStep}
									<span class="flex items-center gap-2 text-sm text-stone-700">
										<span class="h-2 w-2 shrink-0 rounded-full bg-[#e0b800]" aria-hidden="true"
										></span>
										{item.nextStep}
									</span>
								{:else}
									<span class="text-sm text-[#154733]">Ready to review</span>
								{/if}
							</RequestRow>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="ready-to-fill">
				<h2 id="ready-to-fill" class="flex items-baseline gap-2 text-lg font-semibold">
					Ready to fill
					<span class="text-sm font-normal text-stone-500">{board.readyToFill.length || ''}</span>
				</h2>
				{#if board.readyToFill.length === 0}
					<p class="text-sm text-stone-500">
						Once a request has everything, fill it on Engage in one click from here.
					</p>
				{:else}
					<ul class="divide-y divide-stone-200 border-y border-stone-200">
						{#each board.readyToFill as item (item.id)}
							<RequestRow {item} href={requestHref(item.id)}>
								<button
									class="inline-flex h-10 items-center rounded-full bg-[#154733] px-4 text-sm font-medium text-white hover:bg-[#0f3526] disabled:opacity-60"
									type="button"
									disabled={busyId === item.id}
									onclick={() => fillOnEngage(item)}
								>
									Fill on Engage
								</button>
							</RequestRow>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="flex flex-col gap-3" aria-labelledby="waiting">
				<h2 id="waiting" class="flex items-baseline gap-2 text-lg font-semibold">
					Waiting on Engage
					<span class="text-sm font-normal text-stone-500"
						>{board.waitingOnEngage.length || ''}</span
					>
				</h2>
				{#if board.waitingOnEngage.length === 0}
					<p class="text-sm text-stone-500">
						After Engage is filled, mark the request approved here when it's signed off.
					</p>
				{:else}
					<ul class="divide-y divide-stone-200 border-y border-stone-200">
						{#each board.waitingOnEngage as item (item.id)}
							<RequestRow {item} href={requestHref(item.id)}>
								<button
									class="inline-flex h-10 items-center rounded-full border border-stone-300 px-4 text-sm font-medium hover:border-stone-900 disabled:opacity-60"
									type="button"
									disabled={busyId === item.id}
									onclick={() => markApproved(item)}
								>
									Mark approved
								</button>
							</RequestRow>
						{/each}
					</ul>
				{/if}
			</section>

			{#if board.approved.length > 0}
				<details class="group flex flex-col gap-3">
					<summary
						class="flex cursor-pointer list-none items-baseline gap-2 text-lg font-semibold [&::-webkit-details-marker]:hidden"
					>
						<svg
							class="self-center transition-transform group-open:rotate-90"
							viewBox="0 0 12 12"
							width="12"
							height="12"
							aria-hidden="true"
						>
							<path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" stroke-width="1.5" />
						</svg>
						Approved
						<span class="text-sm font-normal text-stone-500">
							{board.approved.length}{board.hasMoreApproved ? '+' : ''}
						</span>
					</summary>
					<ul class="mt-3 divide-y divide-stone-200 border-y border-stone-200">
						{#each board.approved as item (item.id)}
							<RequestRow {item} href={requestHref(item.id)} muted />
						{/each}
					</ul>
				</details>
			{/if}
		{:else}
			<p class="text-sm text-stone-500">Loading requests…</p>
		{/if}
	</main>
</AppShell>
