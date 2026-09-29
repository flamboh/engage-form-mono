<script lang="ts">
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import Button from '$lib/ui/Button.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
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
		const day = (value: number) => new Date(value).toDateString();
		if (day(timestamp) === day(Date.now())) return 'today';
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(timestamp);
	}
</script>

<div class="flex flex-col gap-2 text-sm" data-testid="extension-status">
	{#if extensionState === 'checking'}
		<p class="text-quiet">Looking for the extension…</p>
	{:else if extensionState === 'missing'}
		<p class="text-quiet">
			The extension isn’t in this browser yet. Add it, then reload this page and it connects on its
			own.
		</p>
		<div><Button variant="quiet" onclick={() => connection.refresh()}>Check again</Button></div>
	{:else if extensionState === 'connected' && current}
		{#if cameFromEngage}
			<p class="border-l-3 border-marker bg-surface py-2 pl-3 text-ink">
				You’re set. Go back to your Engage tab and it picks up from there.
			</p>
		{/if}
		<dl class="border-t border-line">
			<FieldRow
				label="This browser"
				value={`last used ${lastUsed(current.lastUsedAt)}`}
				actionLabel="Disconnect"
				onaction={() => connection.disconnect(current.id)}
			>
				<span class="ok">Connected</span>
			</FieldRow>
			{#each others as session (session.id)}
				<FieldRow
					label="Other browser"
					value={`last used ${lastUsed(session.lastUsedAt)}`}
					actionLabel="Disconnect"
					onaction={() => connection.disconnect(session.id)}
				/>
			{/each}
			<FieldRow
				label="Install again"
				value="engage-form-extension.zip"
				actionLabel="Download"
				onaction={() => window.location.assign('/engage-form-extension.zip')}
			/>
		</dl>
	{:else}
		<p class="text-quiet">The extension is installed but not connected to your account.</p>
		<div>
			<Button variant="primary" busy={connection.busy} onclick={() => connection.connect()}>
				{connection.busy ? 'Connecting…' : 'Connect extension'}
			</Button>
		</div>
		{#if others.length > 0}
			<dl class="mt-2 border-t border-line">
				{#each others as session (session.id)}
					<FieldRow
						label="Other browser"
						value={`last used ${lastUsed(session.lastUsedAt)}`}
						actionLabel="Disconnect"
						onaction={() => connection.disconnect(session.id)}
					/>
				{/each}
			</dl>
		{/if}
	{/if}

	{#if connection.error}<InlineError message={connection.error} />{/if}
</div>

<style>
	.ok {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin-left: 10px;
		font-size: 13px;
		color: var(--pine);
	}

	.ok::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--ok);
	}
</style>
