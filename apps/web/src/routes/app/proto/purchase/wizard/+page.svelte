<script lang="ts">
	import ProtoHeader from '$lib/purchase/proto/ProtoHeader.svelte';
	import ProtoSectionBody from '$lib/purchase/proto/ProtoSectionBody.svelte';
	import {
		completedSectionCount,
		createProtoState,
		protoSections,
		sectionComplete,
		type ProtoState
	} from '$lib/purchase/proto/dummyData';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	let form = $state<ProtoState>(createProtoState());
	let stepIndex = $state(0);

	const currentSection = $derived(protoSections[stepIndex]);
	const isFirst = $derived(stepIndex === 0);
	const isLast = $derived(stepIndex === protoSections.length - 1);
	const progress = $derived(completedSectionCount(form));
	const canContinue = $derived(
		sectionComplete(form, currentSection.id) || currentSection.id === 'review'
	);

	function goBack() {
		if (!isFirst) stepIndex -= 1;
	}

	function goNext() {
		if (!isLast && canContinue) stepIndex += 1;
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
		if (e.key === 'ArrowLeft') goBack();
		if (e.key === 'ArrowRight' && canContinue) goNext();
	}}
/>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div {@attach (el) => clerkContext.clerk.mountSignIn(el, {})}></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<ProtoHeader
			title="Step wizard"
			subtitle="Linear flow — only the current step is visible."
			disclosure="High"
		/>

		<main class="mx-auto max-w-2xl px-6 py-8">
			<p class="mb-6 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
				One step at a time with back/continue navigation. Requirement panels only appear in the
				requirements step after categories are chosen. Use arrow keys to navigate when not typing.
			</p>

			<div class="mb-6">
				<div class="flex items-center justify-between text-xs text-stone-500">
					<span>Step {stepIndex + 1} of {protoSections.length}</span>
					<span>{progress} sections complete</span>
				</div>
				<div class="progress-track">
					<div
						class="progress-fill"
						style:width="{((stepIndex + 1) / protoSections.length) * 100}%"
					></div>
				</div>
				<ol class="step-dots">
					{#each protoSections as section, index (section.id)}
						<li>
							<button
								class="dot"
								class:active={index === stepIndex}
								class:done={sectionComplete(form, section.id)}
								type="button"
								title={section.label}
								onclick={() => (stepIndex = index)}
							>
								<span class="sr-only">{section.label}</span>
							</button>
						</li>
					{/each}
				</ol>
			</div>

			<section class="panel">
				<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">
					{currentSection.shortLabel}
				</p>
				<h2 class="mt-1 text-base font-semibold">{currentSection.label}</h2>
				<div class="mt-5">
					<ProtoSectionBody sectionId={currentSection.id} bind:state={form} onChange={() => {}} />
				</div>
			</section>

			<div class="mt-4 flex items-center justify-between gap-3">
				<button class="secondary" type="button" disabled={isFirst} onclick={goBack}>Back</button>
				{#if isLast}
					<button class="button" type="button" disabled={!canContinue}>
						Mark ready for extension
					</button>
				{:else}
					<button class="button" type="button" disabled={!canContinue} onclick={goNext}>
						Continue
					</button>
				{/if}
			</div>

			<details class="panel mt-4">
				<summary class="cursor-pointer text-sm font-medium">Form state</summary>
				<pre class="state-dump">{JSON.stringify(form, null, 2)}</pre>
			</details>
		</main>
	</div>
{/if}

<style>
	.panel {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		background: white;
		padding: 1.25rem;
	}

	.progress-track {
		margin-top: 0.5rem;
		height: 0.25rem;
		border-radius: 9999px;
		background: rgb(231 229 228);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 9999px;
		background: rgb(28 25 23);
		transition: width 200ms;
	}

	.step-dots {
		display: flex;
		justify-content: space-between;
		margin-top: 0.75rem;
	}

	.dot {
		height: 0.5rem;
		width: 0.5rem;
		border-radius: 9999px;
		background: rgb(214 211 209);
	}

	.dot.active {
		background: rgb(28 25 23);
		transform: scale(1.25);
	}

	.dot.done {
		background: rgb(134 179 128);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.55rem 0.9rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.button:hover:not(:disabled) {
		background: rgb(41 37 36);
	}

	.button:disabled {
		opacity: 0.4;
	}

	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.55rem 0.9rem;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.secondary:hover:not(:disabled) {
		background: rgb(250 250 249);
	}

	.secondary:disabled {
		opacity: 0.4;
	}

	.state-dump {
		margin-top: 1rem;
		overflow-x: auto;
		border-radius: 0.375rem;
		background: rgb(250 250 249);
		padding: 1rem;
		font-size: 0.75rem;
		line-height: 1.5;
	}
</style>
