<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Doc } from '$convex/_generated/dataModel';
	import { convexMutation, convexQuery } from '$lib/convex-http';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	const authMode = $derived(page.url.searchParams.get('auth') === 'sign-up' ? 'sign-up' : 'sign-in');

	let purchases = $state<Doc<'purchaseRequests'>[]>([]);
	let purchasesLoading = $state(false);
	let purchasesError = $state('');
	let deviceToken = $state('');
	let deviceTokenError = $state('');

	$effect(() => {
		if (!clerkContext.currentSession) return;
		void loadPurchases();
	});

	async function loadPurchases() {
		if (!clerkContext.currentSession) return;
		purchasesLoading = true;
		purchasesError = '';
		try {
			purchases = await convexQuery(clerkContext.currentSession, api.authed.purchaseBuilder.listPurchases, {});
		} catch (error) {
			purchasesError = error instanceof Error ? error.message : String(error);
		} finally {
			purchasesLoading = false;
		}
	}

	async function createDeviceToken() {
		if (!clerkContext.currentSession) return;
		deviceTokenError = '';
		try {
			deviceToken = await convexMutation(clerkContext.currentSession, api.extension.createDeviceLinkToken, {
				name: 'Chrome extension'
			});
		} catch (error) {
			deviceTokenError = error instanceof Error ? error.message : String(error);
		}
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
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

		<main class="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[1fr_320px]">
			<section class="rounded-lg border border-stone-200 bg-white">
				<div class="border-b border-stone-200 px-5 py-4">
					<h2 class="text-sm font-semibold">Recent</h2>
				</div>
				{#if purchasesLoading}
					<p class="px-5 py-8 text-sm text-stone-500">Loading...</p>
				{:else if purchasesError}
					<p class="px-5 py-8 text-sm text-red-700">{purchasesError}</p>
				{:else if purchases.length === 0}
					<div class="px-5 py-12 text-center">
						<p class="text-sm text-stone-500">No purchase requests yet.</p>
						<a
							class="mt-3 inline-flex rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white"
							href="/app/purchase/new"
						>
							Start the first one
						</a>
					</div>
				{:else}
					<ul class="divide-y divide-stone-200">
						{#each purchases as purchase (purchase._id)}
							<li class="px-5 py-4">
								<div class="flex items-start justify-between gap-4">
									<div>
										{#if purchase.status === 'draft'}
											<a class="text-sm font-medium hover:underline" href={`/app/purchase/new?id=${purchase._id}`}>
												{purchase.itemDescription || 'Untitled request'}
											</a>
										{:else}
											<p class="text-sm font-medium">
												{purchase.itemDescription || 'Untitled request'}
											</p>
										{/if}
										<p class="mt-1 text-sm text-stone-500">
											{money(purchase.totalAmount)} · {purchase.status}
										</p>
									</div>
									<span class="rounded bg-stone-100 px-2 py-1 text-xs text-stone-600">
										{purchase.status}
									</span>
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<aside class="space-y-4">
				<section class="rounded-lg border border-stone-200 bg-white p-5">
					<h2 class="text-sm font-semibold">Extension link</h2>
					<p class="mt-2 text-sm text-stone-500">
						Create a long-lived device token, then paste it into the extension once.
					</p>
					<button
						class="mt-4 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium hover:bg-stone-50"
						type="button"
						onclick={createDeviceToken}
					>
						Create token
					</button>
					{#if deviceToken}
						<textarea
							class="mt-3 h-24 w-full rounded-md border border-stone-300 p-2 text-xs"
							readonly
							value={deviceToken}
						></textarea>
					{/if}
					{#if deviceTokenError}
						<p class="mt-2 text-sm text-red-700">{deviceTokenError}</p>
					{/if}
				</section>
			</aside>
		</main>
	</div>
{/if}
