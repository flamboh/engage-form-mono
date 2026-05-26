<script lang="ts">
	import ProtoHeader from '$lib/purchase/proto/ProtoHeader.svelte';
	import ProtoSectionBody from '$lib/purchase/proto/ProtoSectionBody.svelte';
	import { createProtoState, protoSections, type ProtoState } from '$lib/purchase/proto/dummyData';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	let form = $state<ProtoState>(createProtoState());
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div {@attach (el) => clerkContext.clerk.mountSignIn(el, {})}></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<ProtoHeader
			title="Flat form"
			subtitle="All sections visible at once — no progressive disclosure."
			disclosure="None"
		/>

		<main class="mx-auto max-w-4xl space-y-5 px-6 py-8">
			<p class="rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
				Every section is expanded simultaneously. Users see the full scope of the form immediately,
				including requirement panels that depend on their category selections.
			</p>

			{#each protoSections as section (section.id)}
				<section class="panel">
					<h2>{section.label}</h2>
					<div class="mt-4">
						<ProtoSectionBody sectionId={section.id} bind:state={form} onChange={() => {}} />
					</div>
					{#if section.id === 'review'}
						<button class="button mt-4" type="button">Mark ready for extension</button>
					{/if}
				</section>
			{/each}

			<details class="panel">
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

	.panel h2 {
		font-size: 0.875rem;
		font-weight: 600;
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
