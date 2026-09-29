<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant,
		size = 'md',
		href,
		disabled = false,
		busy = false,
		type = 'button',
		onclick,
		children
	}: {
		variant: 'primary' | 'secondary' | 'quiet';
		size?: 'md' | 'sm';
		href?: string;
		disabled?: boolean;
		busy?: boolean;
		type?: 'button' | 'submit';
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const classes = $derived(['ui-button', `is-${variant}`, `is-${size}`]);
</script>

{#if href !== undefined}
	<a class={classes} {href} {onclick}>{@render children()}</a>
{:else}
	<button class={classes} {type} disabled={disabled || busy} aria-busy={busy} {onclick}>
		{@render children()}
	</button>
{/if}

<style>
	.ui-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		font-weight: 600;
		white-space: nowrap;
		transition:
			background-color 120ms,
			color 120ms,
			transform 120ms;
	}

	.is-md {
		min-height: 2.625rem;
		padding: 0 1.125rem;
		font-size: 0.9375rem;
	}

	.is-sm {
		min-height: 2.125rem;
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}

	.is-primary {
		background: var(--pine);
		color: white;
	}

	.is-primary:hover:not(:disabled) {
		background: var(--pine-deep);
	}

	.is-secondary {
		border: 1px solid var(--ink);
		background: var(--surface);
		color: var(--ink);
	}

	.is-secondary:hover:not(:disabled) {
		background: var(--ink);
		color: white;
	}

	.is-quiet {
		min-height: auto;
		padding: 0;
		font-weight: 400;
		color: var(--quiet);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.is-quiet:hover:not(:disabled) {
		color: var(--ink);
	}

	.ui-button:active:not(:disabled) {
		transform: scale(0.98);
	}

	.ui-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.ui-button:focus-visible {
		outline: 2px solid var(--pine);
		outline-offset: 2px;
	}
</style>
