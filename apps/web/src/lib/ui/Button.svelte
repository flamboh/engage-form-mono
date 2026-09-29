<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = 'secondary',
		size = 'md',
		href,
		disabled = false,
		busy = false,
		type = 'button',
		onclick,
		children
	}: {
		variant?: 'primary' | 'secondary' | 'quiet';
		size?: 'md' | 'sm';
		href?: string;
		disabled?: boolean;
		busy?: boolean;
		type?: 'button' | 'submit' | 'reset';
		onclick?: (event: MouseEvent) => void;
		children: Snippet;
	} = $props();

	const classes = $derived(
		[
			'ui-button',
			variant,
			size,
			variant === 'quiet'
				? 'text-sm text-quiet underline underline-offset-3 hover:text-ink'
				: 'inline-flex items-center justify-center gap-2 border font-semibold whitespace-nowrap',
			variant === 'primary' && 'border-pine bg-pine text-white hover:bg-pine-deep',
			variant === 'secondary' && 'border-ink bg-transparent text-ink hover:bg-ink hover:text-white',
			variant !== 'quiet' && size === 'md' && 'min-h-[42px] px-[18px] text-[14.5px]',
			variant !== 'quiet' && size === 'sm' && 'min-h-[34px] px-3 text-[13.5px]',
			'disabled:cursor-default disabled:opacity-60'
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

{#if href && !disabled}
	<a class={classes} {href} {onclick}>{@render children()}</a>
{:else}
	<button class={classes} {type} disabled={disabled || busy} aria-busy={busy} {onclick}>
		{@render children()}
	</button>
{/if}
