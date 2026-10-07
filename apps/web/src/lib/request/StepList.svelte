<script lang="ts">
	import type { StepId } from '$convex/requestView';
	import type { Snippet } from 'svelte';
	import Button from '$lib/ui/Button.svelte';
	import type { Step } from './steps';

	let {
		steps,
		body
	}: {
		steps: Step[];
		body: Snippet<[Step]>;
	} = $props();

	const pinnable = new Set<StepId>([
		'receipt',
		'categories',
		'event',
		'purchaser',
		'recipients',
		'officeLocation'
	]);

	let pinned = $state<StepId | null>(null);

	const current = $derived(steps.find((step) => step.state === 'current') ?? null);
	const openId = $derived(
		pinned !== null && steps.some((step) => step.id === pinned) ? pinned : (current?.id ?? null)
	);

	function edit(id: StepId) {
		pinned = openId === id ? null : id;
	}

	function pin(step: Step, event: Event) {
		if (!pinnable.has(step.id)) return;
		if (event.target instanceof Element && event.target.closest('[data-advance]') !== null) return;
		pinned = step.id;
	}
</script>

<div class="flex flex-col">
	<ol class="mb-5 flex gap-1" aria-hidden="true">
		{#each steps as step (step.id)}
			<li
				class={[
					'h-1 flex-1',
					step.state === 'done'
						? 'bg-(--pine)'
						: step.state === 'current'
							? 'bg-(--marker-deep)'
							: 'bg-(--line)'
				]}
			></li>
		{/each}
	</ol>

	<ol class="flex flex-col border-t border-(--ink)" aria-label="Steps">
		{#each steps as step (step.id)}
			{@const open = step.id === openId}
			<li
				id={`step-${step.id}`}
				class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 border-b border-(--line) py-4"
				aria-current={step.state === 'current' ? 'step' : undefined}
			>
				<span
					class={[
						'mt-0.5 grid size-[1.125rem] place-items-center border',
						step.state === 'done' && 'border-(--pine) bg-(--pine) text-white',
						step.state === 'current' && 'border-(--ink) bg-(--marker)',
						step.state === 'check' && 'border-(--marker-deep) bg-(--marker-soft)',
						step.state === 'todo' && 'border-(--quiet) bg-(--surface)'
					]}
				>
					{#if step.state === 'done'}
						<svg viewBox="0 0 12 12" class="size-3" aria-hidden="true">
							<path d="M2.5 6.2 5 8.6l4.5-5" fill="none" stroke="currentColor" stroke-width="1.8" />
						</svg>
					{/if}
					<span class="sr-only">
						{step.state === 'done'
							? 'Done'
							: step.state === 'current'
								? 'Next'
								: step.state === 'check'
									? 'Needs a quick check'
									: 'Later'}
					</span>
				</span>
				<div class="flex min-w-0 flex-col gap-1">
					<div class="flex items-baseline justify-between gap-4">
						<h3
							class={[
								'text-base font-semibold',
								step.state === 'todo' && !open ? 'text-(--quiet)' : 'text-(--ink)'
							]}
						>
							{step.title}
						</h3>
						{#if step.state !== 'current' && step.id !== 'review'}
							<button
								class="shrink-0 text-sm text-(--quiet) underline underline-offset-3 hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
								type="button"
								aria-expanded={open}
								aria-controls={`step-body-${step.id}`}
								onclick={() => edit(step.id)}
							>
								{open ? 'Close' : step.state === 'done' ? 'Edit' : 'Open'}
							</button>
						{/if}
					</div>
					{#if !open || (step.state !== 'current' && step.id !== 'review')}
						<p class="text-sm text-(--quiet)">{step.summary}</p>
					{/if}
					{#if open}
						<div
							id={`step-body-${step.id}`}
							role="group"
							aria-label={step.title}
							class="mt-3 flex flex-col gap-4"
							onfocusin={(event) => pin(step, event)}
							onpointerdown={(event) => pin(step, event)}
						>
							{@render body(step)}
							{#if pinned === step.id && step.state === 'done'}
								<div>
									<Button variant="secondary" size="sm" onclick={() => (pinned = null)}>
										{current === null || current.id === step.id ? 'Done' : 'Continue'}
									</Button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</li>
		{/each}
	</ol>
</div>
