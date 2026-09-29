<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import { firstIncompleteStep } from '$lib/welcome/steps';
	import { useQuery } from 'convex-svelte';

	const welcomeState = useQuery(api.authed.purchaseBuilder.welcomeState, {});

	$effect(() => {
		if (welcomeState.data) {
			void goto(`/app/welcome/${firstIncompleteStep(welcomeState.data)}`, { replaceState: true });
		}
	});
</script>

<p class="text-sm text-quiet">Loading…</p>
