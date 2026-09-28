<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useQuery } from 'convex-svelte';

	let {
		organizationId = null,
		children
	}: {
		organizationId?: Id<'organizations'> | null;
		children: Snippet;
	} = $props();

	const clerkContext = getClerkContext();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const organizations = $derived(savedQuery.data?.organizations ?? []);
	const current = $derived(organizations.find((org) => org._id === organizationId) ?? null);
	const homeHref = $derived(current ? `/app/org/${current._id}` : '/app');

	let switcher = $state<HTMLDetailsElement | null>(null);

	const links = [
		{ href: '/app/saved', label: 'Saved info' },
		{ href: '/app/extension', label: 'Extension' }
	];
</script>

<div class="min-h-screen bg-white text-stone-900">
	<header class="border-b border-stone-200 bg-white">
		<div class="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
			<a class="mr-1 shrink-0 font-semibold tracking-tight text-[#154733]" href={homeHref}>
				Engage Form
			</a>
			{#if organizations.length > 1 || current}
				<details class="relative min-w-0" bind:this={switcher}>
					<summary
						class="flex h-9 max-w-[11rem] cursor-pointer list-none items-center gap-1.5 rounded-full px-3 text-sm font-medium hover:bg-stone-100 sm:max-w-xs [&::-webkit-details-marker]:hidden"
					>
						<span class="truncate">{current?.name ?? 'Organizations'}</span>
						<svg class="shrink-0" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
							<path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.5" />
						</svg>
					</summary>
					<div
						class="absolute top-11 left-0 z-40 flex w-64 flex-col border border-stone-200 bg-white py-1 shadow-lg"
					>
						{#each organizations as org (org._id)}
							<a
								class="px-4 py-2.5 text-sm hover:bg-stone-100"
								class:font-semibold={org._id === organizationId}
								href={`/app/org/${org._id}`}
								onclick={() => switcher?.removeAttribute('open')}
							>
								{org.name}
							</a>
						{/each}
						<a
							class="border-t border-stone-200 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-100"
							href="/app/saved#organizations"
							onclick={() => switcher?.removeAttribute('open')}
						>
							Add an organization
						</a>
					</div>
				</details>
			{/if}
			<nav class="ml-auto hidden items-center gap-1 sm:flex">
				{#each links as link (link.href)}
					<a
						class="rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-100 hover:text-stone-900"
						class:text-stone-900={page.url.pathname.startsWith(link.href)}
						href={link.href}
					>
						{link.label}
					</a>
				{/each}
			</nav>
			<div
				class="ml-auto h-7 w-7 shrink-0 sm:ml-2"
				{@attach (el) => {
					clerkContext.clerk.mountUserButton(el);
					return () => clerkContext.clerk.unmountUserButton(el);
				}}
			></div>
		</div>
		<nav class="flex gap-1 border-t border-stone-100 px-2 py-1 sm:hidden">
			{#each links as link (link.href)}
				<a class="rounded-full px-3 py-1.5 text-sm text-stone-600" href={link.href}>
					{link.label}
				</a>
			{/each}
		</nav>
	</header>
	{@render children()}
</div>
