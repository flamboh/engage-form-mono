<script lang="ts">
	import type { Snippet } from 'svelte';
	import { api } from '$convex/_generated/api';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import { setExtensionConnection } from './connection.svelte';

	const { children }: { children: Snippet } = $props();

	const clerkContext = getClerkContext();
	const connection = setExtensionConnection(useConvexClient());
	const sessionsQuery = useQuery(api.authed.extensionSessions.listExtensionSessions, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	$effect(() => {
		const sessions = sessionsQuery.data;
		if (clerkContext.currentSession && sessions !== undefined)
			void connection.autoConnect(sessions);
	});
</script>

{@render children()}
