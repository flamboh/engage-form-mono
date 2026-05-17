<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { firstIncompleteStep } from '$lib/welcome/steps';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const welcomeState = useQuery(api.authed.purchaseBuilder.welcomeState, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	$effect(() => {
		if (!welcomeState.data) return;
		void goto(`/app/welcome/${firstIncompleteStep(welcomeState.data)}`, { replaceState: true });
	});
</script>

<p class="text-sm text-stone-500">Loading...</p>
