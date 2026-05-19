<script lang="ts">
	import { setClerkContext } from '$lib/stores/clerk.svelte';
	import { onMount } from 'svelte';

	const { children } = $props();

	const clerkContext = setClerkContext();
	const extensionConvexTokenStorageKey = 'engage-form:convex-token';
	const extensionConvexTokenRefreshMs = 45_000;

	onMount(() => {
		const interval = setInterval(
			() => void cacheExtensionConvexToken(),
			extensionConvexTokenRefreshMs
		);
		void cacheExtensionConvexToken();
		return () => {
			clearInterval(interval);
		};
	});

	$effect(() => {
		if (clerkContext.currentSession) {
			void cacheExtensionConvexToken();
		} else {
			localStorage.removeItem(extensionConvexTokenStorageKey);
		}
	});

	async function cacheExtensionConvexToken() {
		const session = clerkContext.currentSession;
		if (!session) {
			localStorage.removeItem(extensionConvexTokenStorageKey);
			return;
		}
		const token = await session.getToken({ template: 'convex' });
		if (!token) {
			localStorage.removeItem(extensionConvexTokenStorageKey);
			return;
		}
		localStorage.setItem(
			extensionConvexTokenStorageKey,
			JSON.stringify({ token, updatedAt: Date.now() })
		);
	}
</script>

{#if clerkContext.isClerkLoaded}
	{@render children()}
{:else}
	<div>Loading...</div>
{/if}
