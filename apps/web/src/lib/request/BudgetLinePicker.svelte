<script lang="ts">
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		budgetLines,
		onpicked
	}: { editor: RequestEditor; budgetLines: string[]; onpicked?: () => void } = $props();
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label="Budget line">
	{#each budgetLines as line (line)}
		<Chip
			selected={editor.form?.budgetLineItem === line}
			onclick={() => {
				editor.update({ budgetLineItem: line });
				onpicked?.();
			}}
		>
			{line}
		</Chip>
	{/each}
</div>
