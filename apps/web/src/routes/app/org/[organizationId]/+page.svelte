<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import AppHeader from '$lib/app/AppHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { flip } from 'svelte/animate';
	import { dndzone, TRIGGERS, type DndEvent } from 'svelte-dnd-action';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type ColumnId = 'drafts' | 'ready' | 'filled' | 'approved';
	type Board = Record<ColumnId, BoardItem[]>;
	type BoardItem = {
		id: string;
		purchase: Doc<'purchaseRequests'>;
	};
	type OrganizationForm = {
		name: string;
		indexNumber: string;
		fundLetter: Doc<'organizations'>['fundLetter'];
		budgetLines: string;
		businessPurposeTemplate: string;
	};

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const purchasesQuery = useQuery(api.authed.purchaseBuilder.listOrganizationPurchases, () =>
		clerkContext.currentSession ? { organizationId } : 'skip'
	);

	const defaultTemplate =
		'{Student Organization} wishes to reimburse {Purchaser} because they purchased {Item Description} from {Vendor} for {Total Amount}.';
	let createOpen = $state(false);
	let createError = $state('');
	let backfillStarted = $state(false);
	let activeDragId = $state<string | null>(null);
	let board = $state<Board>(emptyBoard());
	let purchaseSignature = $state('');
	let form = $state<OrganizationForm>({
		name: '',
		indexNumber: '',
		fundLetter: 'I',
		budgetLines: 'Event Expenses',
		businessPurposeTemplate: defaultTemplate
	});

	const organizations = $derived(savedQuery.data?.organizations ?? []);
	const organization = $derived(organizations.find((org) => org._id === organizationId));
	const purchases = $derived(purchasesQuery.data ?? []);
	const flipDurationMs = 120;

	const columns = [
		{ id: 'drafts' as const, label: 'Drafts' },
		{ id: 'ready' as const, label: 'Ready' },
		{ id: 'filled' as const, label: 'Filled' },
		{ id: 'approved' as const, label: 'Approved' }
	];

	$effect(() => {
		if (!clerkContext.currentSession || backfillStarted) return;
		backfillStarted = true;
		void client.mutation(api.authed.purchaseBuilder.backfillMyPurchaseData, {});
	});

	$effect(() => {
		const nextSignature = signatureFor(purchases);
		if (activeDragId !== null || nextSignature === purchaseSignature) return;
		board = boardFromPurchases(purchases);
		purchaseSignature = nextSignature;
	});

	async function createOrganization() {
		createError = '';
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: form.name,
				indexNumber: form.indexNumber,
				fundLetter: form.fundLetter,
				budgetLines: form.budgetLines.split(',').map((line) => line.trim()),
				businessPurposeTemplate: form.businessPurposeTemplate
			});
			createOpen = false;
			await goto(`/app/org/${id}`);
		} catch (err) {
			createError = err instanceof Error ? err.message : String(err);
		}
	}

	async function createDraft() {
		const id = await client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
			organizationId
		});
		await goto(`/app/org/${organizationId}/purchase/${id}`);
	}

	function handleDndConsider(column: ColumnId, event: CustomEvent<DndEvent<BoardItem>>) {
		activeDragId = event.detail.info.id;
		board[column] = event.detail.items;
	}

	async function handleDndFinalize(column: ColumnId, event: CustomEvent<DndEvent<BoardItem>>) {
		const purchaseId = event.detail.info.id as Id<'purchaseRequests'>;
		activeDragId = null;
		board[column] = event.detail.items;
		if (
			event.detail.info.trigger === TRIGGERS.DROPPED_OUTSIDE_OF_ANY ||
			!event.detail.items.some((item) => item.id === purchaseId)
		) {
			return;
		}
		const purchase = purchases.find((item) => item._id === purchaseId);
		if (purchase === undefined) return;
		const startingColumn = columnForPurchase(purchase);
		if (column === startingColumn) return;
		try {
			if (column === 'filled' && startingColumn === 'ready') {
				await client.mutation(api.authed.purchaseBuilder.markFilled, { id: purchaseId });
				return;
			}
			if (column === 'approved' && startingColumn === 'filled') {
				await client.mutation(api.authed.purchaseBuilder.markApproved, { id: purchaseId });
				return;
			}
			if (column === 'ready' && startingColumn === 'filled') {
				await client.mutation(api.authed.purchaseBuilder.reopenPurchase, {
					id: purchaseId,
					clearFilled: true
				});
				return;
			}
			if (purchase.status === 'approved' && column === 'filled') {
				await client.mutation(api.authed.purchaseBuilder.reopenPurchase, {
					id: purchaseId,
					clearFilled: false
				});
				return;
			}
			if (purchase.status === 'approved' && column === 'ready') {
				await client.mutation(api.authed.purchaseBuilder.reopenPurchase, {
					id: purchaseId,
					clearFilled: true
				});
				return;
			}
			board = boardFromPurchases(purchases);
		} catch (err) {
			board = boardFromPurchases(purchases);
			throw err;
		}
	}

	function isDropFromOthersDisabled(column: ColumnId) {
		if (column === 'drafts') return true;
		if (activeDragId === null) return false;
		const purchase = purchases.find((item) => item._id === activeDragId);
		if (purchase === undefined) return false;
		if (purchase.status === 'approved') return column !== 'ready' && column !== 'filled';
		if (columnForPurchase(purchase) === 'ready') return column !== 'filled';
		if (columnForPurchase(purchase) === 'filled')
			return column !== 'ready' && column !== 'approved';
		return true;
	}

	function emptyBoard(): Board {
		return { drafts: [], ready: [], filled: [], approved: [] };
	}

	function boardFromPurchases(list: Doc<'purchaseRequests'>[]): Board {
		const next = emptyBoard();
		for (const purchase of list) {
			next[columnForPurchase(purchase)].push({ id: purchase._id, purchase });
		}
		return next;
	}

	function columnForPurchase(purchase: Doc<'purchaseRequests'>): ColumnId {
		if (purchase.status === 'draft') return 'drafts';
		if (purchase.status === 'approved') return 'approved';
		return purchase.lastFilledAt === null ? 'ready' : 'filled';
	}

	function signatureFor(list: Doc<'purchaseRequests'>[]) {
		return list
			.map((purchase) =>
				[
					purchase._id,
					purchase.status,
					purchase.lastFilledAt ?? '',
					purchase.updatedAt,
					purchase.itemDescription,
					purchase.totalAmount,
					purchase.activityDate
				].join(':')
			)
			.join('|');
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
</script>

<div class="min-h-screen bg-background text-foreground">
	<AppHeader
		{organizations}
		bind:createOpen
		bind:form
		error={createError}
		onCreate={createOrganization}
	/>

	<main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
		<div class="mb-8 flex items-center justify-between gap-4">
			<div>
				<p class="text-sm text-muted-foreground">Purchase requests</p>
				<h1 class="text-2xl font-semibold">{organization?.name ?? 'Student org'}</h1>
			</div>
			<Button onclick={createDraft}>New request</Button>
		</div>

		{#if purchasesQuery.isLoading}
			<p class="text-sm text-muted-foreground">Loading...</p>
		{:else if purchasesQuery.error}
			<p class="text-sm text-destructive">{purchasesQuery.error.message}</p>
		{:else}
			<div class="grid gap-4 lg:grid-cols-4">
				{#each columns as column (column.id)}
					<section class="min-h-[520px] rounded-lg border border-border bg-muted/20 p-3">
						<div class="mb-3 flex items-center justify-between px-1">
							<h2 class="text-sm font-semibold">{column.label}</h2>
						</div>
						{#if column.id === 'drafts'}
							<button
								class="mb-3 w-full rounded-lg border border-dashed border-border p-4 text-left text-sm font-medium hover:bg-background"
								type="button"
								onclick={createDraft}
							>
								Create new
							</button>
						{/if}
						<div
							class="flex min-h-[460px] flex-col gap-3"
							aria-label={column.label}
							use:dndzone={{
								items: board[column.id],
								type: 'purchase-request',
								flipDurationMs,
								dropFromOthersDisabled: isDropFromOthersDisabled(column.id)
							}}
							onconsider={(event) => handleDndConsider(column.id, event)}
							onfinalize={(event) => void handleDndFinalize(column.id, event)}
						>
							{#each board[column.id] as item (item.id)}
								<div animate:flip={{ duration: flipDurationMs }}>
									<a
										class="block"
										aria-label={item.purchase.itemDescription || 'Untitled purchase request'}
										href={`/app/org/${organizationId}/purchase/${item.purchase._id}`}
									>
										<Card>
											<CardContent class="flex flex-col gap-2 p-4">
												<h3 class="text-sm font-semibold">
													{item.purchase.itemDescription || 'Untitled purchase request'}
												</h3>
												<p class="text-sm text-muted-foreground">
													{money(item.purchase.totalAmount)}
												</p>
												<p class="text-xs text-muted-foreground">
													{item.purchase.purchaser.name}
													{#if item.purchase.activityDate}
														· {item.purchase.activityDate}
													{/if}
												</p>
											</CardContent>
										</Card>
									</a>
								</div>
							{/each}
						</div>
					</section>
				{/each}
			</div>
		{/if}
	</main>
</div>
