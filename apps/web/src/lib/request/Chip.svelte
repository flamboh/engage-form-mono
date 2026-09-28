<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		selected = false,
		disabled = false,
		onclick,
		children
	}: {
		selected?: boolean;
		disabled?: boolean;
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<button
	class="chip inline-flex min-h-9 items-center gap-1.5 border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine) disabled:cursor-not-allowed disabled:opacity-60"
	class:is-selected={selected}
	type="button"
	aria-pressed={selected}
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style>
	.chip {
		border-color: var(--line);
		background: white;
		color: var(--ink);
	}

	.chip:hover:not(:disabled) {
		border-color: var(--pine);
	}

	.chip.is-selected {
		border-color: var(--pine);
		background: var(--pine);
		color: white;
	}
</style>
