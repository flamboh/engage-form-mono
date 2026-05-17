<script lang="ts">
	import { page } from '$app/state';
	import { STEP_LABELS, WELCOME_STEPS, type WelcomeStep } from '$lib/welcome/steps';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const { children } = $props();
	const clerkContext = getClerkContext();

	const currentStep = $derived<WelcomeStep | null>(
		(() => {
			const match = page.url.pathname.match(/^\/app\/welcome\/([^/]+)$/);
			const value = match?.[1];
			return WELCOME_STEPS.includes(value as WelcomeStep) ? (value as WelcomeStep) : null;
		})()
	);
	const currentIndex = $derived(currentStep === null ? -1 : WELCOME_STEPS.indexOf(currentStep));
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
				<div>
					<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">Engage Form</p>
					<h1 class="text-lg font-semibold">Welcome</h1>
				</div>
				<div
					{@attach (el) => {
						clerkContext.clerk.mountUserButton(el);
					}}
				></div>
			</div>
		</header>

		<main class="mx-auto grid max-w-4xl gap-6 px-6 py-8 lg:grid-cols-[220px_1fr]">
			<nav class="space-y-1 text-sm">
				{#each WELCOME_STEPS as step, i (step)}
					<div
						class="flex items-center gap-2 rounded-md px-3 py-2"
						class:bg-stone-100={step === currentStep}
						class:text-stone-400={i > currentIndex && step !== currentStep}
					>
						<span
							class="flex h-5 w-5 items-center justify-center rounded-full bg-stone-200 text-xs font-medium"
						>
							{i + 1}
						</span>
						<span>{STEP_LABELS[step]}</span>
					</div>
				{/each}
			</nav>

			<section>
				{@render children()}
			</section>
		</main>
	</div>
{/if}
