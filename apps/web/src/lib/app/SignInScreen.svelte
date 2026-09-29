<script lang="ts">
	import { page } from '$app/state';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	const mode = $derived(page.url.searchParams.get('auth') === 'sign-up' ? 'sign-up' : 'sign-in');
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-6 bg-surface px-4 py-10">
	<a class="text-lg font-semibold tracking-tight text-pine" href="/">Engage Form</a>
	{#key mode}
		<div
			{@attach (el) => {
				if (mode === 'sign-up') {
					clerkContext.clerk.mountSignUp(el, {});
					return () => clerkContext.clerk.unmountSignUp(el);
				}
				clerkContext.clerk.mountSignIn(el, {});
				return () => clerkContext.clerk.unmountSignIn(el);
			}}
		></div>
	{/key}
</div>
