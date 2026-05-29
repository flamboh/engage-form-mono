<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	let error = $state('');
	let started = $state(false);

	$effect(() => {
		if (started || !clerkContext.currentSession) return;
		started = true;
		void createDraft();
	});

	async function createDraft() {
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
				organizationId
			});
			await goto(`/app/org/${organizationId}/purchase/${id}`, { replaceState: true });
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<main class="grid min-h-screen place-items-center bg-background px-6 text-foreground">
	<div class="text-sm text-muted-foreground">
		{#if error}
			<span class="text-destructive">{error}</span>
		{:else}
			Creating draft...
		{/if}
	</div>
</main>
