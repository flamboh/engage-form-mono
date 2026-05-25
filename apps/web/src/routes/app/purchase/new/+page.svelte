<script lang="ts">
	import { browser } from '$app/environment';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import FilePicker from '$lib/purchase/FilePicker.svelte';
	import PurchaseFields from '$lib/purchase/PurchaseFields.svelte';
	import RecipientRows from '$lib/purchase/RecipientRows.svelte';
	import SavedSetup, { type PurchaserRef } from '$lib/purchase/SavedSetup.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type Recipient = { name: string; uo95: string; reason: string; value: number };
	type SavedData = {
		organizations: Doc<'organizations'>[];
		purchasers: Doc<'purchasers'>[];
		eventPresets: Doc<'eventPresets'>[];
	};
	type TypeOfPurchase = Doc<'purchaseRequests'>['typeOfPurchase'];
	type DocumentationCategory = Doc<'purchaseRequests'>['documentationCategories'][number];
	type FundLetter = Doc<'organizations'>['fundLetter'];
	type StudentOrganizationDetails = {
		name: string;
		indexNumber: string;
		fundLetter: FundLetter;
		budgetLines: string[];
		businessPurposeTemplate: string;
	};
	type RequesterDetails = {
		id: Id<'users'>;
		name: string;
		email: string;
		phone: string;
		uo95: string;
		permanentAddress: string;
		idCardFrontFileId: Id<'files'>;
		idCardBackFileId: Id<'files'>;
	};
	type PurchaserDetails = {
		id: Id<'users'> | Id<'purchasers'>;
		name: string;
		uo95: string;
		permanentAddress: string;
		idCardFrontFileId: Id<'files'>;
		idCardBackFileId: Id<'files'>;
	};

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const currentUserQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, () =>
		clerkContext.currentSession ? {} : 'skip'
	);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);

	let currentUser = $state<Doc<'users'> | null>(null);
	let savedData = $state<SavedData | undefined>();
	let draftId = $state<Id<'purchaseRequests'> | null>(null);
	let organizationSourceId = $state<Id<'organizations'> | null>(null);
	let purchaserSource = $state<PurchaserRef>({ kind: 'self' });
	let studentOrganization = $state<StudentOrganizationDetails>({
		name: '',
		indexNumber: '',
		fundLetter: 'I',
		budgetLines: [],
		businessPurposeTemplate: ''
	});
	let requester = $state<RequesterDetails | null>(null);
	let purchaser = $state<PurchaserDetails | null>(null);
	let typeOfPurchase = $state<TypeOfPurchase>('personal_reimbursement');
	let documentationCategories = $state<DocumentationCategory[]>([]);
	let eventTemplateId = $state<Id<'eventPresets'> | null>(null);
	let eventName = $state('');
	let eventDate = $state('');
	let eventTime = $state('');
	let eventLocation = $state('');
	let eventEstimatedAttendance = $state(0);
	let vendor = $state('');
	let itemDescription = $state('');
	let totalAmount = $state(0);
	let budgetLineItem = $state('');
	let businessPurposeText = $state('');
	let businessPurposeTouched = $state(false);
	let recipients = $state<Recipient[]>([]);
	let receiptFileIds = $state<Id<'files'>[]>([]);
	let secondApprovalFileId = $state<Id<'files'> | null>(null);
	let publicityFileId = $state<Id<'files'> | null>(null);
	let cateringWaiverFileId = $state<Id<'files'> | null>(null);
	let printingInvoiceFileId = $state<Id<'files'> | null>(null);
	let brandApprovalFileId = $state<Id<'files'> | null>(null);
	let officeLocation = $state('');
	let buildingManagerApprovalFileId = $state<Id<'files'> | null>(null);
	let computerPriceQuoteFileId = $state<Id<'files'> | null>(null);
	let saveState = $state('Draft starting...');
	let error = $state('');
	let draftInitializing = $state(false);

	const purchasers = $derived(
		(savedData?.purchasers ?? []).filter((p) => p.organizationId === organizationSourceId)
	);
	const eventPresets = $derived(
		(savedData?.eventPresets ?? []).filter(
			(eventPreset) => eventPreset.organizationId === organizationSourceId
		)
	);
	const selectedOrg = $derived(
		(savedData?.organizations ?? []).find((org) => org._id === organizationSourceId)
	);
	const selectedPurchaser = $derived.by(() => {
		if (purchaserSource.kind !== 'purchaser') return undefined;
		const id = purchaserSource.purchaserId;
		return purchasers.find((p) => p._id === id);
	});
	const purchaserIsSelf = $derived(purchaserSource.kind === 'self');
	const asuoFundsApplies = $derived(
		studentOrganization.fundLetter === 'I' || documentationCategories.includes('asuo_funds')
	);
	const foodApplies = $derived(documentationCategories.includes('food'));
	const printingServicesApplies = $derived(documentationCategories.includes('printing_services'));
	const officeSuppliesGoodsApplies = $derived(
		documentationCategories.includes('office_supplies_goods')
	);
	const merchandiseApparelApplies = $derived(
		documentationCategories.includes('merchandise_apparel')
	);
	const recipientCategoryApplies = $derived(
		merchandiseApparelApplies || documentationCategories.includes('gifts_prizes')
	);
	const purchaserName = $derived(purchaser?.name ?? '{purchaser}');
	let lastOrganizationId = $state<Id<'organizations'> | null>(null);
	let lastPurchaserKey = $state('');

	$effect(() => {
		if (organizationSourceId === lastOrganizationId) return;
		if (selectedOrg === undefined) {
			studentOrganization = {
				name: '',
				indexNumber: '',
				fundLetter: 'I',
				budgetLines: [],
				businessPurposeTemplate: ''
			};
		} else {
			studentOrganization = {
				name: selectedOrg.name,
				indexNumber: selectedOrg.indexNumber,
				fundLetter: selectedOrg.fundLetter,
				budgetLines: selectedOrg.budgetLines,
				businessPurposeTemplate: selectedOrg.businessPurposeTemplate
			};
		}
		const lines = studentOrganization.budgetLines;
		budgetLineItem = lines[0] ?? '';
		lastOrganizationId = organizationSourceId;
		onFieldChange();
	});

	$effect(() => {
		const key =
			purchaserSource.kind === 'self'
				? `self:${currentUser?._id ?? ''}`
				: `purchaser:${selectedPurchaser?._id ?? purchaserSource.purchaserId}`;
		if (key === lastPurchaserKey) return;
		lastPurchaserKey = key;
		if (currentUser !== null) requester = userAsRequester(currentUser);
		purchaser =
			purchaserSource.kind === 'self'
				? currentUser === null
					? purchaser
					: userAsPurchaser(currentUser)
				: selectedPurchaser === undefined
					? purchaser
					: savedPurchaserDetails(selectedPurchaser);
		onFieldChange();
	});

	$effect(() => {
		currentUser = currentUserQuery.data ?? null;
		savedData = savedQuery.data;
	});

	$effect(() => {
		if (!clerkContext.currentSession || draftId !== null || draftInitializing) return;
		draftInitializing = true;
		void initializeDraft();
	});

	async function initializeDraft() {
		await Promise.all([loadCurrentUser(), loadSaved()]);
		const existingDraftId = browser
			? (new URLSearchParams(window.location.search).get('id') as Id<'purchaseRequests'> | null)
			: null;
		if (existingDraftId === null) {
			await startDraft();
			return;
		}
		await loadDraft(existingDraftId);
	}

	async function loadCurrentUser() {
		currentUser = currentUserQuery.data ?? null;
	}

	async function startDraft() {
		const session = clerkContext.currentSession;
		if (!session) return;
		try {
			draftId = await client.mutation(api.authed.purchaseBuilder.createDraft, {});
			saveState = 'Draft autosaves';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saveState = 'Draft failed';
		}
	}

	async function loadSaved() {
		const session = clerkContext.currentSession;
		if (!session) return;
		try {
			savedData = savedQuery.data;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function loadDraft(id: Id<'purchaseRequests'>) {
		const session = clerkContext.currentSession;
		if (!session) return;
		try {
			const draft = await client.query(api.authed.purchaseBuilder.getDraft, { id });
			draftId = draft._id;
			organizationSourceId = draft.organizationSourceId;
			purchaserSource = draft.purchaserSource;
			studentOrganization = draft.studentOrganization;
			requester = draft.requester;
			purchaser = draft.purchaser;
			typeOfPurchase = draft.typeOfPurchase;
			documentationCategories = draft.documentationCategories;
			eventName = draft.eventName;
			eventDate = draft.eventDate;
			eventTime = draft.eventTime;
			eventLocation = draft.eventLocation;
			eventEstimatedAttendance = draft.eventEstimatedAttendance;
			vendor = draft.vendor;
			itemDescription = draft.itemDescription;
			totalAmount = draft.totalAmount;
			budgetLineItem = draft.budgetLineItem;
			businessPurposeText = draft.businessPurposeText;
			businessPurposeTouched = draft.businessPurposeTouched;
			receiptFileIds = draft.receiptFileIds;
			secondApprovalFileId = draft.secondApprovalFileId;
			publicityFileId = draft.publicityFileId;
			cateringWaiverFileId = draft.cateringWaiverFileId;
			printingInvoiceFileId = draft.printingInvoiceFileId;
			brandApprovalFileId = draft.brandApprovalFileId;
			officeLocation = draft.officeLocation;
			buildingManagerApprovalFileId = draft.buildingManagerApprovalFileId;
			computerPriceQuoteFileId = draft.computerPriceQuoteFileId;
			recipients = draft.recipients;
			lastOrganizationId = draft.organizationSourceId;
			saveState = 'Draft autosaves';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			saveState = 'Draft failed';
		}
	}

	function patch() {
		return {
			organizationSourceId,
			purchaserSource,
			studentOrganization,
			...(requester === null ? {} : { requester }),
			...(purchaser === null ? {} : { purchaser }),
			typeOfPurchase,
			documentationCategories,
			eventName,
			eventDate,
			eventTime,
			eventLocation,
			eventEstimatedAttendance,
			vendor,
			itemDescription,
			totalAmount,
			budgetLineItem,
			businessPurposeText,
			businessPurposeTouched,
			receiptFileIds,
			secondApprovalFileId,
			publicityFileId,
			cateringWaiverFileId,
			printingInvoiceFileId,
			brandApprovalFileId,
			officeLocation,
			buildingManagerApprovalFileId,
			computerPriceQuoteFileId,
			recipients
		};
	}

	async function autosave() {
		const session = clerkContext.currentSession;
		if (draftId === null || !session) return;
		saveState = 'Autosaving...';
		await client.mutation(api.authed.purchaseBuilder.scheduleDraftAutosave, {
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
			org: studentOrganization.name || '{org}',
			requester: requester?.name ?? '{requester}',
			purchaser: purchaserName,
			vendor: vendor || '{vendor}',
			item: itemDescription || '{item}',
			amount: totalAmount > 0 ? money(totalAmount) : '{amount}',
			recipient: firstRecipient?.name || 'N/A',
			recipientUo95: firstRecipient?.uo95 || 'N/A',
			recipientReason: firstRecipient?.reason || 'N/A',
			eventName: eventName || '{eventName}',
			eventDate: eventDate || '{eventDate}',
			eventTime: eventTime || '{eventTime}',
			eventLocation: eventLocation || '{eventLocation}',
			attendance:
				eventEstimatedAttendance > 0 ? eventEstimatedAttendance.toString() : '{attendance}'
		};
		return Object.entries(values).reduce(
			(text, [key, value]) => text.replaceAll(`{${key}}`, value),
			studentOrganization.businessPurposeTemplate
		);
	}

	async function uploadRequestFile(
		kind:
			| 'receipt'
			| 'second_approval'
			| 'publicity'
			| 'catering_waiver'
			| 'printing_invoice'
			| 'brand_approval'
			| 'building_manager_approval'
			| 'computer_price_quote',
		input: HTMLInputElement
	) {
		const session = clerkContext.currentSession;
		const files = Array.from(input.files ?? []).slice(0, kind === 'receipt' ? 3 : 1);
		if (files.length === 0 || !session) return;
		const ids: Id<'files'>[] = [];
		for (const file of files) {
			ids.push(await uploadFile(session, kind, file));
		}
		if (kind === 'receipt') receiptFileIds = ids;
		if (kind === 'second_approval') secondApprovalFileId = ids[0] ?? null;
		if (kind === 'publicity') publicityFileId = ids[0] ?? null;
		if (kind === 'catering_waiver') cateringWaiverFileId = ids[0] ?? null;
		if (kind === 'printing_invoice') printingInvoiceFileId = ids[0] ?? null;
		if (kind === 'brand_approval') brandApprovalFileId = ids[0] ?? null;
		if (kind === 'building_manager_approval') buildingManagerApprovalFileId = ids[0] ?? null;
		if (kind === 'computer_price_quote') computerPriceQuoteFileId = ids[0] ?? null;
		await autosave();
	}

	async function markReady() {
		const session = clerkContext.currentSession;
		if (draftId === null || !session) return;
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.markReady, {
				id: draftId,
				patch: patch()
			});
			saveState = 'Ready for extension';
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function discard() {
		const session = clerkContext.currentSession;
		if (draftId === null || !session) return;
		await client.mutation(api.authed.purchaseBuilder.discardDraft, {
			id: draftId
		});
		location.href = '/app';
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	function userAsRequester(user: Doc<'users'>): RequesterDetails {
		return {
			id: user._id,
			name: user.name,
			email: user.studentEmail,
			phone: user.phone,
			uo95: user.uo95,
			permanentAddress: user.permanentAddress,
			idCardFrontFileId: user.idCardFrontFileId,
			idCardBackFileId: user.idCardBackFileId
		};
	}

	function userAsPurchaser(user: Doc<'users'>): PurchaserDetails {
		return {
			id: user._id,
			name: user.name,
			uo95: user.uo95,
			permanentAddress: user.permanentAddress,
			idCardFrontFileId: user.idCardFrontFileId,
			idCardBackFileId: user.idCardBackFileId
		};
	}

	function savedPurchaserDetails(savedPurchaser: Doc<'purchasers'>): PurchaserDetails {
		return {
			id: savedPurchaser._id,
			name: savedPurchaser.name,
			uo95: savedPurchaser.uo95,
			permanentAddress: savedPurchaser.permanentAddress,
			idCardFrontFileId: savedPurchaser.idCardFrontFileId,
			idCardBackFileId: savedPurchaser.idCardBackFileId
		};
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
					<button
						class="rounded-md px-3 py-2 text-sm hover:bg-stone-100"
						type="button"
						onclick={discard}
					>
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
				{savedData}
				bind:organizationSourceId
				bind:purchaserSource
				bind:eventTemplateId
				bind:eventName
				bind:eventTime
				bind:eventLocation
				bind:eventEstimatedAttendance
				onChange={onFieldChange}
				onSavedChange={loadSaved}
			/>

			<PurchaseFields
				bind:typeOfPurchase
				bind:documentationCategories
				fundLetter={studentOrganization.fundLetter}
				bind:eventName
				bind:eventDate
				bind:eventTime
				bind:eventLocation
				bind:eventEstimatedAttendance
				bind:vendor
				bind:itemDescription
				bind:totalAmount
				bind:budgetLineItem
				budgetLineOptions={studentOrganization.budgetLines}
				bind:officeLocation
				onChange={onFieldChange}
			/>

			{#if recipientCategoryApplies}
				<RecipientRows bind:recipients onChange={onFieldChange} />
			{/if}

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
						status={publicityFileId ? 'Uploaded' : asuoFundsApplies ? 'Required' : 'Optional'}
						onFiles={(input) => uploadRequestFile('publicity', input)}
					/>
					{#if foodApplies}
						<FilePicker
							label="Catering waiver"
							status={cateringWaiverFileId ? 'Uploaded' : 'Required'}
							onFiles={(input) => uploadRequestFile('catering_waiver', input)}
						/>
					{/if}
					{#if printingServicesApplies}
						<FilePicker
							label="Printing invoice"
							status={printingInvoiceFileId ? 'Uploaded' : 'Required'}
							onFiles={(input) => uploadRequestFile('printing_invoice', input)}
						/>
					{/if}
					{#if merchandiseApparelApplies}
						<FilePicker
							label="Brand approval"
							status={brandApprovalFileId ? 'Uploaded' : 'Optional'}
							onFiles={(input) => uploadRequestFile('brand_approval', input)}
						/>
					{/if}
					{#if officeSuppliesGoodsApplies}
						<FilePicker
							label="Building manager approval"
							status={buildingManagerApprovalFileId ? 'Uploaded' : 'Optional'}
							onFiles={(input) => uploadRequestFile('building_manager_approval', input)}
						/>
						<FilePicker
							label="Computer price quote"
							status={computerPriceQuoteFileId ? 'Uploaded' : 'Optional'}
							onFiles={(input) => uploadRequestFile('computer_price_quote', input)}
						/>
					{/if}
					{#if purchaserIsSelf}
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
