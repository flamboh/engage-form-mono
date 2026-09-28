<script lang="ts">
	import type { UploadSlot } from '$lib/uploads.svelte';
	import type { Snippet } from 'svelte';
	import FilePick from './FilePick.svelte';

	let {
		id,
		slot,
		title,
		hint,
		compact = false,
		onfiles,
		children
	}: {
		id?: string;
		slot: UploadSlot;
		title: string;
		hint: string;
		compact?: boolean;
		onfiles: (files: File[], slot: UploadSlot) => void;
		children?: Snippet;
	} = $props();

	let over = $state(false);

	function drop(event: DragEvent) {
		event.preventDefault();
		over = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length > 0) onfiles(files, slot);
	}
</script>

<div
	{id}
	class="drop relative border border-dashed transition-colors"
	class:is-over={over}
	class:is-compact={compact}
	role="group"
	aria-label={title}
	ondragenter={(event) => {
		event.preventDefault();
		over = true;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={(event) => {
		if (!event.currentTarget.contains(event.relatedTarget as Node | null)) over = false;
	}}
	ondrop={drop}
>
	{#if compact}
		<div class="flex items-center justify-between gap-3 px-3 py-2.5">
			<div class="min-w-0">
				<p class="text-sm font-medium text-(--ink)">{title}</p>
				<p class="text-xs text-(--quiet)">{hint}</p>
			</div>
			<FilePick
				class="shrink-0 border border-(--ink) bg-white px-3 py-1.5 text-sm font-medium text-(--ink) hover:bg-(--ink) hover:text-white"
				label={`Add ${title}`}
				onfiles={(files) => onfiles(files, slot)}
			>
				Add
			</FilePick>
		</div>
		{#if children}
			<div class="border-t border-dashed border-(--marker-deep)/40 px-3 py-2">
				{@render children()}
			</div>
		{/if}
	{:else}
		<div class="flex flex-col items-center gap-3 px-4 py-6 text-center">
			<p class="text-base font-medium text-(--ink)">{title}</p>
			<p class="max-w-56 text-sm text-(--quiet)">{hint}</p>
			<div class="flex flex-wrap justify-center gap-2">
				<FilePick
					class="bg-(--pine) px-4 py-2 text-sm font-medium text-white hover:bg-(--pine-deep)"
					label="Choose files"
					multiple
					onfiles={(files) => onfiles(files, slot)}
				>
					Choose files
				</FilePick>
				<FilePick
					class="hidden border border-(--pine) bg-white px-4 py-2 text-sm font-medium text-(--pine) pointer-coarse:inline-block"
					label="Take a photo"
					capture
					onfiles={(files) => onfiles(files, slot)}
				>
					Take a photo
				</FilePick>
			</div>
		</div>
	{/if}
</div>

<style>
	.drop {
		border-color: color-mix(in oklab, var(--pine) 45%, var(--line));
		background: white;
	}

	.drop.is-compact {
		border-color: color-mix(in oklab, var(--marker) 70%, var(--ink) 30%);
		background: color-mix(in oklab, var(--marker) 14%, white);
	}

	.drop.is-over {
		border-style: solid;
		border-color: var(--pine);
		background: var(--pine-soft);
	}
</style>
