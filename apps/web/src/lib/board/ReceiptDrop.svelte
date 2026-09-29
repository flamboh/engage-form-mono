<script lang="ts">
	import { isAcceptableUpload } from '$lib/imageConvert';
	import Button from '$lib/ui/Button.svelte';

	let {
		onFiles,
		onEmpty,
		busy = false,
		title = 'Drop a receipt',
		hint = 'It’s tracked right away. Finish it now or after the event.'
	}: {
		onFiles: (files: File[]) => void;
		onEmpty?: () => void;
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

<div class="slipbox">
	<div
		class="slip flex flex-wrap items-center gap-3 px-4 pt-4 pb-[22px] sm:flex-nowrap sm:gap-[18px] sm:px-[22px] sm:pt-[18px] sm:pb-6"
		class:dragging
		aria-busy={busy}
	>
		<span class="glyph" aria-hidden="true">
			<svg viewBox="0 0 32 40" width="20" height="25" fill="none">
				<path
					d="M3 2h26v34l-3.25-2.5L22.5 36l-3.25-2.5L16 36l-3.25-2.5L9.5 36l-3.25-2.5L3 36V2Z"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linejoin="round"
				/>
				<path
					d="M9 11h14M9 17h10M9 23h14"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-linecap="round"
				/>
			</svg>
		</span>
		<span class="flex min-w-0 flex-col">
			<span class="text-[17px] font-[620] tracking-tight sm:text-[19px]">
				{busy ? 'Starting your request…' : dragging ? 'Let go to start' : title}
			</span>
			<span class="text-[13.5px] text-quiet">{hint}</span>
		</span>
		<span
			class="flex w-full flex-col items-stretch gap-2.5 sm:ml-auto sm:w-auto sm:flex-row sm:items-center sm:gap-3.5"
		>
			<span class="flex flex-col sm:hidden">
				<Button variant="primary" disabled={busy} onclick={() => cameraInput?.click()}>
					Take a photo
				</Button>
			</span>
			<span class="hidden sm:flex">
				<Button variant="primary" disabled={busy} onclick={() => pickerInput?.click()}>Choose files</Button>
			</span>
			{#if onEmpty}
				<span class="text-center">
					<Button variant="quiet" disabled={busy} onclick={onEmpty}>
						No receipt yet? Start empty
					</Button>
				</span>
			{/if}
		</span>
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
		class="pointer-events-none fixed inset-0 z-50 grid place-items-center bg-pine/85 p-6 text-center text-white"
	>
		<div class="flex flex-col items-center gap-2">
			<p class="text-3xl font-semibold tracking-tight">Drop to start a request</p>
			<p class="text-sm text-white/80">Several receipts at once become one request.</p>
		</div>
	</div>
{/if}

<style>
	.slipbox {
		filter: drop-shadow(0 0 0.75px rgb(23 33 28 / 0.45)) drop-shadow(0 4px 5px rgb(23 33 28 / 0.07));
	}

	.slip {
		background: #fffef9;
		mask:
			linear-gradient(#000 0 0) top / 100% calc(100% - 6px) no-repeat,
			conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) bottom / 12px 6px
				repeat-x;
		transition: background-color 120ms ease;
	}

	.slip:hover,
	.slip.dragging {
		background: var(--marker-soft);
	}

	.glyph {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--marker);
		color: var(--pine);
	}

	@media (prefers-reduced-motion: reduce) {
		.slip {
			transition: none;
		}
	}
</style>
