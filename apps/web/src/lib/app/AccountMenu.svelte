<script lang="ts">
	import { api } from '$convex/_generated/api';
	import { getExtensionConnection } from '$lib/extension/connection.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const connection = getExtensionConnection();
	const userQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, {});
	const sessionsQuery = useQuery(api.authed.extensionSessions.listExtensionSessions, {});
	const menuId = $props.id();

	let menu = $state<HTMLDivElement | null>(null);

	const name = $derived(userQuery.data?.name || clerkContext.currentUser?.fullName || '');
	const email = $derived(
		userQuery.data?.studentEmail ||
			clerkContext.currentUser?.primaryEmailAddress?.emailAddress ||
			''
	);
	const initials = $derived(
		(name || email)
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('') || '?'
	);
	const extensionState = $derived(connection.state(sessionsQuery.data));
	const extensionLabel = $derived(
		{
			checking: '',
			missing: 'Not installed',
			connected: 'Connected',
			disconnected: 'Not connected'
		}[extensionState]
	);

	function close() {
		menu?.hidePopover();
	}

	async function signOut() {
		close();
		await clerkContext.clerk.signOut();
	}
</script>

<button
	class="avatar"
	type="button"
	popovertarget={menuId}
	aria-label={`Account menu for ${name || email}`}
>
	{initials}
	{#if extensionState === 'connected'}<span class="dot" aria-hidden="true"></span>{/if}
</button>

<div class="menu" id={menuId} popover="auto" bind:this={menu}>
	<div class="who">
		<b>{name}</b>
		<span>{email}</span>
	</div>
	<a href="/app/settings" onclick={close}>Settings</a>
	<a href="/app/settings#extension" onclick={close}>
		Extension
		{#if extensionLabel}
			<span class="status" class:connected={extensionState === 'connected'}>
				{extensionLabel}
			</span>
		{/if}
	</a>
	<button type="button" onclick={signOut}>Sign out</button>
</div>

<style>
	.avatar {
		position: relative;
		display: grid;
		flex: none;
		width: 32px;
		height: 32px;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: var(--pine);
		font-size: 12.5px;
		font-weight: 600;
		color: white;
		cursor: pointer;
	}

	.dot {
		position: absolute;
		right: -1px;
		bottom: -1px;
		width: 10px;
		height: 10px;
		border: 2px solid white;
		border-radius: 50%;
		background: var(--ok);
	}

	.menu {
		position: fixed;
		inset: 52px 16px auto auto;
		width: 290px;
		margin: 0;
		border: 1px solid var(--ink);
		background: var(--surface);
		padding: 0;
		color: var(--ink);
		box-shadow: 0 16px 32px -16px rgb(23 33 28 / 0.4);
	}

	.who {
		display: flex;
		flex-direction: column;
		border-bottom: 1px solid var(--line);
		padding: 14px 16px;
	}

	.who b {
		font-weight: 600;
	}

	.who span {
		overflow: hidden;
		font-size: 13.5px;
		color: var(--quiet);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.menu a,
	.menu button {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		border: 0;
		border-bottom: 1px solid var(--line);
		background: none;
		padding: 11px 16px;
		text-align: left;
		font-size: 14.5px;
		color: inherit;
		text-decoration: none;
		cursor: pointer;
	}

	.menu button {
		border-bottom: 0;
		color: var(--quiet);
	}

	.menu a:hover,
	.menu button:hover {
		background: var(--paper);
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		color: var(--quiet);
	}

	.status::before {
		content: '';
		width: 8px;
		height: 8px;
		border: 1.5px solid var(--quiet);
		border-radius: 50%;
	}

	.status.connected {
		color: var(--pine);
	}

	.status.connected::before {
		border: 0;
		background: var(--ok);
	}

	@media (max-width: 640px) {
		.menu {
			inset: 52px 8px auto 8px;
			width: auto;
		}
	}
</style>
