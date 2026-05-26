<script lang="ts">
	import ProtoHeader from '$lib/purchase/proto/ProtoHeader.svelte';
	import ProtoSectionBody from '$lib/purchase/proto/ProtoSectionBody.svelte';
	import {
		completedSectionCount,
		createProtoState,
		protoSections,
		sectionComplete,
		type ProtoSectionId,
		type ProtoState
	} from '$lib/purchase/proto/dummyData';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	let form = $state<ProtoState>(createProtoState());
	let activeSection = $state<ProtoSectionId>('setup');

	const progress = $derived(completedSectionCount(form));
	const activeMeta = $derived(protoSections.find((s) => s.id === activeSection)!);
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div {@attach (el) => clerkContext.clerk.mountSignIn(el, {})}></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<ProtoHeader
			title="Section navigator"
			subtitle="Checklist sidebar with one focused section in the main panel."
			disclosure="Medium"
		/>

		<main class="mx-auto grid max-w-5xl gap-6 px-6 py-8 lg:grid-cols-[240px_minmax(0,1fr)]">
			<aside class="panel self-start lg:sticky lg:top-28">
				<div class="flex items-center justify-between">
					<h2 class="text-sm font-semibold">Sections</h2>
					<span class="text-xs text-stone-500">{progress}/{protoSections.length}</span>
				</div>
				<ol class="mt-4 space-y-1">
					{#each protoSections as section, index (section.id)}
						<li>
							<button
								class="nav-item"
								class:active={activeSection === section.id}
								type="button"
								onclick={() => (activeSection = section.id)}
							>
								<span class="nav-index">{index + 1}</span>
								<span class="nav-label">
									<span>{section.shortLabel}</span>
									{#if sectionComplete(form, section.id)}
										<span class="complete">Done</span>
									{/if}
								</span>
							</button>
						</li>
					{/each}
				</ol>
			</aside>

			<div class="space-y-4">
				<p class="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
					The sidebar reveals the full form structure upfront, but only one section's fields are
					shown at a time. Users can jump to any section without a prescribed order.
				</p>

				<section class="panel">
					<h2>{activeMeta.label}</h2>
					<div class="mt-4">
						<ProtoSectionBody sectionId={activeSection} bind:state={form} onChange={() => {}} />
					</div>
					{#if activeSection === 'review'}
						<button class="button mt-4" type="button">Mark ready for extension</button>
					{/if}
				</section>

				<details class="panel">
					<summary class="cursor-pointer text-sm font-medium">Form state</summary>
					<pre class="state-dump">{JSON.stringify(form, null, 2)}</pre>
				</details>
			</div>
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

	.panel h2 {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.nav-item {
		display: flex;
		width: 100%;
		align-items: center;
		gap: 0.6rem;
		border-radius: 0.375rem;
		padding: 0.45rem 0.5rem;
		text-align: left;
		font-size: 0.8125rem;
	}

	.nav-item:hover {
		background: rgb(250 250 249);
	}

	.nav-item.active {
		background: rgb(245 245 244);
		font-weight: 600;
	}

	.nav-index {
		display: grid;
		height: 1.35rem;
		width: 1.35rem;
		place-items: center;
		border-radius: 9999px;
		background: rgb(245 245 244);
		font-size: 0.6875rem;
		font-weight: 600;
		color: rgb(120 113 108);
	}

	.nav-item.active .nav-index {
		background: rgb(28 25 23);
		color: white;
	}

	.nav-label {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.complete {
		font-size: 0.6875rem;
		font-weight: 500;
		color: rgb(22 101 52);
	}

	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.55rem 0.9rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.button:hover {
		background: rgb(41 37 36);
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
