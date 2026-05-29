<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { requirementPanelsFor } from '$lib/purchase/builderFlow';
	import {
		formatBusinessPurposeSource,
		savedPurchaserDetails,
		userAsPurchaser,
		type DocumentationCategory,
		type PurchaserDetails,
		type Recipient,
		type TypeOfPurchase
	} from '$lib/purchase/draftDetails';
	import { createSingleFlight } from '$lib/singleFlight';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type Section = 'setup' | 'details' | 'requirements' | 'businessPurpose' | 'review';
	type PurchaserRef = { kind: 'self' } | { kind: 'purchaser'; purchaserId: Id<'purchasers'> };
	type WizardSnapshot = Omit<WizardState, 'purchaser'> & { purchaser: PurchaserDetails };
	type UploadKind =
		| 'receipt'
		| 'second_approval'
		| 'publicity'
		| 'catering_waiver'
		| 'printing_invoice'
		| 'brand_approval'
		| 'building_manager_approval'
		| 'computer_price_quote';
	type WizardState = {
		typeOfPurchase: TypeOfPurchase;
		documentationCategories: DocumentationCategory[];
		purchaserSource: PurchaserRef;
		purchaser: PurchaserDetails | null;
		activityDate: string;
		vendor: string;
		itemDescription: string;
		totalAmount: number | null;
		budgetLineItem: string;
		businessPurposeText: string;
		businessPurposeTouched: boolean;
		receiptFileIds: Id<'files'>[];
		secondApprovalFileId: Id<'files'> | null;
		publicityFileId: Id<'files'> | null;
		cateringWaiverFileId: Id<'files'> | null;
		printingInvoiceFileId: Id<'files'> | null;
		brandApprovalFileId: Id<'files'> | null;
		officeLocation: string;
		buildingManagerApprovalFileId: Id<'files'> | null;
		computerPriceQuoteFileId: Id<'files'> | null;
		recipients: Recipient[];
	};

	const sections: { id: Section; label: string }[] = [
		{ id: 'setup', label: 'Setup' },
		{ id: 'details', label: 'Details' },
		{ id: 'requirements', label: 'Requirements' },
		{ id: 'businessPurpose', label: 'Business Purpose' },
		{ id: 'review', label: 'Review' }
	];
	const categoryOptions: { value: DocumentationCategory; label: string }[] = [
		{ value: 'asuo_funds', label: 'ASUO Funds' },
		{ value: 'food', label: 'Food' },
		{ value: 'printing_services', label: 'Printing Services' },
		{ value: 'office_supplies_goods', label: 'Office Supplies/Goods' },
		{ value: 'merchandise_apparel', label: 'Merchandise/Apparel' },
		{ value: 'gifts_prizes', label: 'Gifts/Prizes' }
	];

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	const purchaseRequestId = $derived(page.params.purchaseRequestId as Id<'purchaseRequests'>);
	const purchaseQuery = useQuery(api.authed.purchaseBuilder.getPurchase, () =>
		clerkContext.currentSession ? { id: purchaseRequestId } : 'skip'
	);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const userQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	let activeSection = $state<Section>('setup');
	let error = $state('');
	let uploadStatus = $state('');
	let saveError = $state('');
	let businessPurposeTemplateId = $state<Id<'businessPurposeTemplates'> | ''>('');
	let overrides = $state<Partial<WizardState>>({});

	const purchase = $derived(purchaseQuery.data);
	const savedData = $derived(savedQuery.data);
	const currentUser = $derived(userQuery.data ?? null);
	const selectedOrg = $derived(savedData?.organizations.find((org) => org._id === organizationId));
	const purchasers = $derived(
		(savedData?.purchasers ?? []).filter((p) => p.organizationId === organizationId)
	);
	const businessPurposeTemplates = $derived(
		(savedData?.businessPurposeTemplates ?? []).filter(
			(template) => template.organizationId === organizationId
		)
	);
	const baseState = $derived(purchaseToState(purchase));
	const formState = $derived({ ...baseState, ...overrides });
	const checkedCategory = $derived(
		Object.fromEntries(
			categoryOptions.map((option) => [
				option.value,
				option.value === 'asuo_funds' &&
				(selectedOrg?.fundLetter ?? purchase?.studentOrganization.fundLetter) === 'I'
					? true
					: formState.documentationCategories.includes(option.value)
			])
		) as Record<DocumentationCategory, boolean>
	);
	const purchaserIsSelf = $derived(formState.purchaserSource.kind === 'self');
	const requirementPanels = $derived(
		requirementPanelsFor({
			categories: formState.documentationCategories,
			fundLetter: selectedOrg?.fundLetter ?? purchase?.studentOrganization.fundLetter ?? 'I',
			purchaserIsSelf
		})
	);

	const saver = createSingleFlight(async (snapshot: WizardSnapshot) => {
		await client.mutation(api.authed.purchaseBuilder.saveDraftSnapshot, {
			id: purchaseRequestId,
			snapshot
		});
	});

	function updateForm(patch: Partial<WizardState>) {
		const nextState = { ...formState, ...patch };
		overrides = { ...overrides, ...patch };
		if (nextState.purchaser === null && currentUser === null && purchase === undefined) return;
		saveError = '';
		saver.run(snapshot(nextState)).catch((err: unknown) => {
			saveError = err instanceof Error ? err.message : String(err);
		});
	}

	function snapshot(state: WizardState = formState) {
		return {
			...state,
			purchaser: state.purchaser ?? fallbackPurchaser()
		};
	}

	function fileKindFor(panelId: string): UploadKind {
		if (panelId === 'receipts') return 'receipt';
		return panelId as UploadKind;
	}

	function documentStatusFor(panelId: string) {
		const count = documentCountFor(panelId);
		if (count > 0) return `${count} saved`;
		return 'Missing';
	}

	function documentStatusClass(panelId: string, required: boolean) {
		if (documentCountFor(panelId) > 0) {
			return 'rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground';
		}
		if (required) {
			return 'rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive';
		}
		return 'rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground';
	}

	function documentCountFor(panelId: string) {
		if (panelId === 'receipts') return formState.receiptFileIds.length;
		if (panelId === 'second_approval') return formState.secondApprovalFileId === null ? 0 : 1;
		if (panelId === 'publicity') return formState.publicityFileId === null ? 0 : 1;
		if (panelId === 'catering_waiver') return formState.cateringWaiverFileId === null ? 0 : 1;
		if (panelId === 'printing_invoice') return formState.printingInvoiceFileId === null ? 0 : 1;
		if (panelId === 'brand_approval') return formState.brandApprovalFileId === null ? 0 : 1;
		if (panelId === 'building_manager_approval') {
			return formState.buildingManagerApprovalFileId === null ? 0 : 1;
		}
		if (panelId === 'computer_price_quote') {
			return formState.computerPriceQuoteFileId === null ? 0 : 1;
		}
		return 0;
	}

	function toggleCategory(category: DocumentationCategory, checked: boolean) {
		if (
			category === 'asuo_funds' &&
			(selectedOrg?.fundLetter ?? purchase?.studentOrganization.fundLetter) === 'I'
		) {
			return;
		}
		updateForm({
			documentationCategories: checked
				? [...new Set([...formState.documentationCategories, category])]
				: formState.documentationCategories.filter(
						(item: DocumentationCategory) => item !== category
					)
		});
	}

	function selectPurchaseType(value: string) {
		updateForm({ typeOfPurchase: value as TypeOfPurchase });
	}

	function selectPurchaser(value: string) {
		if (value === 'self') {
			updateForm({
				purchaserSource: { kind: 'self' },
				purchaser: currentUser !== null ? userAsPurchaser(currentUser) : formState.purchaser
			});
		} else {
			const purchaser = purchasers.find((item) => item._id === value);
			if (purchaser === undefined) return;
			updateForm({
				purchaserSource: { kind: 'purchaser', purchaserId: purchaser._id },
				purchaser: savedPurchaserDetails(purchaser)
			});
		}
	}

	function updateAmount(value: string) {
		const amount = Number(value);
		updateForm({ totalAmount: value.trim() === '' || Number.isNaN(amount) ? null : amount });
	}

	async function selectBusinessPurposeTemplate(value: string) {
		if (value === '') {
			businessPurposeTemplateId = '';
			return;
		}
		const templateId = value as Id<'businessPurposeTemplates'>;
		businessPurposeTemplateId = templateId;
		saveError = '';
		try {
			const updated = await client.mutation(
				api.authed.purchaseBuilder.applyBusinessPurposeTemplate,
				{
					draftId: purchaseRequestId,
					templateId
				}
			);
			overrides = {
				...overrides,
				businessPurposeText: formatBusinessPurposeSource(updated.businessPurposeSource),
				businessPurposeTouched: updated.businessPurposeTouched
			};
		} catch (err) {
			saveError = err instanceof Error ? err.message : String(err);
		}
	}

	async function upload(kind: UploadKind, input: HTMLInputElement) {
		const session = clerkContext.currentSession;
		const file = input.files?.[0];
		if (!session || file === undefined) return;
		uploadStatus = 'Uploading...';
		const id = await uploadFile(session, kind, file);
		uploadStatus = 'Uploaded';
		if (kind === 'receipt') updateForm({ receiptFileIds: [id] });
		if (kind === 'second_approval') updateForm({ secondApprovalFileId: id });
		if (kind === 'publicity') updateForm({ publicityFileId: id });
		if (kind === 'catering_waiver') updateForm({ cateringWaiverFileId: id });
		if (kind === 'printing_invoice') updateForm({ printingInvoiceFileId: id });
		if (kind === 'brand_approval') updateForm({ brandApprovalFileId: id });
		if (kind === 'building_manager_approval') updateForm({ buildingManagerApprovalFileId: id });
		if (kind === 'computer_price_quote') updateForm({ computerPriceQuoteFileId: id });
	}

	async function markReady() {
		error = '';
		try {
			await saver.flush();
			await client.mutation(api.authed.purchaseBuilder.markReady, { id: purchaseRequestId });
			await goto(`/app/org/${organizationId}`);
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function addRecipient() {
		updateForm({
			recipients: [...formState.recipients, { name: '', uo95: '', reason: '', value: 0 }]
		});
	}

	function updateRecipient(index: number, patch: Partial<Recipient>) {
		updateForm({
			recipients: formState.recipients.map((recipient, itemIndex) =>
				itemIndex === index ? { ...recipient, ...patch } : recipient
			)
		});
	}

	function purchaseToState(request: typeof purchase): WizardState {
		if (request === undefined) return emptyState();
		return {
			typeOfPurchase: request.typeOfPurchase,
			documentationCategories: request.documentationCategories,
			purchaserSource: request.purchaserSource,
			purchaser: request.purchaser,
			activityDate: request.activityDate,
			vendor: request.vendor,
			itemDescription: request.itemDescription,
			totalAmount: request.totalAmount || null,
			budgetLineItem: request.budgetLineItem,
			businessPurposeText: formatBusinessPurposeSource(request.businessPurposeSource),
			businessPurposeTouched: request.businessPurposeTouched,
			receiptFileIds: request.receiptFileIds,
			secondApprovalFileId: request.secondApprovalFileId,
			publicityFileId: request.publicityFileId,
			cateringWaiverFileId: request.cateringWaiverFileId,
			printingInvoiceFileId: request.printingInvoiceFileId,
			brandApprovalFileId: request.brandApprovalFileId,
			officeLocation: request.officeLocation,
			buildingManagerApprovalFileId: request.buildingManagerApprovalFileId,
			computerPriceQuoteFileId: request.computerPriceQuoteFileId,
			recipients: request.recipients
		};
	}

	function emptyState(): WizardState {
		return {
			typeOfPurchase: 'personal_reimbursement',
			documentationCategories: [],
			purchaserSource: { kind: 'self' },
			purchaser: null,
			activityDate: '',
			vendor: '',
			itemDescription: '',
			totalAmount: null,
			budgetLineItem: '',
			businessPurposeText: '',
			businessPurposeTouched: false,
			receiptFileIds: [],
			secondApprovalFileId: null,
			publicityFileId: null,
			cateringWaiverFileId: null,
			printingInvoiceFileId: null,
			brandApprovalFileId: null,
			officeLocation: '',
			buildingManagerApprovalFileId: null,
			computerPriceQuoteFileId: null,
			recipients: []
		};
	}

	function fallbackPurchaser(): PurchaserDetails {
		if (currentUser !== null) return userAsPurchaser(currentUser);
		if (purchase !== undefined) return purchase.purchaser;
		throw new Error('Purchaser missing.');
	}
</script>

<main class="min-h-screen bg-background text-foreground">
	<div class="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-[220px_1fr]">
		<aside class="flex flex-col gap-2">
			<a
				class="mb-4 text-sm text-muted-foreground hover:text-foreground"
				href={`/app/org/${organizationId}`}
			>
				Back to board
			</a>
			{#each sections as section (section.id)}
				<button
					class="rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-muted"
					class:bg-muted={activeSection === section.id}
					type="button"
					onclick={() => (activeSection = section.id)}
				>
					{section.label}
				</button>
			{/each}
		</aside>

		<section class="min-w-0">
			<div class="mb-6">
				<p class="text-sm text-muted-foreground">{selectedOrg?.name}</p>
				<h1 class="text-2xl font-semibold">{purchase?.itemDescription || 'Purchase request'}</h1>
				{#if saveError}<p class="mt-2 text-sm text-destructive">{saveError}</p>{/if}
			</div>

			<Card>
				<CardHeader>
					<CardTitle>{sections.find((section) => section.id === activeSection)?.label}</CardTitle>
				</CardHeader>
				<CardContent class="flex flex-col gap-5">
					{#if activeSection === 'setup'}
						<div class="flex flex-col gap-3">
							<p class="text-sm font-medium">Type of Purchase</p>
							<RadioGroup.RadioGroup
								value={formState.typeOfPurchase}
								onValueChange={selectPurchaseType}
							>
								<div class="flex items-center gap-2">
									<RadioGroup.RadioGroupItem value="personal_reimbursement" />
									<span class="text-sm">Personal Reimbursement</span>
								</div>
							</RadioGroup.RadioGroup>
						</div>
						<div class="flex flex-col gap-3">
							<p class="text-sm font-medium">Documentation Categories</p>
							<div class="grid gap-3 sm:grid-cols-2">
								{#each categoryOptions as option (option.value)}
									<label class="flex items-center gap-2 text-sm">
										<Checkbox
											checked={checkedCategory[option.value]}
											disabled={option.value === 'asuo_funds' && selectedOrg?.fundLetter === 'I'}
											onCheckedChange={(checked) => toggleCategory(option.value, checked)}
										/>
										{option.label}
									</label>
								{/each}
							</div>
						</div>
					{:else if activeSection === 'details'}
						<div class="grid gap-4 sm:grid-cols-2">
							<label class="flex flex-col gap-2 text-sm font-medium">
								Vendor
								<Input
									value={formState.vendor}
									oninput={(event) => updateForm({ vendor: event.currentTarget.value })}
								/>
							</label>
							<label class="flex flex-col gap-2 text-sm font-medium">
								Amount
								<span class="relative">
									<span
										class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
									>
										$
									</span>
									<Input
										class="pl-7"
										type="number"
										min="0"
										step="0.01"
										value={formState.totalAmount ?? ''}
										oninput={(event) => updateAmount(event.currentTarget.value)}
									/>
								</span>
							</label>
							<label class="flex flex-col gap-2 text-sm font-medium sm:col-span-2">
								Item Description
								<Input
									value={formState.itemDescription}
									oninput={(event) => updateForm({ itemDescription: event.currentTarget.value })}
								/>
							</label>
							<label class="flex flex-col gap-2 text-sm font-medium">
								Budget Line Item
								<Select.Select
									type="single"
									value={formState.budgetLineItem}
									onValueChange={(value) => updateForm({ budgetLineItem: value })}
								>
									<Select.Trigger class="w-full"
										>{formState.budgetLineItem || 'Select line'}</Select.Trigger
									>
									<Select.Content>
										<Select.Group>
											{#each selectedOrg?.budgetLines ?? [] as line (line)}
												<Select.Item value={line}>{line}</Select.Item>
											{/each}
										</Select.Group>
									</Select.Content>
								</Select.Select>
							</label>
							<label class="flex flex-col gap-2 text-sm font-medium">
								Activity Date
								<Input
									type="date"
									value={formState.activityDate}
									oninput={(event) => updateForm({ activityDate: event.currentTarget.value })}
								/>
							</label>
						</div>
					{:else if activeSection === 'requirements'}
						<label class="flex flex-col gap-2 text-sm font-medium">
							Purchaser
							<Select.Select
								type="single"
								value={formState.purchaserSource.kind === 'self'
									? 'self'
									: formState.purchaserSource.purchaserId}
								onValueChange={selectPurchaser}
							>
								<Select.Trigger class="w-full">
									{formState.purchaserSource.kind === 'self' ? 'Self' : formState.purchaser?.name}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="self">Self</Select.Item>
										{#each purchasers as purchaser (purchaser._id)}
											<Select.Item value={purchaser._id}>{purchaser.name}</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Select>
						</label>
						{#each requirementPanels as panel (panel.id)}
							<div class="rounded-lg border border-border p-4">
								<div class="mb-3 flex items-center justify-between gap-3">
									<p class="text-sm font-medium">{panel.title}</p>
									{#if panel.id !== 'office_location' && panel.id !== 'recipients'}
										<span class={documentStatusClass(panel.id, panel.required)}>
											{documentStatusFor(panel.id)}
										</span>
									{/if}
								</div>
								{#if panel.id === 'office_location'}
									<Input
										value={formState.officeLocation}
										oninput={(event) => updateForm({ officeLocation: event.currentTarget.value })}
									/>
								{:else if panel.id === 'recipients'}
									<div class="flex flex-col gap-3">
										{#each formState.recipients as recipient, index (`${index}-${recipient.uo95}`)}
											<div class="grid gap-3 sm:grid-cols-4">
												<Input
													placeholder="Name"
													value={recipient.name}
													oninput={(event) =>
														updateRecipient(index, { name: event.currentTarget.value })}
												/>
												<Input
													placeholder="UO 95"
													value={recipient.uo95}
													oninput={(event) =>
														updateRecipient(index, { uo95: event.currentTarget.value })}
												/>
												<Input
													placeholder="Reason"
													value={recipient.reason}
													oninput={(event) =>
														updateRecipient(index, { reason: event.currentTarget.value })}
												/>
												<Input
													type="number"
													value={recipient.value}
													oninput={(event) =>
														updateRecipient(index, { value: Number(event.currentTarget.value) })}
												/>
											</div>
										{/each}
										<Button type="button" variant="outline" onclick={addRecipient}
											>Add recipient</Button
										>
									</div>
								{:else}
									<Input
										type="file"
										onchange={(event) => void upload(fileKindFor(panel.id), event.currentTarget)}
									/>
								{/if}
							</div>
						{/each}
						{#if uploadStatus}<p class="text-sm text-muted-foreground">{uploadStatus}</p>{/if}
					{:else if activeSection === 'businessPurpose'}
						<label class="flex flex-col gap-2 text-sm font-medium">
							Business Purpose Template
							<Select.Select
								type="single"
								value={businessPurposeTemplateId}
								onValueChange={selectBusinessPurposeTemplate}
							>
								<Select.Trigger class="w-full">
									{businessPurposeTemplates.find(
										(template) => template._id === businessPurposeTemplateId
									)?.title ?? 'Select template'}
								</Select.Trigger>
								<Select.Content>
									<Select.Group>
										<Select.Item value="">Select template</Select.Item>
										{#each businessPurposeTemplates as template (template._id)}
											<Select.Item value={template._id}>{template.title}</Select.Item>
										{/each}
									</Select.Group>
								</Select.Content>
							</Select.Select>
						</label>
						<Textarea
							class="min-h-48"
							value={formState.businessPurposeText}
							oninput={(event) =>
								updateForm({
									businessPurposeText: event.currentTarget.value,
									businessPurposeTouched: true
								})}
						/>
					{:else}
						<div class="grid gap-5">
							{@render ReviewGroup('Setup', [
								formState.typeOfPurchase,
								formState.documentationCategories.join(', ') || 'No categories'
							])}
							{@render ReviewGroup('Details', [
								formState.vendor,
								formState.itemDescription,
								formState.budgetLineItem,
								formState.activityDate || 'No activity date'
							])}
							{@render ReviewGroup('Requirements', [
								formState.purchaser?.name ?? 'No purchaser',
								`${formState.receiptFileIds.length} receipt document(s)`
							])}
							{@render ReviewGroup('Business Purpose', [
								formState.businessPurposeText || 'No Business Purpose'
							])}
							{#if error}<pre
									class="rounded-lg bg-destructive/10 p-4 text-sm whitespace-pre-wrap text-destructive">{error}</pre>{/if}
							<Button onclick={markReady}>Mark ready</Button>
						</div>
					{/if}
				</CardContent>
			</Card>
		</section>
	</div>
</main>

{#snippet ReviewGroup(title: string, lines: string[])}
	<section class="rounded-lg border border-border p-4">
		<h2 class="mb-2 text-sm font-semibold">{title}</h2>
		<ul class="flex flex-col gap-1 text-sm text-muted-foreground">
			{#each lines as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>
{/snippet}
