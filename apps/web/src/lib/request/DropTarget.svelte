<script lang="ts">
	import type { UploadSlot } from '$lib/uploads.svelte';
	import FilePick from './FilePick.svelte';

	let {
		slot,
		label,
		action = 'Choose file',
		multiple = false,
		onfiles
	}: {
		slot: UploadSlot;
		label: string;
		action?: string;
		multiple?: boolean;
		onfiles: (files: File[], slot: UploadSlot) => void;
	} = $props();

	let over = $state(false);

	function drop(event: DragEvent) {
		event.preventDefault();
		over = false;
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length > 0) onfiles(multiple ? files : files.slice(0, 1), slot);
	}
</script>

<div
	class="drop flex flex-wrap items-center justify-between gap-3 border border-dashed px-4 py-4"
	class:is-over={over}
	role="group"
	aria-label={label}
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
	<p class="text-sm text-(--quiet)">{label}</p>
	<FilePick
		class="pick inline-flex min-h-9 shrink-0 items-center border border-(--ink) bg-(--surface) px-3 text-sm font-semibold text-(--ink)"
		label={`${action}: ${label}`}
		{multiple}
		onfiles={(files) => onfiles(files, slot)}
	>
		{action}
	</FilePick>
</div>

<style>
	.drop {
		border-color: var(--quiet);
		background: var(--surface);
	}

	.drop.is-over {
		border-style: solid;
		border-color: var(--pine);
		background: var(--pine-soft);
	}

	.drop :global(.pick:hover) {
		background: var(--ink);
		color: white;
	}
</style>
