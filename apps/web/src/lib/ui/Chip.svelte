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
	class="chip"
	class:add={variant === 'add'}
	class:is-selected={selected}
	type="button"
	aria-pressed={variant === 'choice' ? selected : undefined}
	{disabled}
	{onclick}
>
	{@render children()}
</button>

<style>
	.chip {
		display: inline-flex;
		min-height: 36px;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 6px 12px;
		text-align: left;
		font-size: 14px;
		color: var(--ink);
		cursor: pointer;
	}

	.chip:hover:not(:disabled) {
		border-color: var(--pine);
	}

	.chip:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.chip.is-selected {
		border-color: var(--pine);
		background: var(--pine);
		color: white;
	}

	.chip.add {
		border-style: dashed;
		border-color: var(--faint);
		color: var(--quiet);
	}
</style>
