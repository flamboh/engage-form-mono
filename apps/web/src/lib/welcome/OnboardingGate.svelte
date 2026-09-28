<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import SignInScreen from '$lib/app/SignInScreen.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { firstIncompleteStep, wizardComplete } from '$lib/welcome/steps';
	import { useQuery } from 'convex-svelte';

	const { children } = $props();
	const clerkContext = getClerkContext();
	const welcomeState = useQuery(api.authed.purchaseBuilder.welcomeState, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	const onWelcome = $derived(page.url.pathname.startsWith('/app/welcome'));
	const redirectTo = $derived(
		onWelcome || !welcomeState.data || wizardComplete(welcomeState.data)
			? null
			: `/app/welcome/${firstIncompleteStep(welcomeState.data)}`
	);
	const waiting = $derived(!onWelcome && (welcomeState.data === undefined || redirectTo !== null));

	$effect(() => {
		if (redirectTo !== null) void goto(redirectTo, { replaceState: true });
	});
</script>

{#if !clerkContext.currentSession}
	<SignInScreen />
{:else if waiting && !welcomeState.error}
	<div class="flex min-h-screen items-center justify-center bg-white">
		<p class="text-sm text-stone-500">Loading…</p>
	</div>
{:else}
	{@render children()}
{/if}
