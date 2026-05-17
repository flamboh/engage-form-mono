<script lang="ts">
	import { api } from '$convex/_generated/api';
	import PageError from '$lib/components/PageError.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const authedDemo = useQuery(api.authed.demo.authedDemoQuery, () =>
		clerkContext.currentSession ? {} : 'skip'
	);
</script>

<div class="min-h-screen bg-stone-50 text-stone-900">
	<header class="border-b border-stone-200 bg-white">
		<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
			<div class="flex items-center gap-3">
				<a href="/app" class="text-sm text-stone-400 hover:text-stone-600">Back</a>
				<h1 class="text-lg font-semibold">Pattern references</h1>
			</div>
			{#if clerkContext.currentSession}
				<div
					{@attach (el) => {
						clerkContext.clerk.mountUserButton(el);
					}}
				></div>
			{/if}
		</div>
	</header>

	<main class="mx-auto max-w-3xl px-6 py-8">
		<section class="rounded-lg border border-stone-200 bg-white p-5">
			<h2 class="text-sm font-semibold">Authed Convex query</h2>
			{#if authedDemo.isLoading}
				<p class="mt-3 text-sm text-stone-500">Loading...</p>
			{:else if authedDemo.error}
				<PageError error={authedDemo.error} />
			{:else}
				<pre class="mt-3 rounded bg-stone-100 p-3 text-xs">{JSON.stringify(
						authedDemo.data,
						null,
						2
					)}</pre>
			{/if}
		</section>
	</main>
</div>
