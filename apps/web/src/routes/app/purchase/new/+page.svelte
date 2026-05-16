<script lang="ts">
	import { browser } from '$app/environment';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { convexMutation, convexQuery } from '$lib/convex-http';
	import FilePicker from '$lib/purchase/FilePicker.svelte';
	import PurchaseFields from '$lib/purchase/PurchaseFields.svelte';
	import RecipientRows from '$lib/purchase/RecipientRows.svelte';
	import SavedSetup from '$lib/purchase/SavedSetup.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	type Recipient = { name: string; uo95: string; reason: string; value: number };
	type SavedData = {
		organizations: Doc<'organizations'>[];
		people: Doc<'people'>[];
		eventPresets: Doc<'eventPresets'>[];
	};

	const clerkContext = getClerkContext();

	let savedData = $state<SavedData | undefined>();
	let draftId = $state<Id<'purchaseRequests'> | null>(null);
	let organizationId = $state<Id<'organizations'> | null>(null);
	let purchaserPersonId = $state<Id<'people'> | null>(null);
	let eventPresetId = $state<Id<'eventPresets'> | null>(null);
	let eventDate = $state('');
	let vendor = $state('');
	let itemDescription = $state('');
	let totalAmount = $state(0);
	let budgetLineItem = $state('');
	let reimbursementReason = $state('');
	let businessPurposeText = $state('');
	let businessPurposeTouched = $state(false);
	let recipients = $state<Recipient[]>([{ name: '', uo95: '', reason: '', value: 0 }]);
	let receiptFileIds = $state<Id<'files'>[]>([]);
	let secondApprovalFileId = $state<Id<'files'> | null>(null);
	let publicityFileId = $state<Id<'files'> | null>(null);
	let saveState = $state('Draft starting...');
	let error = $state('');
	let draftInitializing = $state(false);

	const organizations = $derived(savedData?.organizations ?? []);
	const people = $derived(
		(savedData?.people ?? []).filter((person) => person.organizationId === organizationId)
	);
	const eventPresets = $derived(
		(savedData?.eventPresets ?? []).filter((eventPreset) => eventPreset.organizationId === organizationId)
	);
	const requester = $derived(people.find((person) => person.isRequester));
	const purchaser = $derived(people.find((person) => person._id === purchaserPersonId));
	const selectedOrg = $derived(organizations.find((org) => org._id === organizationId));
	const selectedEvent = $derived(eventPresets.find((eventPreset) => eventPreset._id === eventPresetId));
	const requesterIsPurchaser = $derived(
		requester !== undefined && purchaserPersonId !== null && requester._id === purchaserPersonId
	);
	let lastOrganizationId = $state<Id<'organizations'> | null>(null);

	$effect(() => {
		if (organizationId === lastOrganizationId) return;
		budgetLineItem = selectedOrg?.defaultBudgetLineItem ?? '';
		lastOrganizationId = organizationId;
		onFieldChange();
	});

	$effect(() => {
		if (!clerkContext.currentSession || draftId !== null || draftInitializing) return;
		draftInitializing = true;
		void initializeDraft();
	});

	async function initializeDraft() {
		await loadSaved();
		const existingDraftId = browser
			? (new URLSearchParams(window.location.search).get('id') as Id<'purchaseRequests'> | null)
			: null;
		if (existingDraftId === null) {
			await startDraft();
			return;
		}
		await loadDraft(existingDraftId);
	}

	async function startDraft() {
		if (!clerkContext.currentSession) return;
		try {
			draftId = await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.createDraft, {});
			saveState = 'Draft autosaves';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saveState = 'Draft failed';
		}
	}

	async function loadSaved() {
		if (!clerkContext.currentSession) return;
		try {
			savedData = await convexQuery(clerkContext.currentSession, api.authed.purchaseBuilder.listSaved, {
				includeArchived: false
			});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function loadDraft(id: Id<'purchaseRequests'>) {
		if (!clerkContext.currentSession) return;
		try {
			const draft = await convexQuery(clerkContext.currentSession, api.authed.purchaseBuilder.getDraft, { id });
			draftId = draft._id;
			organizationId = draft.organizationId;
			purchaserPersonId = draft.purchaserPersonId;
			eventPresetId = draft.eventPresetId;
			eventDate = draft.eventDate;
			vendor = draft.vendor;
			itemDescription = draft.itemDescription;
			totalAmount = draft.totalAmount;
			budgetLineItem = draft.budgetLineItem;
			reimbursementReason = draft.reimbursementReason;
			businessPurposeText = draft.businessPurposeText;
			businessPurposeTouched = draft.businessPurposeTouched;
			receiptFileIds = draft.receiptFileIds;
			secondApprovalFileId = draft.secondApprovalFileId;
			publicityFileId = draft.publicityFileId;
			recipients = draft.recipients.length === 0 ? recipients : draft.recipients;
			lastOrganizationId = draft.organizationId;
			saveState = 'Draft autosaves';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saveState = 'Draft failed';
		}
	}

	function patch() {
		return {
			organizationId,
			purchaserPersonId,
			eventPresetId,
			eventDate,
			vendor,
			itemDescription,
			totalAmount,
			budgetLineItem,
			reimbursementReason,
			businessPurposeText,
			businessPurposeTouched,
			receiptFileIds,
			secondApprovalFileId,
			publicityFileId,
			recipients
		};
	}

	async function autosave() {
		if (draftId === null || !clerkContext.currentSession) return;
		saveState = 'Autosaving...';
		await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.scheduleDraftAutosave, {
			id: draftId,
			patch: patch()
		});
		saveState = 'Autosave queued';
	}

	function onFieldChange() {
		if (!businessPurposeTouched) businessPurposeText = renderBusinessPurpose();
		void autosave();
	}

	function renderBusinessPurpose() {
		const firstRecipient = recipients[0];
		const values: Record<string, string> = {
			org: selectedOrg?.name ?? '{org}',
			requester: requester?.name ?? '{requester}',
			purchaser: purchaser?.name ?? '{purchaser}',
			vendor: vendor || '{vendor}',
			item: itemDescription || '{item}',
			amount: totalAmount > 0 ? money(totalAmount) : '{amount}',
			recipient: firstRecipient?.name || '{recipient}',
			recipientUo95: firstRecipient?.uo95 || '{recipientUo95}',
			recipientReason: firstRecipient?.reason || '{recipientReason}',
			eventName: selectedEvent?.name ?? '{eventName}',
			eventDate: eventDate || '{eventDate}',
			eventTime: selectedEvent?.time ?? '{eventTime}',
			eventLocation: selectedEvent?.location ?? '{eventLocation}',
			attendance: selectedEvent?.estimatedAttendance.toString() ?? '{attendance}'
		};
		return Object.entries(values).reduce(
			(text, [key, value]) => text.replaceAll(`{${key}}`, value),
			selectedOrg?.businessPurposeTemplate ?? ''
		);
	}

	async function uploadRequestFile(
		kind: 'receipt' | 'second_approval' | 'publicity',
		input: HTMLInputElement
	) {
		const files = Array.from(input.files ?? []).slice(0, kind === 'receipt' ? 3 : 1);
		if (files.length === 0) return;
		if (!clerkContext.currentSession) return;
		const ids: Id<'files'>[] = [];
		for (const file of files) {
			const uploadUrl = await convexMutation(
				clerkContext.currentSession,
				api.authed.purchaseBuilder.generateUploadUrl,
				{}
			);
			const response = await fetch(uploadUrl, {
				method: 'POST',
				headers: { 'Content-Type': file.type || 'application/octet-stream' },
				body: file
			});
			const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
			ids.push(
				await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.saveFile, {
					kind,
					storageId,
					filename: file.name,
					contentType: file.type || 'application/octet-stream',
					size: file.size
				})
			);
		}
		if (kind === 'receipt') receiptFileIds = ids;
		if (kind === 'second_approval') secondApprovalFileId = ids[0] ?? null;
		if (kind === 'publicity') publicityFileId = ids[0] ?? null;
		await autosave();
	}

	async function markReady() {
		if (draftId === null || !clerkContext.currentSession) return;
		error = '';
		try {
			await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.markReady, {
				id: draftId,
				patch: patch()
			});
			saveState = 'Ready for extension';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function discard() {
		if (draftId === null || !clerkContext.currentSession) return;
		await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.discardDraft, {
			id: draftId
		});
		location.href = '/app';
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div
			{@attach (el) => {
				clerkContext.clerk.mountSignIn(el, {});
			}}
		></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<header class="sticky top-0 z-10 border-b border-stone-200 bg-white">
			<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
				<div class="flex items-center gap-3">
					<a class="text-sm text-stone-500 hover:text-stone-900" href="/app">Back</a>
					<h1 class="text-lg font-semibold">Event prize reimbursement</h1>
				</div>
				<div class="flex items-center gap-3">
					<span class="text-xs text-stone-500">{saveState}</span>
					<button class="rounded-md px-3 py-2 text-sm hover:bg-stone-100" type="button" onclick={discard}>
						Discard
					</button>
					<button
						class="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
						type="button"
						onclick={markReady}
					>
						Ready for extension
					</button>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-4xl space-y-5 px-6 py-8">
			{#if error}<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

			<SavedSetup
				session={clerkContext.currentSession}
				savedData={savedData}
				bind:organizationId
				bind:purchaserPersonId
				bind:eventPresetId
				onChange={onFieldChange}
				onSavedChange={loadSaved}
			/>

			<PurchaseFields
				bind:eventDate
				bind:vendor
				bind:itemDescription
				bind:totalAmount
				bind:budgetLineItem
				bind:reimbursementReason
				onChange={onFieldChange}
			/>

			<RecipientRows bind:recipients onChange={onFieldChange} />

			<section class="panel">
				<h2>Business purpose</h2>
				<textarea
					class="field min-h-36"
					bind:value={businessPurposeText}
					oninput={() => {
						businessPurposeTouched = true;
						void autosave();
					}}
				></textarea>
				<button
					class="secondary mt-3"
					type="button"
					onclick={() => {
						businessPurposeText = renderBusinessPurpose();
						businessPurposeTouched = false;
						void autosave();
					}}
				>
					Regenerate
				</button>
			</section>

			<section class="panel">
				<h2>Files</h2>
				<div class="grid gap-4 md:grid-cols-3">
					<FilePicker
						label="Receipts"
						multiple
						status={`${receiptFileIds.length}/3 uploaded`}
						onFiles={(input) => uploadRequestFile('receipt', input)}
					/>
					<FilePicker
						label="Publicity proof"
						status={publicityFileId ? 'Uploaded' : 'Required'}
						onFiles={(input) => uploadRequestFile('publicity', input)}
					/>
					{#if requesterIsPurchaser}
						<FilePicker
							label="Second approval"
							status={secondApprovalFileId ? 'Uploaded' : 'Required'}
							onFiles={(input) => uploadRequestFile('second_approval', input)}
						/>
					{/if}
				</div>
			</section>
		</main>
	</div>
{/if}

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
	}
</style>
