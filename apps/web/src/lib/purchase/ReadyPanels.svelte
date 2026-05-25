<script lang="ts">
	type Props = {
		onMarkReady: () => Promise<void>;
	};

	let { onMarkReady }: Props = $props();
</script>

<section class="panel">
	<h2>Readiness Review</h2>
	<p class="text-sm text-stone-600">
		Use Ready for extension after the required facts and requirement panels are complete.
	</p>
</section>

<section class="panel">
	<h2>Ready Confirmation</h2>
	<button
		class="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
		type="button"
		onclick={onMarkReady}
	>
		Ready for extension
	</button>
</section>

<style>
	.panel {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		background: white;
		padding: 1.25rem;
	}
</style>
