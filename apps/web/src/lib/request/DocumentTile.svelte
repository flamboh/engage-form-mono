<script lang="ts">
	let {
		label,
		filename,
		contentType,
		preview,
		status,
		error = '',
		expired = false,
		onremove,
		onretry,
		ondismiss,
		onretryreading,
		onpreviewerror
	}: {
		label: string;
		filename: string;
		contentType: string;
		preview: string | null;
		status: 'saved' | 'reading' | 'uploading' | 'failed' | 'unreadable';
		error?: string;
		expired?: boolean;
		onremove?: () => void;
		onretry?: () => void;
		ondismiss?: () => void;
		onretryreading?: () => void;
		onpreviewerror?: () => void;
	} = $props();

	const isImage = $derived(contentType.startsWith('image/') && preview !== null && !expired);
	const badge = $derived(
		contentType === 'application/pdf' ? 'PDF' : contentType.startsWith('image/') ? 'Photo' : 'File'
	);
	const statusText = $derived(
		status === 'uploading' ? 'Uploading' : status === 'reading' ? 'Reading' : ''
	);
</script>

<div
	class="slip-shadow"
	class:is-failed={status === 'failed'}
	class:is-unreadable={status === 'unreadable'}
>
	<div class="slip relative flex flex-col bg-white">
		<div class="relative aspect-[3/4] overflow-hidden bg-(--paper)">
			{#if isImage}
				<img
					class="h-full w-full object-cover object-top"
					src={preview}
					alt={`${label}: ${filename}`}
					onerror={onpreviewerror}
				/>
			{:else}
				<div class="flex h-full flex-col justify-between p-3">
					<span class="self-start border border-(--ink) px-1.5 text-xs font-semibold text-(--ink)"
						>{badge}</span
					>
					<div class="flex flex-col gap-1.5" aria-hidden="true">
						<span class="h-1.5 w-4/5 bg-(--line)"></span>
						<span class="h-1.5 w-3/5 bg-(--line)"></span>
						<span class="h-1.5 w-2/3 bg-(--line)"></span>
					</div>
				</div>
			{/if}
			{#if statusText}
				<div class="scan absolute inset-0" aria-hidden="true"></div>
				<span
					class="absolute bottom-2 left-2 bg-(--ink) px-1.5 py-0.5 text-xs font-medium text-white"
					role="status">{statusText}</span
				>
			{/if}
			{#if preview !== null && !expired && (status === 'saved' || status === 'unreadable')}
				<a
					class="absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--pine)"
					href={preview}
					target="_blank"
					rel="noreferrer"
					aria-label={`Open ${label} ${filename}`}
				></a>
			{/if}
			{#if onremove !== undefined && status !== 'uploading'}
				<button
					class="absolute top-1.5 right-1.5 grid size-7 place-items-center bg-white/90 text-(--ink) hover:bg-(--ink) hover:text-white focus-visible:outline-2 focus-visible:outline-(--pine)"
					type="button"
					aria-label={`Remove ${label} ${filename}`}
					onclick={onremove}
				>
					<svg viewBox="0 0 12 12" class="size-3" aria-hidden="true"
						><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" stroke-width="1.5" /></svg
					>
				</button>
			{/if}
		</div>
		<div class="flex flex-col gap-0.5 px-2.5 pt-2 pb-3">
			<span class="text-xs font-semibold text-(--ink)">{label}</span>
			<span class="hidden truncate text-xs text-(--quiet) sm:block" title={filename}
				>{filename}</span
			>
			{#if expired}
				<span class="text-xs text-(--quiet)">
					Preview timed out.
					<button class="text-(--pine) underline" type="button" onclick={() => location.reload()}
						>Reload</button
					>
				</span>
			{/if}
			{#if status === 'unreadable'}
				<span class="text-xs text-(--alert)">Couldn’t read this — fill it in</span>
				{#if onretryreading}
					<button
						class="mt-1 self-start text-xs font-medium text-(--pine) underline"
						type="button"
						onclick={onretryreading}>Try again</button
					>
				{/if}
			{/if}
			{#if status === 'failed'}
				<span class="text-xs text-(--alert)">{error || 'Upload failed.'}</span>
				<span class="mt-1 flex gap-2">
					<button
						class="text-xs font-medium text-(--pine) underline"
						type="button"
						onclick={onretry}>Try again</button
					>
					<button class="text-xs text-(--quiet) underline" type="button" onclick={ondismiss}
						>Dismiss</button
					>
				</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.slip-shadow {
		filter: drop-shadow(0 0 0.75px rgb(23 33 28 / 0.35)) drop-shadow(0 5px 6px rgb(23 33 28 / 0.08));
	}

	.slip {
		clip-path: polygon(
			0 0,
			100% 0,
			100% calc(100% - 5px),
			93.75% 100%,
			87.5% calc(100% - 5px),
			81.25% 100%,
			75% calc(100% - 5px),
			68.75% 100%,
			62.5% calc(100% - 5px),
			56.25% 100%,
			50% calc(100% - 5px),
			43.75% 100%,
			37.5% calc(100% - 5px),
			31.25% 100%,
			25% calc(100% - 5px),
			18.75% 100%,
			12.5% calc(100% - 5px),
			6.25% 100%,
			0 calc(100% - 5px)
		);
	}

	.slip-shadow.is-failed,
	.slip-shadow.is-unreadable {
		filter: drop-shadow(0 0 1px var(--alert));
	}

	.scan {
		background: linear-gradient(
			180deg,
			transparent 0%,
			color-mix(in oklab, var(--marker) 55%, transparent) 48%,
			transparent 52%
		);
		background-size: 100% 220%;
		animation: scan 1.8s ease-in-out infinite;
	}

	@keyframes scan {
		from {
			background-position: 0 100%;
		}
		to {
			background-position: 0 -120%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.scan {
			animation: none;
			background: color-mix(in oklab, var(--marker) 22%, transparent);
		}
	}
</style>
