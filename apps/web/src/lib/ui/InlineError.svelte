<script lang="ts">
	let {
		message,
		fix
	}: {
		message: string;
		fix?: { label: string; onclick: () => void };
	} = $props();
</script>

<p class="text-sm text-(--alert)" role="alert">
	{message}
	{#if fix}
		<button
			class="ml-1 text-(--quiet) underline underline-offset-3 hover:text-(--ink)"
			type="button"
			onclick={fix.onclick}
		>
			{fix.label}
		</button>
	{/if}
</p>
