<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import type { DocumentSlot, RequestDocument } from '$convex/requestView';
	import {
		dismissUpload,
		localPreviewFor,
		retryUpload,
		type PendingUpload,
		type UploadSlot
	} from '$lib/uploads.svelte';
	import DocumentTile from './DocumentTile.svelte';
	import DropTarget from './DropTarget.svelte';
	import FilePick from './FilePick.svelte';
	import { kindLabels, slotHints, slotLabels } from './labels';

	let {
		documents,
		pending,
		missingSlots,
		locked = false,
		onfiles,
		onremove,
		onretryreading,
		refreshpreview,
		onapproval
	}: {
		documents: RequestDocument[];
		pending: PendingUpload[];
		missingSlots: DocumentSlot[];
		onfiles: (files: File[], slot: UploadSlot) => void;
		locked?: boolean;
		onremove: (fileId: Id<'files'>) => void;
		onretryreading: (fileId: Id<'files'>) => void;
		refreshpreview: (fileId: Id<'files'>) => Promise<string | null>;
		onapproval: () => void;
	} = $props();

	let freshUrls = $state<Record<string, string>>({});
	let expired = $state<Record<string, boolean>>({});
	let unrenderable = $state<Record<string, boolean>>({});

	function urlExpired(url: string | null) {
		if (url === null) return false;
		const expiresAt = Number(URL.parse(url, location.href)?.searchParams.get('exp'));
		return Number.isFinite(expiresAt) && expiresAt > 0 && expiresAt <= Date.now();
	}

	async function previewFailed(fileId: Id<'files'>, failedUrl: string | null) {
		if (!urlExpired(failedUrl)) {
			unrenderable = { ...unrenderable, [fileId]: true };
			return;
		}
		if (fileId in freshUrls || expired[fileId]) {
			expired = { ...expired, [fileId]: true };
			return;
		}
		const url = await refreshpreview(fileId).catch(() => null);
		if (url === null || url === failedUrl) expired = { ...expired, [fileId]: true };
		else freshUrls = { ...freshUrls, [fileId]: url };
	}

	const knownIds = $derived(new Set(documents.map((document) => document.fileId)));
	const inFlight = $derived(
		pending.filter((upload) => upload.fileId === null || !knownIds.has(upload.fileId))
	);
	const receiptMissing = $derived(missingSlots.includes('receipt'));
	const targetSlots = $derived(missingSlots.filter((slot) => slot !== 'receipt'));
	const empty = $derived(documents.length === 0 && inFlight.length === 0);
</script>

{#snippet approvalAction()}
	<span class="flex flex-wrap items-baseline gap-x-2">
		<button
			class="text-sm font-medium text-(--pine) underline hover:text-(--pine-deep) focus-visible:outline-2 focus-visible:outline-(--pine)"
			type="button"
			onclick={onapproval}
		>
			Get it approved
		</button>
		<span class="text-xs text-(--quiet)">We’ll write the email.</span>
	</span>
{/snippet}

<section
	id="field-documents"
	class="flex flex-col gap-3 lg:gap-4"
	aria-labelledby="documents-heading"
>
	<h2 id="documents-heading" class="text-sm font-semibold text-(--ink) max-lg:sr-only">
		Documents
	</h2>

	{#if !empty}
		<ul
			class="-mx-4 flex snap-x scroll-px-4 items-stretch gap-2 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0"
		>
			{#each documents as document (document.fileId)}
				<li class="w-48 shrink-0 snap-start lg:w-auto">
					<DocumentTile
						label={kindLabels[document.kind] ?? 'Document'}
						filename={document.filename}
						contentType={document.contentType}
						preview={localPreviewFor(document.fileId) ??
							freshUrls[document.fileId] ??
							document.previewUrl}
						status={document.reading ? 'reading' : document.readFailed ? 'unreadable' : 'saved'}
						expired={expired[document.fileId] ?? false}
						renderable={!unrenderable[document.fileId]}
						onremove={locked ? undefined : () => onremove(document.fileId)}
						onretryreading={document.kind === 'receipt' && !locked
							? () => onretryreading(document.fileId)
							: undefined}
						onpreviewerror={() =>
							void previewFailed(
								document.fileId,
								freshUrls[document.fileId] ?? document.previewUrl
							)}
					/>
				</li>
			{/each}
			{#each inFlight as upload (upload.id)}
				<li class="w-48 shrink-0 snap-start lg:w-auto">
					<DocumentTile
						label={upload.slot === 'auto' ? 'New document' : slotLabels[upload.slot]}
						filename={upload.filename}
						contentType={upload.contentType}
						preview={upload.objectUrl}
						status={upload.status === 'failed' ? 'failed' : 'uploading'}
						error={upload.error}
						onretry={upload.retryable ? () => retryUpload(upload.id) : undefined}
						ondismiss={() => dismissUpload(upload.id)}
					/>
				</li>
			{/each}
			<li class="flex shrink-0 gap-2 lg:hidden">
				<FilePick
					class="add-tile flex min-h-14 w-16 items-center justify-center gap-1 border border-dashed text-sm font-medium text-(--pine)"
					label="Add documents"
					multiple
					onfiles={(files) => onfiles(files, 'auto')}
				>
					<span class="text-lg leading-none" aria-hidden="true">+</span>
					Add
				</FilePick>
				<FilePick
					class="add-tile hidden min-h-14 w-18 items-center justify-center border border-dashed text-sm font-medium text-(--pine) pointer-coarse:flex"
					label="Take a photo"
					capture
					onfiles={(files) => onfiles(files, 'auto')}
				>
					Camera
				</FilePick>
			</li>
		</ul>
	{/if}

	<div class={empty ? '' : 'hidden lg:block'}>
		<DropTarget
			id={receiptMissing ? 'slot-receipt' : undefined}
			slot="auto"
			title={empty ? 'Add your receipt' : 'Drop receipts, flyers, approvals'}
			hint={empty
				? 'Drop a photo or PDF here. We’ll fill in the store, items, and total.'
				: 'We’ll sort each file into the right place.'}
			{onfiles}
		/>
	</div>

	{#if targetSlots.length > 0}
		<div class="hidden flex-col gap-2 lg:flex">
			<h3 class="text-xs font-medium text-(--quiet)">Still needed</h3>
			{#each targetSlots as slot (slot)}
				<DropTarget
					id={`slot-${slot}`}
					{slot}
					title={slotLabels[slot]}
					hint={slotHints[slot] ?? ''}
					compact
					{onfiles}
					children={slot === 'second_approval' ? approvalAction : undefined}
				/>
			{/each}
		</div>
	{/if}
</section>

<style>
	:global(.add-tile) {
		border-color: color-mix(in oklab, var(--pine) 45%, var(--line));
		background: white;
	}
</style>
