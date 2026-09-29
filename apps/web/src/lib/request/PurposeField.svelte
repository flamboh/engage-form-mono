<script lang="ts">
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		recentPurposes,
		limit = 3,
		autofocus = false
	}: {
		editor: RequestEditor;
		recentPurposes: string[];
		limit?: number;
		autofocus?: boolean;
	} = $props();

	let typing = $state(false);

	const purpose = $derived(editor.form?.purpose ?? '');
	const chips = $derived(
		recentPurposes
			.filter((item) => item.toLowerCase() !== purpose.trim().toLowerCase())
			.slice(0, limit)
	);
</script>

<div class="flex flex-col gap-3">
	{#if typing || purpose !== '' || chips.length === 0}
		<input
			class="input"
			maxlength="200"
			autocomplete="off"
			aria-label="What it was for"
			placeholder="Snacks to bring members together"
			value={purpose}
			oninput={(event) => editor.update({ purpose: event.currentTarget.value }, { debounce: true })}
			{@attach (node) => {
				if (typing || autofocus) node.focus();
			}}
		/>
	{/if}
	{#if chips.length > 0}
		<div class="flex flex-wrap gap-2" aria-label="Recent answers">
			{#each chips as item (item)}
				<Chip onclick={() => editor.update({ purpose: item })}>{item}</Chip>
			{/each}
			{#if !typing && purpose === ''}
				<Chip variant="add" onclick={() => (typing = true)}>Something else</Chip>
			{/if}
		</div>
	{/if}
</div>
