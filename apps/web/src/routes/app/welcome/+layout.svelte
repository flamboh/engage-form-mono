<script lang="ts">
	import { page } from '$app/state';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { STEP_LABELS, WELCOME_STEPS, type WelcomeStep } from '$lib/welcome/steps';

	const { children } = $props();
	const clerkContext = getClerkContext();

	const currentStep = $derived(
		WELCOME_STEPS.find((step) => page.url.pathname === `/app/welcome/${step}`) ?? null
	);
	const currentIndex = $derived(currentStep === null ? -1 : WELCOME_STEPS.indexOf(currentStep));
</script>

<svelte:head>
	<title>Get set up · Engage Form</title>
</svelte:head>

<div class="min-h-screen bg-white text-stone-900">
	<header class="border-b border-stone-200">
		<div class="mx-auto flex h-14 max-w-xl items-center justify-between px-4 sm:px-6">
			<span class="font-semibold tracking-tight text-[#154733]">Engage Form</span>
			<div
				class="h-7 w-7"
				{@attach (el) => {
					clerkContext.clerk.mountUserButton(el);
					return () => clerkContext.clerk.unmountUserButton(el);
				}}
			></div>
		</div>
	</header>

	<main class="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
		{#if currentStep}
			<ol class="grid grid-cols-3 gap-2" aria-label="Setup steps">
				{#each WELCOME_STEPS as step, i (step)}
					<li class="flex flex-col gap-2">
						<span class="h-1 rounded-full {i <= currentIndex ? 'bg-[#154733]' : 'bg-stone-200'}"
						></span>
						<span
							class="text-xs {step === currentStep
								? 'font-medium text-stone-900'
								: 'text-stone-500'}"
							aria-current={step === currentStep ? 'step' : undefined}
						>
							{STEP_LABELS[step]}
						</span>
					</li>
				{/each}
			</ol>
		{/if}
		{@render children()}
	</main>
</div>
