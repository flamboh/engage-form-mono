<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import { useQuery } from 'convex-svelte';
	import { getExtensionConnection } from './connection.svelte';

	const connection = getExtensionConnection();
	const sessionsQuery = useQuery(api.authed.extensionSessions.listExtensionSessions, {});
	const sessions = $derived(sessionsQuery.data);
	const extensionState = $derived(connection.state(sessions));
	const current = $derived(
		sessions?.find((session) => session.id === connection.status?.sessionId) ?? null
	);
	const others = $derived(
		(sessions ?? []).filter((session) => session.id !== connection.status?.sessionId)
	);
	const cameFromEngage = $derived(page.url.searchParams.get('connect') === '1');

	function lastUsed(timestamp: number) {
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp);
	}
</script>

<div class="flex flex-col gap-2 text-sm" data-testid="extension-status">
	{#if extensionState === 'checking'}
		<p class="text-stone-500">Looking for the extension…</p>
	{:else if extensionState === 'missing'}
		<p class="text-stone-600">
			The extension isn’t in this browser yet. Add it, then reload this page and it connects on its
			own.
		</p>
		<button
			class="self-start font-medium text-[#154733] underline underline-offset-4"
			type="button"
			onclick={() => connection.refresh()}
		>
			Check again
		</button>
	{:else if extensionState === 'connected' && current}
		<p class="flex flex-wrap items-center gap-x-2 text-stone-900">
			<span class="inline-flex items-center gap-1.5 font-medium">
				<span class="h-2 w-2 rounded-full bg-green-600" aria-hidden="true"></span>
				Extension connected
			</span>
			<span class="text-stone-400" aria-hidden="true">·</span>
			<button
				class="font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900 disabled:opacity-60"
				type="button"
				disabled={connection.busy}
				onclick={() => connection.disconnect(current.id)}
			>
				Disconnect
			</button>
		</p>
		{#if cameFromEngage}
			<p class="text-stone-600">
				You’re set. Go back to your Engage tab and it picks up from there.
			</p>
		{/if}
	{:else}
		<p class="text-stone-600">The extension is installed but not connected to your account.</p>
		<button
			class="inline-flex h-10 items-center self-start rounded-full bg-[#154733] px-4 font-medium text-white hover:bg-[#0f3526] disabled:opacity-60"
			type="button"
			disabled={connection.busy}
			onclick={() => connection.connect()}
		>
			{connection.busy ? 'Connecting…' : 'Connect extension'}
		</button>
	{/if}

	{#if connection.error}
		<p class="text-red-700" role="alert">{connection.error}</p>
	{/if}

	{#if others.length > 0}
		<ul class="mt-2 flex flex-col gap-1 border-t border-stone-200 pt-3 text-stone-600">
			{#each others as session (session.id)}
				<li class="flex flex-wrap items-center gap-x-2">
					<span>Another browser, last used {lastUsed(session.lastUsedAt)}</span>
					<span class="text-stone-400" aria-hidden="true">·</span>
					<button
						class="underline underline-offset-4 hover:text-stone-900 disabled:opacity-60"
						type="button"
						disabled={connection.busy}
						onclick={() => connection.disconnect(session.id)}
					>
						Disconnect
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
