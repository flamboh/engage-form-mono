<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { convexQuery } from '$lib/convex-http';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { firstIncompleteStep, wizardComplete, type WelcomeState } from '$lib/welcome/steps';

	const { children } = $props();
	const clerkContext = getClerkContext();

	let checking = $state(true);

	$effect(() => {
		const session = clerkContext.currentSession;
		const pathname = page.url.pathname;
		if (!session) {
			checking = false;
			return;
		}
		if (pathname.startsWith('/app/welcome')) {
			checking = false;
			return;
		}
		checking = true;
		void (async () => {
			try {
				const state: WelcomeState = await convexQuery(
					session,
					api.authed.purchaseBuilder.welcomeState,
					{}
				);
				if (!wizardComplete(state)) {
					await goto(`/app/welcome/${firstIncompleteStep(state)}`, { replaceState: true });
					return;
				}
			} catch (error) {
				console.error('Onboarding gate check failed', error);
			} finally {
				checking = false;
			}
		})();
	});
</script>

{#if checking && clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<p class="text-sm text-stone-500">Loading...</p>
	</div>
{:else}
	{@render children()}
{/if}
