<script lang="ts">
	import { isAcceptableUpload } from '$lib/imageConvert';

	let {
		onFiles,
		busy = false,
		title = 'Drop a receipt to start a request',
		hint = 'A PDF or a photo works. We read the vendor, total, and date for you.'
	}: {
		onFiles: (files: File[]) => void;
		busy?: boolean;
		title?: string;
		hint?: string;
	} = $props();

	let dragDepth = $state(0);
	let pickerInput = $state<HTMLInputElement | null>(null);
	let cameraInput = $state<HTMLInputElement | null>(null);
	const dragging = $derived(dragDepth > 0);

	function hasFiles(event: DragEvent) {
		return event.dataTransfer?.types.includes('Files') ?? false;
	}

	function acceptable(files: FileList | null | undefined) {
		return [...(files ?? [])].filter(isAcceptableUpload);
	}

	function handleDragEnter(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth += 1;
	}

	function handleDragLeave(event: DragEvent) {
		if (!hasFiles(event)) return;
		dragDepth = Math.max(0, dragDepth - 1);
	}

	function handleDragOver(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
	}

	function handleDrop(event: DragEvent) {
		if (!hasFiles(event)) return;
		event.preventDefault();
		dragDepth = 0;
		const files = acceptable(event.dataTransfer?.files);
		if (files.length > 0 && !busy) onFiles(files);
	}

	function handlePicked(input: HTMLInputElement) {
		const files = acceptable(input.files);
		input.value = '';
		if (files.length > 0 && !busy) onFiles(files);
	}
</script>

<svelte:window
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
/>

<div class="receipt-frame">
	<div class="receipt" class:dragging aria-busy={busy}>
		<button
			class="flex w-full flex-col items-start gap-4 px-6 pt-7 pb-10 text-left sm:flex-row sm:items-center sm:gap-6 sm:px-8"
			type="button"
			disabled={busy}
			onclick={() => pickerInput?.click()}
		>
			<span class="glyph" aria-hidden="true">
				<svg viewBox="0 0 32 40" width="32" height="40" fill="none">
					<path
						d="M3 2h26v34l-3.25-2.5L22.5 36l-3.25-2.5L16 36l-3.25-2.5L9.5 36l-3.25-2.5L3 36V2Z"
						stroke="currentColor"
						stroke-width="2"
						stroke-linejoin="round"
					/>
					<path
						d="M9 11h14M9 17h10M9 23h14"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
			</span>
			<span class="flex flex-col gap-1.5">
				<span class="text-xl leading-tight font-semibold tracking-tight sm:text-2xl">
					{busy ? 'Starting your request…' : dragging ? 'Let go to start' : title}
				</span>
				<span class="max-w-md text-sm text-stone-600">{hint}</span>
			</span>
			<span
				class="mt-1 inline-flex h-10 shrink-0 items-center rounded-full border border-stone-900 px-4 text-sm font-medium sm:mt-0 sm:ml-auto"
			>
				Choose files
			</span>
		</button>
		<div class="px-6 pb-10 sm:hidden">
			<button
				class="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#154733] text-sm font-medium text-white"
				type="button"
				disabled={busy}
				onclick={() => cameraInput?.click()}
			>
				Take a photo of a receipt
			</button>
		</div>
		<input
			bind:this={pickerInput}
			class="hidden"
			type="file"
			multiple
			accept="image/*,application/pdf,.heic,.heif"
			onchange={(event) => handlePicked(event.currentTarget)}
		/>
		<input
			bind:this={cameraInput}
			class="hidden"
			type="file"
			accept="image/*,application/pdf,.heic,.heif"
			capture="environment"
			onchange={(event) => handlePicked(event.currentTarget)}
		/>
	</div>
</div>

{#if dragging}
	<div
		class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-[#154733]/85 p-6 text-center text-white"
	>
		<div class="flex flex-col items-center gap-2">
			<p class="text-3xl font-semibold tracking-tight">Drop to start a request</p>
			<p class="text-sm text-white/80">Several receipts at once become one request.</p>
		</div>
	</div>
{/if}

<style>
	.receipt {
		position: relative;
		background: #fffef9;
		color: #1c1917;
		mask:
			linear-gradient(#000 0 0) top / 100% calc(100% - 8px) no-repeat,
			conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 16px 8px
				repeat-x;
		transition:
			background-color 120ms ease,
			border-color 120ms ease;
	}

	.receipt-frame {
		filter: drop-shadow(0 0 1px rgb(120 113 108 / 0.9)) drop-shadow(0 3px 4px rgb(0 0 0 / 0.06));
	}

	.receipt:has(button:hover:not(:disabled)),
	.receipt.dragging {
		background: #fef9d7;
	}

	.receipt button:focus-visible {
		outline: 2px solid #154733;
		outline-offset: -4px;
	}

	.glyph {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		flex-shrink: 0;
		border-radius: 9999px;
		background: #fee123;
		color: #154733;
	}

	@media (prefers-reduced-motion: reduce) {
		.receipt {
			transition: none;
		}
	}
</style>
