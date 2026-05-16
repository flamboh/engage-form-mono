<script lang="ts">
	import { CONVEX_URL } from '$lib/convex-env';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { setupConvex, useConvexClient } from 'convex-svelte';

	const clerkContext = getClerkContext();

	setupConvex(CONVEX_URL);

	const convex = useConvexClient();

	$effect(() => {
		const session = clerkContext.currentSession;
		if (!session) {
			convex.clearAuth();
			return;
		}

		convex.setAuth(() =>
			session.getToken({
				template: 'convex'
			})
		);
	});

	const { children } = $props();
</script>

{@render children()}
