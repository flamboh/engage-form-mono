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
		onclick?: () => void;
		children: Snippet;
	} = $props();

	const classes = $derived(
		[
			'inline-flex shrink-0 items-center justify-center gap-2 border font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:cursor-not-allowed disabled:opacity-60',
			size === 'sm' ? 'h-9 px-3 text-sm' : 'h-11 px-5 text-sm',
			variant === 'primary'
				? 'border-pine bg-pine text-white hover:border-pine-deep hover:bg-pine-deep'
				: variant === 'secondary'
					? 'border-ink bg-surface text-ink hover:bg-pine-soft'
					: 'border-transparent bg-transparent text-quiet underline-offset-4 hover:text-ink hover:underline'
		].join(' ')
	);
</script>

{#if href && !disabled}
	<a class={classes} {href}>{@render children()}</a>
{:else}
	<button class={classes} {type} disabled={disabled || busy} aria-busy={busy} {onclick}>
		{@render children()}
	</button>
{/if}
