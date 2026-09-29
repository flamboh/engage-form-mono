<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import type { RequestCheck, RequestDocument } from '$convex/requestView';
	import {
		dismissUpload,
		localPreviewFor,
		retryUpload,
		type PendingUpload,
		type UploadSlot
	} from '$lib/uploads.svelte';
	import { isAcceptableUpload } from '$lib/imageConvert';
	import DocumentTile from './DocumentTile.svelte';
	import FilePick from './FilePick.svelte';
	import { kindLabels, slotLabels } from './labels';

	let {
		documents,
		pending,
		checks = [],
		locked = false,
		onfiles,
		onremove,
		onretryreading,
		refreshpreview
	}: {
		documents: RequestDocument[];
		pending: PendingUpload[];
		checks?: RequestCheck[];
		onfiles: (files: File[], slot: UploadSlot) => void;
		locked?: boolean;
		onremove: (fileId: Id<'files'>) => void;
		onretryreading: (fileId: Id<'files'>) => void;
		refreshpreview: (fileId: Id<'files'>) => Promise<string | null>;
	} = $props();

	let dragDepth = $state(0);

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

	const readable = new Set(['receipt', 'publicity', 'second_approval']);
	const knownIds = $derived(new Set(documents.map((document) => document.fileId)));
	const inFlight = $derived(
		pending.filter((upload) => upload.fileId === null || !knownIds.has(upload.fileId))
	);
	const ordered = $derived([
		...documents.filter((document) => document.kind === 'receipt'),
		...documents.filter((document) => document.kind !== 'receipt')
	]);

	function notesFor(fileId: Id<'files'>) {
		return checks
			.filter((check) => check.fileId === fileId)
			.map((check) => ({ title: check.title, blocking: check.severity === 'blocking' }));
	}
	const empty = $derived(documents.length === 0 && inFlight.length === 0);
	const reading = $derived(documents.some((document) => document.reading));

	function hasFiles(event: DragEvent) {
		return !locked && (event.dataTransfer?.types.includes('Files') ?? false);
	}

	function dragEnter(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
	}

	function dragLeave(event: DragEvent) {
		if (!hasFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function dragOver(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function drop(event: DragEvent) {
		if (!hasFiles(event)) return;
		dragDepth = 0;
		if (event.defaultPrevented) return;
		event.preventDefault();
		const files = [...(event.dataTransfer?.files ?? [])].filter(isAcceptableUpload);
		if (files.length > 0) onfiles(files, 'auto');
	}
</script>

<svelte:window
	ondragenter={dragEnter}
	ondragleave={dragLeave}
	ondragover={dragOver}
	ondrop={drop}
/>

{#if dragDepth > 0}
	<div
		class="overlay pointer-events-none fixed inset-0 z-40 grid place-items-center p-6"
		aria-hidden="true"
	>
		<div class="border-2 border-dashed border-(--pine) bg-(--surface) px-8 py-6 text-center">
			<p class="text-lg font-semibold text-(--ink)">Drop to add</p>
			<p class="text-sm text-(--quiet)">Receipts, flyers, approvals. We’ll sort each one.</p>
		</div>
	</div>
{/if}

<section id="field-documents" class="flex flex-col gap-3" aria-label="Documents">
	<ul
		class="-mx-4 flex snap-x scroll-px-4 items-stretch gap-2 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2.5 lg:overflow-visible lg:px-0"
	>
		{#each ordered as document, index (document.fileId)}
			<li
				class={['w-48 shrink-0 snap-start lg:w-auto', index === 0 && 'lg:col-span-2 lg:max-w-48']}
			>
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
					notes={notesFor(document.fileId)}
					onremove={locked ? undefined : () => onremove(document.fileId)}
					onretryreading={readable.has(document.kind) && !locked
						? () => onretryreading(document.fileId)
						: undefined}
					onpreviewerror={() =>
						void previewFailed(document.fileId, freshUrls[document.fileId] ?? document.previewUrl)}
				/>
			</li>
		{/each}
		{#each inFlight as upload (upload.id)}
			<li class={['w-48 shrink-0 snap-start lg:w-auto', empty && 'lg:col-span-2 lg:max-w-48']}>
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
		{#if !locked && !reading}
			<li class={['flex shrink-0', empty && 'lg:col-span-2']}>
				{#if empty}
					<FilePick
						class="add-tile flex min-h-14 w-full flex-col items-center justify-center gap-1 border border-dashed px-4 py-6 text-center text-sm lg:aspect-[3/4] lg:max-w-48"
						label="Add the receipt"
						multiple
						onfiles={(files) => onfiles(files, 'auto')}
					>
						<span class="font-medium text-(--ink)">Add the receipt</span>
						<span class="text-xs text-(--quiet)">Drop it anywhere, or choose a file</span>
					</FilePick>
				{:else}
					<FilePick
						class="add-tile flex min-h-14 w-14 items-center justify-center border border-dashed text-lg text-(--pine) lg:aspect-square lg:w-full"
						label="Add documents"
						multiple
						onfiles={(files) => onfiles(files, 'auto')}
					>
						<span aria-hidden="true">+</span>
					</FilePick>
				{/if}
			</li>
		{/if}
	</ul>
</section>

<style>
	:global(.add-tile) {
		border-color: color-mix(in oklab, var(--pine) 45%, var(--line));
		background: var(--surface);
	}

	.overlay {
		background: color-mix(in oklab, var(--paper) 80%, transparent);
	}
</style>
