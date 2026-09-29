<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import AccountMenu from '$lib/app/AccountMenu.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useQuery } from 'convex-svelte';

	let {
		organizationId = null,
		children
	}: {
		organizationId?: Id<'organizations'> | null;
		children: Snippet;
	} = $props();

	const lastOrganizationKey = 'engage-form:last-organization';
	const clerkContext = getClerkContext();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const organizations = $derived(savedQuery.data?.organizations ?? []);
	const current = $derived.by(() => {
		const id = organizationId ?? localStorage.getItem(lastOrganizationKey);
		return (
			organizations.find((org) => org._id === id) ??
			(organizationId === null ? (organizations[0] ?? null) : null)
		);
	});
	const homeHref = $derived(current ? `/app/org/${current._id}` : '/app');
	const hasAllocations = $derived(
		current?.budgetLines.some((line) => line.allocations.length > 0) ?? false
	);
	const tabs = $derived(
		current
			? [
					{ href: `/app/org/${current._id}`, label: 'Requests', match: 'requests' },
					...(hasAllocations
						? [{ href: `/app/org/${current._id}/budget`, label: 'Budget', match: 'budget' }]
						: [])
				]
			: []
	);
	const activeTab = $derived.by(() => {
		if (!current) return null;
		const path = page.url.pathname;
		if (path.startsWith(`/app/org/${current._id}/budget`)) return 'budget';
		if (path.startsWith(`/app/org/${current._id}`)) return 'requests';
		return null;
	});

	$effect(() => {
		if (organizationId) localStorage.setItem(lastOrganizationKey, organizationId);
	});

	let switcher = $state<HTMLDetailsElement | null>(null);
</script>

{#snippet tabLinks()}
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			class:on={activeTab === tab.match}
			aria-current={activeTab === tab.match ? 'page' : undefined}
		>
			{tab.label}
		</a>
	{/each}
{/snippet}

<div class="min-h-screen bg-surface text-ink">
	<header class="border-b border-line bg-surface">
		<div class="head">
			<a class="shrink-0 font-[650] tracking-tight text-pine" href={homeHref}>Engage Form</a>
			{#if organizations.length > 0}
				<details class="relative min-w-0" bind:this={switcher}>
					<summary class="switcher">
						<span class="truncate">{current?.name ?? 'Organizations'}</span>
						<svg class="shrink-0" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
							<path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
						</svg>
					</summary>
					<div class="orgs">
						{#each organizations as org (org._id)}
							<a
								class:font-semibold={org._id === current?._id}
								href={`/app/org/${org._id}`}
								onclick={() => switcher?.removeAttribute('open')}
							>
								{org.name}
							</a>
						{/each}
						<a
							class="border-t border-line text-quiet"
							href="/app/settings#new-org"
							onclick={() => switcher?.removeAttribute('open')}
						>
							Add an organization
						</a>
					</div>
				</details>
			{/if}
			{#if tabs.length > 0}
				<nav class="tabs" aria-label="Sections">{@render tabLinks()}</nav>
			{/if}
			<div class="ml-auto">
				<AccountMenu />
			</div>
		</div>
		{#if tabs.length > 0}
			<nav class="sub" aria-label="Sections">{@render tabLinks()}</nav>
		{/if}
	</header>
	{@render children()}
</div>

<style>
	.head {
		display: flex;
		height: 56px;
		align-items: center;
		gap: 18px;
		padding: 0 32px;
	}

	.switcher {
		display: flex;
		max-width: 16rem;
		cursor: pointer;
		list-style: none;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		font-size: 14.5px;
		font-weight: 550;
		white-space: nowrap;
	}

	.switcher::-webkit-details-marker {
		display: none;
	}

	.switcher:hover {
		background: var(--paper);
	}

	.orgs {
		position: absolute;
		top: 44px;
		left: 0;
		z-index: 40;
		display: flex;
		width: 16rem;
		flex-direction: column;
		border: 1px solid var(--ink);
		background: var(--surface);
		box-shadow: 0 16px 32px -16px rgb(23 33 28 / 0.4);
	}

	.orgs a {
		padding: 10px 16px;
		font-size: 14.5px;
	}

	.orgs a:hover {
		background: var(--paper);
	}

	.tabs {
		display: flex;
		height: 100%;
		gap: 2px;
		margin-left: 12px;
	}

	.tabs a,
	.sub a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-bottom: 2px solid transparent;
		padding: 0 12px;
		font-size: 14.5px;
		color: var(--quiet);
		text-decoration: none;
	}

	.tabs a.on,
	.sub a.on {
		border-bottom-color: var(--ink);
		font-weight: 550;
		color: var(--ink);
	}

	.sub {
		display: none;
	}

	@media (max-width: 640px) {
		.head {
			height: 52px;
			gap: 8px;
			padding: 0 16px;
		}

		.switcher {
			max-width: 11rem;
			font-size: 14px;
		}

		.tabs {
			display: none;
		}

		.sub {
			display: flex;
			border-top: 1px solid var(--line);
		}

		.sub a {
			flex: 1;
			padding: 10px 0;
			font-size: 14px;
		}
	}
</style>
