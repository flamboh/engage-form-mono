<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Props = {
		variant: 'primary' | 'secondary' | 'quiet';
		size?: 'md' | 'sm';
		href?: string;
		disabled?: boolean;
		busy?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	} & Omit<HTMLButtonAttributes & HTMLAnchorAttributes, 'type' | 'class' | 'onclick' | 'children'>;

	let {
		variant,
		size = 'md',
		href,
		disabled = false,
		busy = false,
		type = 'button',
		class: className = '',
		onclick,
		children,
		...rest
	}: Props = $props();

	const classes = $derived(`ui-button ${variant} ${size} ${className}`);
</script>

{#if href && !disabled}
	<a class={classes} {href} {onclick} aria-busy={busy || undefined} {...rest}>
		{@render children()}
	</a>
{:else}
	<button
		class={classes}
		{type}
		disabled={disabled || busy}
		aria-busy={busy || undefined}
		{onclick}
		{...rest}
	>
		{@render children()}
	</button>
{/if}

<style>
	.ui-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		white-space: nowrap;
		font-weight: 600;
		text-decoration: none;
		cursor: pointer;
	}

	.ui-button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.primary,
	.secondary {
		min-height: 42px;
		padding: 0 18px;
		font-size: 14.5px;
		border: 1px solid var(--ink);
	}

	.primary.sm,
	.secondary.sm {
		min-height: 34px;
		padding: 0 12px;
		font-size: 13.5px;
	}

	.primary {
		border-color: var(--pine);
		background: var(--pine);
		color: white;
	}

	.primary:hover:not(:disabled) {
		border-color: var(--pine-deep);
		background: var(--pine-deep);
	}

	.secondary {
		background: var(--surface);
		color: var(--ink);
	}

	.secondary:hover:not(:disabled) {
		background: var(--ink);
		color: white;
	}

	.quiet {
		border: 0;
		background: none;
		padding: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--quiet);
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	.quiet.sm {
		font-size: 13.5px;
	}

	.quiet:hover:not(:disabled) {
		color: var(--ink);
	}
</style>
