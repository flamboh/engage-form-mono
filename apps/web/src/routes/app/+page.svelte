<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const purchasesQuery = useQuery(api.authed.purchaseBuilder.listPurchases, () =>
		clerkContext.currentSession ? {} : 'skip'
	);
	const authMode = $derived(
		page.url.searchParams.get('auth') === 'sign-up' ? 'sign-up' : 'sign-in'
	);

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}

	const purchases = $derived(purchasesQuery.data ?? []);
	const purchasesError = $derived(purchasesQuery.error?.message ?? '');
	const drafts = $derived(purchases.filter((p) => p.status === 'draft'));
	const ready = $derived(purchases.filter((p) => p.status === 'ready'));
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
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
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<header class="border-b border-stone-200 bg-white">
			<div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
				<div>
					<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">Engage Form</p>
					<h1 class="text-lg font-semibold">Purchase requests</h1>
				</div>
				<div class="flex items-center gap-2">
					<a class="rounded-md px-3 py-2 text-sm hover:bg-stone-100" href="/app/extension">
						Extension
					</a>
					<a class="rounded-md px-3 py-2 text-sm hover:bg-stone-100" href="/app/saved">Saved</a>
					<a
						class="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
						href="/app/purchase/new"
					>
						New request
					</a>
					<div
						{@attach (el) => {
							clerkContext.clerk.mountUserButton(el);
						}}
					></div>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-5xl space-y-6 px-6 py-8">
			{#if purchasesError}
				<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{purchasesError}</p>
			{/if}

			{#if purchasesQuery.isLoading}
				<p class="text-sm text-stone-500">Loading...</p>
			{:else if purchases.length === 0}
				<section class="rounded-lg border border-stone-200 bg-white p-8 text-center">
					<p class="text-sm text-stone-500">No purchase requests yet.</p>
					<a
						class="mt-3 inline-flex rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white"
						href="/app/purchase/new"
					>
						Start the first one
					</a>
				</section>
			{:else}
				{#each [{ label: 'Ready for extension', items: ready }, { label: 'Drafts', items: drafts }] as group (group.label)}
					{#if group.items.length > 0}
						<section class="rounded-lg border border-stone-200 bg-white">
							<div class="border-b border-stone-200 px-5 py-4">
								<h2 class="text-sm font-semibold">{group.label}</h2>
							</div>
							<ul class="divide-y divide-stone-200">
								{#each group.items as purchase (purchase._id)}
									<li class="px-5 py-4">
										<div class="flex items-start justify-between gap-4">
											<div>
												<a
													class="text-sm font-medium hover:underline"
													href={`/app/purchase/new?id=${purchase._id}`}
												>
													{purchase.itemDescription || 'Untitled request'}
												</a>
												<p class="mt-1 text-sm text-stone-500">{money(purchase.totalAmount)}</p>
											</div>
											<span class="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600">
												{purchase.status}
											</span>
										</div>
									</li>
								{/each}
							</ul>
						</section>
					{/if}
				{/each}
			{/if}
		</main>
	</div>
{/if}
