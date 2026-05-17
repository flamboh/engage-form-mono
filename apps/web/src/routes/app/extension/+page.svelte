<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type DeviceToken = {
		id: Id<'extensionSessions'>;
		name: string;
		createdAt: number;
		lastUsedAt: number | null;
		revokedAt: number | null;
	};

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const tokensQuery = useQuery(api.extension.listDeviceTokens, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	let creating = $state(false);
	let newToken = $state('');
	let newTokenName = $state('Chrome extension');
	let copying = $state(false);
	let error = $state('');

	const tokens = $derived<DeviceToken[]>(tokensQuery.data ?? []);

	async function createToken() {
		error = '';
		creating = true;
		try {
			newToken = await client.mutation(api.extension.createDeviceLinkToken, {
				name: newTokenName.trim() || 'Chrome extension'
			});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			creating = false;
		}
	}

	async function copy() {
		if (!newToken) return;
		copying = true;
		try {
			await navigator.clipboard.writeText(newToken);
		} finally {
			setTimeout(() => (copying = false), 1500);
		}
	}

	async function revoke(id: Id<'extensionSessions'>) {
		error = '';
		try {
			await client.mutation(api.extension.revokeDeviceToken, { id });
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function formatDate(value: number | null) {
		if (value === null) return '—';
		return new Date(value).toLocaleString();
	}
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div
			{@attach (el) => {
				clerkContext.clerk.mountSignIn(el, {});
			}}
		></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<header class="border-b border-stone-200 bg-white">
			<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
				<div class="flex items-center gap-3">
					<a class="text-sm text-stone-500 hover:text-stone-900" href="/app">Back</a>
					<h1 class="text-lg font-semibold">Chrome extension</h1>
				</div>
				<div
					{@attach (el) => {
						clerkContext.clerk.mountUserButton(el);
					}}
				></div>
			</div>
		</header>

		<main class="mx-auto max-w-4xl space-y-6 px-6 py-8">
			{#if error}<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<h2 class="text-sm font-semibold">Create a new device token</h2>
				<p class="mt-1 text-sm text-stone-500">
					Use a token per device. Paste it into the Engage Form extension popup to link the browser.
				</p>
				<div class="mt-4 flex flex-wrap items-end gap-3">
					<label class="text-sm">
						<span class="font-medium">Name</span>
						<input class="field mt-1 w-64" bind:value={newTokenName} />
					</label>
					<button class="button" type="button" onclick={createToken} disabled={creating}>
						{creating ? 'Creating...' : 'Create token'}
					</button>
				</div>
				{#if newToken}
					<textarea class="field mt-4 h-24 font-mono text-xs" readonly value={newToken}></textarea>
					<button class="secondary mt-2" type="button" onclick={copy}>
						{copying ? 'Copied' : 'Copy token'}
					</button>
				{/if}
			</section>

			<section class="rounded-lg border border-stone-200 bg-white">
				<div class="border-b border-stone-200 px-5 py-4">
					<h2 class="text-sm font-semibold">Linked devices</h2>
				</div>
				{#if tokensQuery.isLoading}
					<p class="px-5 py-6 text-sm text-stone-500">Loading...</p>
				{:else if tokens.length === 0}
					<p class="px-5 py-6 text-sm text-stone-500">No tokens yet.</p>
				{:else}
					<ul class="divide-y divide-stone-200">
						{#each tokens as token (token.id)}
							<li class="px-5 py-4">
								<div class="flex items-center justify-between gap-4">
									<div>
										<p class="text-sm font-medium">
											{token.name}
											{#if token.revokedAt !== null}
												<span class="ml-2 text-xs text-stone-500">revoked</span>
											{/if}
										</p>
										<p class="mt-1 text-xs text-stone-500">
											Created {formatDate(token.createdAt)} · Last used {formatDate(
												token.lastUsedAt
											)}
										</p>
									</div>
									{#if token.revokedAt === null}
										<button class="secondary" type="button" onclick={() => revoke(token.id)}>
											Revoke
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</main>
	</div>
{/if}

<style>
	.field {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
	.field.h-24 {
		width: 100%;
	}
	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
	.button:disabled {
		opacity: 0.6;
	}
	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.45rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}
</style>
