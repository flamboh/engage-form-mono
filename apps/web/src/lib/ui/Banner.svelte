<script lang="ts">
	let { message, fix }: { message: string; fix?: { label: string; onclick: () => void } } =
		$props();
</script>

<div
	class="flex items-center gap-4 border-l-4 border-alert bg-alert-soft px-4 py-3 text-sm"
	role="alert"
>
	<p class="flex-1 text-alert">{message}</p>
	{#if fix}
		<button class="text-ink underline underline-offset-3" type="button" onclick={fix.onclick}>
			{fix.label}
		</button>
	{/if}
</div>
