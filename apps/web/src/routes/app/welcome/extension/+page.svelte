<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const hasLinkQuery = useQuery(api.extension.hasActiveDeviceToken, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	let token = $state('');
	let copying = $state(false);
	let creating = $state(false);
	let error = $state('');
	const hasLink = $derived(Boolean(token) || (hasLinkQuery.data ?? false));
	const checking = $derived(hasLinkQuery.isLoading);

	async function createToken() {
		error = '';
		creating = true;
		try {
			token = await client.mutation(api.extension.createDeviceLinkToken, {
				name: 'Chrome extension'
			});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			creating = false;
		}
	}

	async function copy() {
		if (!token) return;
		copying = true;
		try {
			await navigator.clipboard.writeText(token);
		} finally {
			setTimeout(() => (copying = false), 1500);
		}
	}

	function done() {
		void goto('/app/welcome/done');
	}
</script>

<div class="space-y-5">
	<header>
		<h2 class="text-lg font-semibold">Chrome extension</h2>
		<p class="mt-1 text-sm text-stone-500">
			Engage Form fills your purchase requests through a Chrome extension. Install it once, paste
			the token below, and you're set.
		</p>
	</header>

	{#if error}
		<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
	{/if}

	<ol class="space-y-3 text-sm">
		<li>
			<span class="font-medium">1. Install the extension.</span>
			<p class="text-stone-500">
				Ask your team lead for the install link — it's a single .crx for now.
			</p>
		</li>
		<li>
			<span class="font-medium">2. Create a device link token.</span>
			<button class="button mt-2" type="button" onclick={createToken} disabled={creating}>
				{creating ? 'Creating...' : token ? 'Create another' : 'Create token'}
			</button>
		</li>
		{#if token}
			<li>
				<span class="font-medium">3. Copy and paste into the extension.</span>
				<textarea class="field mt-2 h-24 font-mono text-xs" readonly value={token}></textarea>
				<button class="secondary mt-2" type="button" onclick={copy}>
					{copying ? 'Copied' : 'Copy token'}
				</button>
				<p class="mt-2 text-xs text-stone-500">
					Open the extension popup, paste the token, and click Link.
				</p>
			</li>
		{/if}
	</ol>

	<div class="flex items-center gap-3">
		<button class="button" type="button" onclick={done} disabled={!hasLink || checking}>
			Continue
		</button>
		{#if !hasLink}
			<span class="text-xs text-stone-500">Create a token to continue.</span>
		{/if}
	</div>
</div>

<style>
	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
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
		padding: 0.5rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}
</style>
