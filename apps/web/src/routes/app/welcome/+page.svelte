<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import { convexQuery } from '$lib/convex-http';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { firstIncompleteStep, type WelcomeState } from '$lib/welcome/steps';

	const clerkContext = getClerkContext();

	$effect(() => {
		const session = clerkContext.currentSession;
		if (!session) return;
		void (async () => {
			const state: WelcomeState = await convexQuery(
				session,
				api.authed.purchaseBuilder.welcomeState,
				{}
			);
			await goto(`/app/welcome/${firstIncompleteStep(state)}`, { replaceState: true });
		})();
	});
</script>

<p class="text-sm text-stone-500">Loading...</p>
