<script lang="ts">
	import type { Snippet } from 'svelte';

	let { title, body, action }: { title: string; body?: string; action?: Snippet } = $props();
</script>

<div class="flex flex-col items-start gap-2 border-y border-line py-8">
	<p class="text-[17px] font-[620]">{title}</p>
	{#if body}
		<p class="max-w-prose text-sm text-quiet">{body}</p>
	{/if}
	{#if action}
		<div class="mt-2">{@render action()}</div>
	{/if}
</div>
