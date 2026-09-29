<script lang="ts">
	import FilePick from './FilePick.svelte';
	import type { IdSide, RequestEditor } from './editor.svelte';
	import { hasFile } from './steps';

	let { editor }: { editor: RequestEditor } = $props();

	const purchaser = $derived(editor.form?.purchaser);
	const sides = $derived([
		{ side: 'front' as IdSide, label: 'Front', on: hasFile(purchaser?.idCardFrontFileId) },
		{ side: 'back' as IdSide, label: 'Back', on: hasFile(purchaser?.idCardBackFileId) }
	]);
</script>

<div class="grid max-w-md grid-cols-2 gap-3">
	{#each sides as item (item.side)}
		<FilePick
			class={[
				'id-tile flex aspect-[1.6] flex-col items-center justify-center gap-1 border px-3 text-center text-sm',
				item.on ? 'is-on' : 'border-dashed'
			].join(' ')}
			label={`${item.on ? 'Replace' : 'Add'} the ${item.label.toLowerCase()} of the UO ID`}
			onfiles={(files) => {
				const file = files[0];
				if (file !== undefined) void editor.addIdCard(item.side, file);
			}}
		>
			<span class="font-medium text-(--ink)">{item.label}</span>
			<span class="text-xs text-(--quiet)">
				{editor.idUploading === item.side
					? 'Uploading…'
					: item.on
						? 'On file · Replace'
						: 'Add photo'}
			</span>
		</FilePick>
	{/each}
</div>

<style>
	:global(.id-tile) {
		border-color: color-mix(in oklab, var(--pine) 45%, var(--line));
		background: var(--surface);
	}

	:global(.id-tile.is-on) {
		border-color: var(--pine);
		background: var(--pine-soft);
	}
</style>
