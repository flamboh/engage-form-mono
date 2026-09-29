<script lang="ts">
	import { page } from '$app/state';
	import AccountMenu from '$lib/app/AccountMenu.svelte';
	import { STEP_LABELS, WELCOME_STEPS } from '$lib/welcome/steps';

	const { children } = $props();

	const currentStep = $derived(
		WELCOME_STEPS.find((step) => page.url.pathname === `/app/welcome/${step}`) ?? null
	);
	const currentIndex = $derived(currentStep === null ? -1 : WELCOME_STEPS.indexOf(currentStep));
</script>

<svelte:head>
	<title>Get set up · Engage Form</title>
</svelte:head>

<div class="min-h-screen bg-surface text-ink">
	<header class="border-b border-line">
		<div class="mx-auto flex h-14 max-w-xl items-center justify-between px-4 sm:px-6">
			<span class="font-[650] tracking-tight text-pine">Engage Form</span>
			<AccountMenu />
		</div>
	</header>

	<main class="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-8 pb-16 sm:px-6">
		{#if currentStep}
			<ol class="grid grid-cols-4 gap-2" aria-label="Setup steps">
				{#each WELCOME_STEPS as step, i (step)}
					<li class="flex flex-col gap-2">
						<span
							class="h-1 {i < currentIndex
								? 'bg-pine'
								: i === currentIndex
									? 'bg-marker-deep'
									: 'bg-line'}"
						></span>
						<span
							class="text-xs {step === currentStep ? 'font-medium text-ink' : 'text-quiet'}"
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
