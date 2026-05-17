<script lang="ts">
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	const firstName = $derived(clerkContext.currentUser?.firstName ?? 'there');
</script>

<div class="space-y-6">
	<header>
		<h2 class="text-lg font-semibold">You're all set, {firstName}.</h2>
		<p class="mt-1 text-sm text-stone-500">
			Build your first purchase request, then open Engage and let the extension fill it.
		</p>
	</header>

	<div class="flex gap-3">
		<a class="button" href="/app/purchase/new">Build your first request</a>
		<a class="secondary" href="/app">Go to dashboard</a>
	</div>
</div>

<style>
	.button {
		display: inline-flex;
		align-items: center;
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.55rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
	.secondary {
		display: inline-flex;
		align-items: center;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.9rem;
		font-size: 0.875rem;
		font-weight: 500;
	}
</style>
