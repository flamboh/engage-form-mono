<script lang="ts">
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
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
			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<h2 class="text-sm font-semibold">Use the extension</h2>
				<ol class="mt-4 space-y-3 text-sm text-stone-700">
					<li>
						<span class="font-medium text-stone-950">1. Install the extension.</span>
						<p class="mt-1 text-stone-500">
							Ask your team lead for the install link. Local builds can be loaded from the extension
							build folder.
						</p>
					</li>
					<li>
						<span class="font-medium text-stone-950">2. Sign in from the extension popup.</span>
						<p class="mt-1 text-stone-500">
							Choose Sign in on web for OAuth. The extension will use the synced Clerk session after
							browser sign-in completes.
						</p>
					</li>
					<li>
						<span class="font-medium text-stone-950"
							>3. Open Engage and choose a ready request.</span
						>
						<p class="mt-1 text-stone-500">
							The extension fetches the latest ready facts from Convex when each fill step runs.
						</p>
					</li>
				</ol>
			</section>
		</main>
	</div>
{/if}
