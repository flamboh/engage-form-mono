<script lang="ts">
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { categoryOptions } from './labels';

	let { editor, fundLetter }: { editor: RequestEditor; fundLetter: string } = $props();

	const categories = $derived(new Set(editor.form?.documentationCategories ?? []));
</script>

<div class="flex flex-col gap-2">
	<div class="flex flex-wrap gap-2" role="group" aria-label="What it involves">
		{#each categoryOptions as option (option.value)}
			{@const forced = option.value === 'asuo_funds' && fundLetter === 'I'}
			<Chip
				selected={forced || categories.has(option.value)}
				disabled={forced}
				onclick={() => editor.toggleCategory(option.value, !categories.has(option.value))}
			>
				{option.label}
			</Chip>
		{/each}
	</div>
	{#if fundLetter === 'I'}
		<p class="text-xs text-(--quiet)">
			ASUO event is always on: this organization spends student fee money.
		</p>
	{/if}
</div>
