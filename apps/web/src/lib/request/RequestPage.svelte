<script lang="ts">
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import type { DocumentSlot, RequestView } from '$convex/requestView';
	import { requirementPanelsFor, type RequirementPanel } from '$lib/purchase/builderFlow';
	import type { SavedData } from '$lib/purchase/draftDetails';
	import type { PendingUpload, UploadSlot } from '$lib/uploads.svelte';
	import ActionBar from './ActionBar.svelte';
	import BusinessPurposeCard from './BusinessPurposeCard.svelte';
	import DocumentsRail from './DocumentsRail.svelte';
	import EditDetails from './EditDetails.svelte';
	import { RequestEditor, slotField, type RequestBackend } from './editor.svelte';
	import PurchaseSummary from './PurchaseSummary.svelte';
	import RequestQuestions from './RequestQuestions.svelte';
	import WhatsLeft from './WhatsLeft.svelte';
	import { onDestroy } from 'svelte';
	import { whatsLeft, type LeftItem } from './whatsLeft';

	let {
		view,
		saved,
		user,
		recentPurposes = [],
		organizationId,
		pending,
		backend,
		loadError = ''
	}: {
		view: RequestView | undefined;
		saved: SavedData | undefined;
		user: Doc<'users'> | null;
		recentPurposes?: string[];
		organizationId: Id<'organizations'>;
		pending: PendingUpload[];
		backend: RequestBackend;
		loadError?: string;
	} = $props();

	const editor = new RequestEditor(
		() => view,
		() => user,
		() => backend
	);

	let detailsOpen = $state(false);

	onDestroy(() => void editor.flush());

	const purchase = $derived(view?.purchase);
	const form = $derived(editor.form);
	const organization = $derived(saved?.organizations.find((org) => org._id === organizationId));
	const fundLetter = $derived(
		purchase?.studentOrganization.fundLetter ?? organization?.fundLetter ?? 'I'
	);
	const budgetLines = $derived(
		organization?.budgetLines ?? purchase?.studentOrganization.budgetLines ?? []
	);
	const purchasers = $derived(
		(saved?.purchasers ?? []).filter((purchaser) => purchaser.organizationId === organizationId)
	);
	const templates = $derived(
		(saved?.businessPurposeTemplates ?? []).filter(
			(template) => template.organizationId === organizationId
		)
	);
	const inFlight = $derived(
		pending.filter((upload) => upload.status === 'uploading' || upload.status === 'attaching')
	);
	const reading = $derived(
		(view?.reading ?? false) ||
			inFlight.some((upload) => upload.slot === 'auto' || upload.slot === 'receipt')
	);
	const panels = $derived(
		form === null
			? []
			: requirementPanelsFor({
					categories: form.documentationCategories,
					fundLetter,
					purchaserIsSelf: form.purchaserSource.kind === 'self'
				})
	);
	const pendingSlots = $derived(new Set(inFlight.map((upload) => upload.slot)));
	const uploadingSlots = $derived(
		new Set(inFlight.map((upload) => (upload.slot === 'auto' ? 'receipt' : upload.slot)))
	);
	const missingSlots = $derived(
		panels
			.filter((panel) => panel.required)
			.map(panelSlot)
			.filter((slot): slot is DocumentSlot => slot !== null && !hasDocument(slot))
	);
	const optionalSlots = $derived(
		panels
			.filter((panel) => !panel.required)
			.map(panelSlot)
			.filter((slot): slot is DocumentSlot => slot !== null && !hasDocument(slot))
	);
	const unresolvedVariables = $derived(
		[...(view?.businessPurposeText ?? '').matchAll(/\{([^{}]+)\}/g)].map((match) => match[1])
	);
	const purposeMissing = $derived(
		form !== null && form.businessPurposeText.includes('{Purpose}') && form.purpose.trim() === ''
	);
	const items = $derived(
		view === undefined
			? []
			: whatsLeft({
					readiness: view.readiness,
					reviews: editor.reviews,
					reading,
					purposeMissing,
					onlyPurposeUnresolved: unresolvedVariables.every((name) => name === 'Purpose')
				}).filter((item) => item.target.kind !== 'slot' || !uploadingSlots.has(item.target.slot))
	);
	const deferReceiptFields = $derived(reading || missingSlots.includes('receipt'));
	const blocking = $derived(
		items.filter((item) => item.blocking && !(deferReceiptFields && item.waitsForReceipt))
	);
	const ready = $derived(
		(view?.readiness.ready ?? false) && inFlight.length === 0 && !(view?.reading ?? false)
	);
	const visibleItems = $derived.by((): LeftItem[] => {
		const shown = deferReceiptFields ? items.filter((item) => !item.waitsForReceipt) : items;
		if (shown.length > 0 || ready || reading) return shown;
		return [inFlight.length > 0 ? uploadingItem : (items[0] ?? detailsItem)];
	});
	const approved = $derived(purchase?.status === 'approved');
	const title = $derived(form?.vendor || form?.itemDescription || 'New purchase request');

	function panelSlot(panel: RequirementPanel): DocumentSlot | null {
		if (panel.id === 'receipts') return 'receipt';
		if (panel.id === 'office_location' || panel.id === 'recipients') return null;
		return panel.id;
	}

	function hasDocument(slot: DocumentSlot) {
		if (pendingSlots.has(slot) || (slot === 'receipt' && pendingSlots.has('auto'))) return true;
		if (form === null) return false;
		if (slot === 'receipt') return form.receiptFileIds.length > 0;
		if (slot === 'recipient_list') return false;
		return form[slotField[slot]] !== null;
	}

	const uploadingItem: LeftItem = {
		key: 'uploading',
		label: 'Adding your documents',
		detail: 'This finishes on its own in a moment.',
		target: { kind: 'field', field: 'documents' },
		blocking: true,
		waitsForReceipt: false
	};

	const detailsItem: LeftItem = {
		key: 'details',
		label: 'Look over the details',
		detail: 'Something still needs a value before Engage.',
		target: { kind: 'field', field: 'details' },
		blocking: true,
		waitsForReceipt: false
	};

	function flushIfHidden() {
		if (document.visibilityState === 'hidden') void editor.flush();
	}

	function warnIfUnsaved(event: BeforeUnloadEvent) {
		if (!editor.hasUnsaved) return;
		void editor.flush();
		event.preventDefault();
	}

	function upload(files: File[], slot: UploadSlot) {
		editor.upload(files, slot);
	}

	function jump(item: LeftItem) {
		const target = item.target;
		if (target.kind === 'link') return;
		if (target.kind === 'field' && target.field === 'details') detailsOpen = true;
		const id =
			target.kind === 'slot'
				? `slot-${target.slot}`
				: target.kind === 'review'
					? `review-${target.field}`
					: `field-${target.field}`;
		requestAnimationFrame(() => {
			const element = document.getElementById(id);
			if (element === null) return;
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
			const focusable = element.matches('button, input, textarea, a, summary')
				? element
				: element.querySelector<HTMLElement>('button, input, textarea, a, summary');
			focusable?.focus({ preventScroll: true });
		});
	}
