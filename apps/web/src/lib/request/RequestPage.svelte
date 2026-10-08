<script lang="ts">
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import type { Stage } from '$convex/lifecycle';
	import type { RequestView, StepId } from '$convex/requestView';
	import type { SavedData } from '$lib/purchase/draftDetails';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { dismissUpload, type PendingUpload, type UploadSlot } from '$lib/uploads.svelte';
	import StatusPill from '$lib/ui/StatusPill.svelte';
	import { onDestroy } from 'svelte';
	import ActionBar, { type BarMode } from './ActionBar.svelte';
	import AllDetails from './AllDetails.svelte';
	import ApprovalDialog from './ApprovalDialog.svelte';
	import DocumentStrip from './DocumentStrip.svelte';
	import { RequestEditor, type RequestBackend } from './editor.svelte';
	import FilledView from './FilledView.svelte';
	import { monthDay } from './labels';
	import ReadingView from './ReadingView.svelte';
	import RequestMenu from './RequestMenu.svelte';
	import SentBackDialog from '$lib/board/SentBackDialog.svelte';
	import StepBody from './StepBody.svelte';
	import StepList from './StepList.svelte';
	import { requestMode, requestSteps, stepsLeft } from './steps';

	let {
		view,
		saved,
		user,
		events = [],
		recentPurposes = [],
		budgetLeft = null,
		organizationId,
		pending,
		backend,
		loadError = ''
	}: {
		view: RequestView | undefined;
		saved: SavedData | undefined;
		user: Doc<'users'> | null;
		events?: Doc<'events'>[];
		recentPurposes?: string[];
		budgetLeft?: Record<string, number | null> | null;
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

	let approvalDialog = $state<ApprovalDialog | null>(null);
	let sendingBack = $state(false);

	onDestroy(() => void editor.flush());

	const purchase = $derived(view?.purchase);
	const form = $derived(editor.form);
	const organization = $derived(saved?.organizations.find((org) => org._id === organizationId));
	const fundLetter = $derived(
		purchase?.studentOrganization.fundLetter ?? organization?.fundLetter ?? 'I'
	);
	const budgetLines = $derived(
		organization?.budgetLines.map((line) => ({ name: line.name, fund: line.fund })) ??
			purchase?.studentOrganization.budgetLines ??
			[]
	);
	const purchasers = $derived(
		(saved?.purchasers ?? []).filter((purchaser) => purchaser.organizationId === organizationId)
	);
	const userName = $derived(user?.name ?? purchase?.requester.name ?? '');
	const inFlight = $derived(
		pending.filter((upload) => upload.status === 'uploading' || upload.status === 'attaching')
	);
	const reading = $derived(
		(view?.reading ?? false) ||
			inFlight.some((upload) => upload.slot === 'auto' || upload.slot === 'receipt')
	);
	const ready = $derived(
		(view?.readiness.ready ?? false) && inFlight.length === 0 && !(view?.reading ?? false)
	);
	const steps = $derived(
		view === undefined || form === null
			? []
			: requestSteps(view, form, {
					reviewCount: editor.reviews.length,
					sourceOf: (field) => editor.sourceOf(field),
					keep: editor.idCardAdded ? new Set<StepId>(['idCard']) : undefined
				})
	);
	const current = $derived(steps.find((step) => step.state === 'current') ?? null);
	const left = $derived(stepsLeft(steps));
	const approved = $derived(purchase?.status === 'approved');
	const filled = $derived(purchase?.status === 'ready' && purchase.lastFilledAt !== null);
	const closed = $derived(approved || filled);
	const mode = $derived(requestMode({ closed, reading, ready, steps }));
	const allDetails = $derived(page.url.searchParams.get('view') === 'all');
	const stage = $derived.by((): Stage | null => {
		if (view === undefined) return null;
		if (reading && !closed) return 'reading';
		return view.stage;
	});
	const barMode = $derived.by((): BarMode => {
		if (view === undefined || purchase === undefined) return { kind: 'loading' };
		if (approved) return { kind: 'approved' };
		if (filled && purchase.lastFilledAt !== null) {
			return { kind: 'filled', filledAt: purchase.lastFilledAt };
		}
		if (mode === 'reading') return { kind: 'reading' };
		if (mode === 'ready') return { kind: 'ready' };
		return { kind: 'steps', left, next: current?.title ?? 'Look it over' };
	});
	const title = $derived(
		form?.vendor || form?.itemDescription || (reading ? 'New receipt' : 'New request')
	);
	const boardHref = $derived(`/app/org/${organizationId}`);
	const trackedHref = $derived(`/app/org/${organizationId}?tracked=${purchase?._id ?? ''}`);
	const stepsHref = $derived(viewHref(null));
	const allHref = $derived(viewHref('all'));

	function viewHref(value: 'all' | null) {
		const url = new URL(page.url);
		if (value === null) url.searchParams.delete('view');
		else url.searchParams.set('view', value);
		return `${url.pathname}${url.search}`;
	}

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

	function jumpToStep(id: StepId) {
		requestAnimationFrame(() => {
			const element = document.getElementById(`step-${id}`);
			if (element === null) return;
			const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			element.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
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
					href={boardHref}
				>
					<span aria-hidden="true">←</span>
					{organization?.name ?? purchase?.studentOrganization.name ?? 'Back to board'}
				</a>
				<h1 class="truncate text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
			</div>
			{#if purchase && stage !== null}
				<div class="flex shrink-0 items-center gap-2 sm:gap-3">
					<span class="max-sm:hidden"><StatusPill {stage} /></span>
					{#if mode !== 'reading' || allDetails}
						<nav
							class="flex border border-(--line) bg-(--surface) text-sm"
							aria-label="Request view"
						>
							<a
								class={[
									'px-3 py-1.5',
									allDetails ? 'text-(--quiet) hover:text-(--ink)' : 'bg-(--ink) text-white'
								]}
								href={stepsHref}
								aria-current={allDetails ? undefined : 'page'}>{closed ? 'Status' : 'Steps'}</a
							>
							<a
								class={[
									'px-3 py-1.5 whitespace-nowrap',
									allDetails ? 'bg-(--ink) text-white' : 'text-(--quiet) hover:text-(--ink)'
								]}
								href={allHref}
								aria-current={allDetails ? 'page' : undefined}>All details</a
							>
						</nav>
					{/if}
					{#if purchase.status === 'draft'}
						<RequestMenu
							{editor}
							documentCount={view?.documents.length ?? 0}
							ondeleted={async () => {
								for (const item of pending) dismissUpload(item.id);
								await goto(boardHref, { replaceState: true });
							}}
						/>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	<div
		class="mx-auto grid w-full max-w-6xl flex-1 grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:gap-8 sm:px-6 sm:py-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-14 lg:py-10"
	>
		<aside class="min-w-0">
			<DocumentStrip
				documents={view?.documents ?? []}
				{pending}
				checks={view?.checks ?? []}
				onfiles={upload}
				locked={closed}
				onremove={(fileId) => void editor.removeDocument(fileId)}
				onretryreading={(fileId) => void editor.retryReading(fileId)}
				refreshpreview={(fileId) => editor.freshPreview(fileId)}
			/>
		</aside>

		<main class="flex max-w-2xl min-w-0 flex-col gap-6 pb-10">
			{#if loadError}
				<p class="border-l-[3px] border-(--alert) bg-(--surface) px-4 py-3 text-sm text-(--ink)">
					{loadError}
				</p>
			{:else if view === undefined || purchase === undefined}
				<div class="flex flex-col gap-4" aria-busy="true" aria-label="Loading request">
					<span class="shimmer h-6 w-40"></span>
					<span class="shimmer h-12 w-56"></span>
					<span class="shimmer h-5 w-72 max-w-full"></span>
					<span class="shimmer h-5 w-64 max-w-full"></span>
				</div>
			{:else}
				{#if purchase.reviewerNote && !closed}
					<section class="note px-5 py-4" aria-label="Sent back by Engage">
						<p class="text-sm font-semibold text-(--ink)">Engage sent this back</p>
						<p class="text-sm leading-relaxed text-(--ink)">“{purchase.reviewerNote}”</p>
					</section>
				{/if}
				{#if allDetails}
					<AllDetails
						{editor}
						{view}
						{events}
						{purchasers}
						{budgetLines}
						{budgetLeft}
						{fundLetter}
						{recentPurposes}
						{userName}
						{organization}
						{reading}
						locked={closed}
						onfiles={upload}
					/>
				{:else if closed}
					<FilledView {view} allDetailsHref={allHref} />
				{:else if mode === 'reading'}
					<ReadingView {editor} {recentPurposes} />
				{:else}
					{#if view.deadline !== null}
						<p class="-mb-2 text-sm text-(--quiet)">
							Submit by <strong class="font-semibold text-(--ink)">{monthDay(view.deadline)}</strong
							>: 30 days from the receipt.
						</p>
					{/if}
					<StepList {steps}>
						{#snippet body(step)}
							<StepBody
								{step}
								{editor}
								{view}
								{events}
								{purchasers}
								{budgetLines}
								{budgetLeft}
								{userName}
								{organization}
								{reading}
								onfiles={upload}
								onapproval={() => approvalDialog?.show()}
							/>
						{/snippet}
					</StepList>
				{/if}
			{/if}
		</main>
	</div>

	<ApprovalDialog
		bind:this={approvalDialog}
		{editor}
		{purchasers}
		requesterName={purchase?.requester.name ?? user?.name ?? ''}
		requesterEmail={purchase?.requester.email ?? user?.studentEmail ?? ''}
		onsave={(approver) => backend.saveApprover(approver)}
		onjump={jumpToStep}
	/>

	{#if sendingBack}
		<SentBackDialog
			vendor={title}
			busy={editor.busy}
			onconfirm={async (note) => {
				if (await editor.sendBack(note)) sendingBack = false;
			}}
			oncancel={() => (sendingBack = false)}
		/>
	{/if}

	<ActionBar
		{editor}
		mode={barMode}
		{boardHref}
		{trackedHref}
		onsentback={() => (sendingBack = true)}
	/>
</div>

<style>
	.note {
		border: 1px solid var(--line);
		border-left: 3px solid var(--marker-deep);
		background: var(--marker-soft);
	}

	.request :global(.input) {
		width: 100%;
		border: 1px solid var(--line);
		background: var(--surface);
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
