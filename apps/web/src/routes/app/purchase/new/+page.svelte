<script lang="ts">
	import { browser } from '$app/environment';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import BuilderHeader from '$lib/purchase/BuilderHeader.svelte';
	import BusinessPurposePanel from '$lib/purchase/BusinessPurposePanel.svelte';
	import PurchaseFields from '$lib/purchase/PurchaseFields.svelte';
	import ReadyPanels from '$lib/purchase/ReadyPanels.svelte';
	import RequirementPanels from '$lib/purchase/RequirementPanels.svelte';
	import SavedSetup, { type PurchaserRef } from '$lib/purchase/SavedSetup.svelte';
	import {
		formatBusinessPurposeSource,
		savedPurchaserDetails,
		userAsPurchaser,
		userAsRequester,
		type DocumentationCategory,
		type PurchaserDetails,
		type Recipient,
		type RequesterDetails,
		type SavedData,
		type StudentOrganizationDetails,
		type TypeOfPurchase
	} from '$lib/purchase/draftDetails';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient, useQuery } from 'convex-svelte';

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
	let businessPurposeTemplateId = $state<Id<'businessPurposeTemplates'> | null>(null);
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
	const selectedOrg = $derived(
		(savedData?.organizations ?? []).find((org) => org._id === organizationSourceId)
	);
	const selectedPurchaser = $derived.by(() => {
		if (purchaserSource.kind !== 'purchaser') return undefined;
		const id = purchaserSource.purchaserId;
		return purchasers.find((p) => p._id === id);
	});
	const purchaserIsSelf = $derived(purchaserSource.kind === 'self');
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
			vendor = draft.vendor;
			itemDescription = draft.itemDescription;
			totalAmount = draft.totalAmount;
			budgetLineItem = draft.budgetLineItem;
			businessPurposeText = formatBusinessPurposeSource(draft.businessPurposeSource);
			businessPurposeTouched =
				draft.businessPurposeTouched ||
				businessPurposeText !== draft.studentOrganization.businessPurposeTemplate;
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
		if (!businessPurposeTouched) businessPurposeText = studentOrganization.businessPurposeTemplate;
		void autosave();
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
		<BuilderHeader {saveState} onDiscard={discard} />

		<main class="mx-auto max-w-4xl space-y-5 px-6 py-8">
			{#if error}<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

			<SavedSetup
				session={clerkContext.currentSession}
				{savedData}
				{draftId}
				bind:organizationSourceId
				bind:purchaserSource
				bind:businessPurposeTemplateId
				bind:businessPurposeText
				bind:businessPurposeTouched
				onChange={onFieldChange}
				onSavedChange={loadSaved}
			/>

			<PurchaseFields
				bind:typeOfPurchase
				bind:documentationCategories
				fundLetter={studentOrganization.fundLetter}
				requesterName={requester?.name ?? ''}
				bind:vendor
				bind:itemDescription
				bind:totalAmount
				bind:budgetLineItem
				budgetLineOptions={studentOrganization.budgetLines}
				onChange={onFieldChange}
			/>

			<RequirementPanels
				{documentationCategories}
				fundLetter={studentOrganization.fundLetter}
				{purchaserIsSelf}
				bind:recipients
				{receiptFileIds}
				{secondApprovalFileId}
				{publicityFileId}
				{cateringWaiverFileId}
				{printingInvoiceFileId}
				{brandApprovalFileId}
				bind:officeLocation
				{buildingManagerApprovalFileId}
				{computerPriceQuoteFileId}
				{uploadRequestFile}
				onChange={onFieldChange}
			/>

			<BusinessPurposePanel
				bind:businessPurposeText
				bind:businessPurposeTemplateId
				bind:businessPurposeTouched
				templateText={studentOrganization.businessPurposeTemplate}
				onInput={() => void autosave()}
				onRegenerate={() => void autosave()}
			/>

			<ReadyPanels onMarkReady={markReady} />
		</main>
	</div>
{/if}
