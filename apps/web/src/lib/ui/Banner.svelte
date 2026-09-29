<script lang="ts">
	let {
		message,
		fix
	}: {
		message: string;
		fix?: { label: string; onclick: () => void };
	} = $props();
</script>

<div class="banner flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm" role="alert">
	<span class="text-(--ink)">{message}</span>
	{#if fix}
		<button
			class="text-(--quiet) underline underline-offset-3 hover:text-(--ink)"
			type="button"
			onclick={fix.onclick}
		>
			{fix.label}
		</button>
	{/if}
</div>

<style>
	.banner {
		border-left: 3px solid var(--alert);
		background: var(--surface);
	}
</style>
