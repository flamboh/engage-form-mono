<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import AppShell from '$lib/app/AppShell.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const organizations = $derived(savedQuery.data?.organizations ?? []);
	const onlyOrganization = $derived(
		savedQuery.data?.organizations.length === 1 ? savedQuery.data.organizations[0] : null
	);

	$effect(() => {
		if (onlyOrganization) void goto(`/app/org/${onlyOrganization._id}`, { replaceState: true });
	});
</script>

{#if savedQuery.data && !onlyOrganization}
	<AppShell>
		<main class="mx-auto flex max-w-xl flex-col gap-6 px-4 pt-10 pb-16 sm:px-6">
			<h1 class="text-2xl font-semibold tracking-tight">Which organization is this for?</h1>
			{#if organizations.length === 0}
				<EmptyState
					title="No organizations yet."
					body="Add your student organization to start dropping receipts."
				/>
			{:else}
				<ul class="border-t border-line">
					{#each organizations as org (org._id)}
						<li class="border-b border-line">
							<a
								class="flex items-center justify-between gap-4 py-4 hover:underline hover:underline-offset-4"
								href={`/app/org/${org._id}`}
							>
								<span class="font-medium">{org.name}</span>
								<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
									<path
										d="M4.5 3 7.5 6 4.5 9"
										fill="none"
										stroke="currentColor"
										stroke-width="1.5"
									/>
								</svg>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			<div>
				<Button variant="secondary" href="/app/settings#new-org">Add an organization</Button>
			</div>
		</main>
	</AppShell>
{:else if savedQuery.error}
	<div class="p-6"><InlineError message={savedQuery.error.message} /></div>
{:else}
	<div class="flex min-h-screen items-center justify-center">
		<p class="text-sm text-quiet">Loading…</p>
	</div>
{/if}
