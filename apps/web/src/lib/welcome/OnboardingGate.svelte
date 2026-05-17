<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { firstIncompleteStep, wizardComplete } from '$lib/welcome/steps';
	import { useQuery } from 'convex-svelte';

	const { children } = $props();
	const clerkContext = getClerkContext();
	const welcomeState = useQuery(api.authed.purchaseBuilder.welcomeState, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	let checking = $state(true);

	$effect(() => {
		const pathname = page.url.pathname;
		if (!clerkContext.currentSession) {
			checking = false;
			return;
		}
		if (pathname.startsWith('/app/welcome')) {
			checking = false;
			return;
		}
		checking = welcomeState.isLoading;
		if (!welcomeState.data) return;
		if (!wizardComplete(welcomeState.data)) {
			void goto(`/app/welcome/${firstIncompleteStep(welcomeState.data)}`, { replaceState: true });
			return;
		}
		checking = false;
	});
</script>

{#if checking && clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<p class="text-sm text-stone-500">Loading...</p>
	</div>
{:else}
	{@render children()}
{/if}
