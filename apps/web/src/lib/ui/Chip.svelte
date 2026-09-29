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
	class="inline-flex min-h-9 shrink-0 items-center gap-1.5 border px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pine disabled:cursor-not-allowed disabled:opacity-60 {selected
		? 'border-pine bg-pine text-white'
		: variant === 'add'
			? 'border-dashed border-line bg-surface text-quiet hover:border-pine hover:text-ink'
			: 'border-line bg-surface text-ink hover:border-pine'}"
	type="button"
	aria-pressed={variant === 'choice' ? selected : undefined}
	{disabled}
	{onclick}
>
	{@render children()}
</button>
