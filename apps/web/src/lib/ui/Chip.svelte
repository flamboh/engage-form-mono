<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		selected = false,
		variant = 'choice',
		disabled = false,
		onclick,
		children
	}: {
		selected?: boolean;
		variant?: 'choice' | 'add';
		disabled?: boolean;
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<button
	class="chip inline-flex min-h-9 items-center gap-1.5 border px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine) disabled:cursor-not-allowed disabled:opacity-60"
	class:is-selected={selected}
	class:is-add={variant === 'add'}
	type="button"
	aria-pressed={variant === 'choice' ? selected : undefined}
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style>
	.chip {
		border-color: var(--line);
		background: var(--surface);
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

	.chip.is-add {
		border-style: dashed;
		border-color: var(--quiet);
		background: transparent;
		color: var(--quiet);
	}

	.chip.is-add:hover:not(:disabled) {
		border-color: var(--pine);
		color: var(--pine);
	}
</style>