</script>

<svelte:window onpagehide={() => void editor.flush()} onbeforeunload={warnIfUnsaved} />
<svelte:document onvisibilitychange={flushIfHidden} />

<div class="request flex min-h-screen flex-col bg-(--paper) text-(--ink)">
	<header class="border-b border-(--line)">
		<div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
			<div class="min-w-0">
				<a
					class="text-sm text-(--quiet) hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
					href={`/app/org/${organizationId}`}
				>
					{organization?.name ?? purchase?.studentOrganization.name ?? 'Back to board'}
				</a>
				<h1 class="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
			</div>
			{#if purchase}
				<span class="shrink-0 border border-(--line) bg-white px-2 py-1 text-xs font-medium">
					{purchase.status === 'approved'
						? 'Approved'
						: purchase.status === 'ready' && purchase.lastFilledAt !== null
							? 'Filled'
							: purchase.status === 'ready'
								? 'Ready'
								: 'Draft'}
				</span>
			{/if}
		</div>
	</header>

	<div
		class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14 lg:py-10"
	>
		<aside class="min-w-0">
			<DocumentsRail
				documents={view?.documents ?? []}
				{pending}
				{missingSlots}
				onfiles={upload}
				locked={approved}
				onremove={(fileId) => void editor.removeDocument(fileId)}
				onretryreading={(fileId) => void editor.retryReading(fileId)}
				refreshpreview={(fileId) => editor.freshPreview(fileId)}
			/>
		</aside>

		<main class="flex max-w-2xl min-w-0 flex-col gap-8 pb-10 lg:gap-10">
			{#if loadError}
				<p class="border border-(--alert) bg-white p-4 text-sm text-(--alert)">{loadError}</p>
			{:else if view === undefined || purchase === undefined}
				<div class="flex flex-col gap-4" aria-busy="true" aria-label="Loading request">
					<span class="shimmer h-6 w-40"></span>
					<span class="shimmer h-12 w-56"></span>
					<span class="shimmer h-5 w-72 max-w-full"></span>
					<span class="shimmer h-5 w-64 max-w-full"></span>
				</div>
			{:else}
				{#if purchase.status === 'draft'}
					<WhatsLeft items={visibleItems} {reading} {ready} onjump={jump} onfiles={upload} />
				{/if}
				<div class="contents" inert={approved}>
					<RequestQuestions
						{editor}
						{fundLetter}
						{budgetLines}
						{purchasers}
						{templates}
						{recentPurposes}
						organizationTemplate={organization?.businessPurposeTemplate ?? null}
						userName={user?.name ?? purchase.requester.name}
						section="why"
					/>
					<PurchaseSummary {editor} {reading} />
					<BusinessPurposeCard {editor} resolvedText={view.businessPurposeText} />
					<RequestQuestions
						{editor}
						{fundLetter}
						{budgetLines}
						{purchasers}
						{templates}
						{recentPurposes}
						userName={user?.name ?? purchase.requester.name}
						section="funding"
					/>
					<EditDetails
						{editor}
						{purchase}
						{optionalSlots}
						bind:open={detailsOpen}
						onfiles={upload}
					/>
				</div>
			{/if}
		</main>
	</div>

	<ActionBar
		{editor}
		status={purchase?.status}
		lastFilledAt={purchase?.lastFilledAt ?? null}
		{ready}
		blockingCount={blocking.length}
		reviewCount={editor.reviews.length}
		{reading}
		onjumpfirst={() => {
			const first = blocking[0];
			if (first !== undefined) jump(first);
		}}
	/>
</div>

<style>
	.request {
		--paper: #f8f8f4;
		--ink: #17211c;
		--quiet: #5f6a64;
		--line: #dfe2da;
		--pine: #1d5b40;
		--pine-deep: #134430;
		--pine-soft: #e5efe9;
		--marker: #fde55c;
		--marker-deep: #e3bd00;
		--alert: #b3261e;
	}

	.request :global(.input) {
		width: 100%;
		border: 1px solid var(--line);
		background: white;
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
		color: var(--ink);
	}

	.request :global(.input:focus-visible) {
		border-color: var(--pine);
		outline: 2px solid color-mix(in oklab, var(--pine) 30%, transparent);
		outline-offset: 0;
	}

	.request :global(.shimmer) {
		display: block;
		background: linear-gradient(
			90deg,
			var(--line) 0%,
			color-mix(in oklab, var(--line) 40%, white) 50%,
			var(--line) 100%
		);
		background-size: 200% 100%;
		animation: shimmer 1.4s linear infinite;
	}

	@keyframes shimmer {
		from {
			background-position: 100% 0;
		}
		to {
			background-position: -100% 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.request :global(.shimmer) {
			animation: none;
		}
	}
</style>
