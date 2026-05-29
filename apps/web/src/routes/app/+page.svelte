<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Doc } from '$convex/_generated/dataModel';
	import AppHeader from '$lib/app/AppHeader.svelte';
	import { Card, CardContent } from '$lib/components/ui/card';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type OrganizationForm = {
		name: string;
		indexNumber: string;
		fundLetter: Doc<'organizations'>['fundLetter'];
		budgetLines: string;
		businessPurposeTemplate: string;
	};

	const defaultTemplate =
		'{Student Organization} wishes to reimburse {Purchaser} because they purchased {Item Description} from {Vendor} for {Total Amount}.';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const authMode = $derived(
		page.url.searchParams.get('auth') === 'sign-up' ? 'sign-up' : 'sign-in'
	);

	let createOpen = $state(false);
	let createError = $state('');
	let backfillStarted = $state(false);
	let form = $state<OrganizationForm>({
		name: '',
		indexNumber: '',
		fundLetter: 'I',
		budgetLines: 'Event Expenses',
		businessPurposeTemplate: defaultTemplate
	});

	const organizations = $derived(savedQuery.data?.organizations ?? []);

	$effect(() => {
		if (!clerkContext.currentSession || backfillStarted) return;
		backfillStarted = true;
		void client.mutation(api.authed.purchaseBuilder.backfillMyPurchaseData, {});
	});

	async function createOrganization() {
		createError = '';
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: form.name,
				indexNumber: form.indexNumber,
				fundLetter: form.fundLetter,
				budgetLines: form.budgetLines.split(',').map((line) => line.trim()),
				businessPurposeTemplate: form.businessPurposeTemplate
			});
			createOpen = false;
			await goto(`/app/org/${id}`);
		} catch (err) {
			createError = err instanceof Error ? err.message : String(err);
		}
	}
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-background">
		<div
			{@attach (el) => {
				if (authMode === 'sign-up') {
					clerkContext.clerk.mountSignUp(el, {});
				} else {
					clerkContext.clerk.mountSignIn(el, {});
				}
			}}
		></div>
	</div>
{:else}
	<div class="min-h-screen bg-background text-foreground">
		<AppHeader
			{organizations}
			bind:createOpen
			bind:form
			error={createError}
			onCreate={createOrganization}
		/>

		<main class="mx-auto max-w-6xl px-4 py-10 sm:px-6">
			{#if savedQuery.isLoading}
				<p class="text-sm text-muted-foreground">Loading...</p>
			{:else if savedQuery.error}
				<p class="text-sm text-destructive">{savedQuery.error.message}</p>
			{:else}
				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
					{#each organizations as org (org._id)}
						<a href={`/app/org/${org._id}`} class="block">
							<Card class="aspect-square transition-colors hover:bg-muted/50">
								<CardContent class="grid h-full place-items-center p-6 text-center">
									<h2 class="text-base font-semibold">{org.name}</h2>
								</CardContent>
							</Card>
						</a>
					{/each}
					<button class="text-left" type="button" onclick={() => (createOpen = true)}>
						<Card class="aspect-square transition-colors hover:bg-muted/50">
							<CardContent class="grid h-full place-items-center p-6 text-center">
								<span class="text-base font-semibold">Create new</span>
							</CardContent>
						</Card>
					</button>
				</div>
			{/if}
		</main>
	</div>
{/if}
