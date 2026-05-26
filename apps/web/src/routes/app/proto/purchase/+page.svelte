<script lang="ts">
	import ProtoHeader from '$lib/purchase/proto/ProtoHeader.svelte';
	import ProtoSectionBody from '$lib/purchase/proto/ProtoSectionBody.svelte';
	import { createProtoState, protoSections, type ProtoState } from '$lib/purchase/proto/dummyData';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();
	let form = $state<ProtoState>(createProtoState());

	const prototypes = [
		{
			href: '/app/proto/purchase/flat',
			title: 'Flat form',
			disclosure: 'None — everything visible',
			description:
				'All sections expanded on a single scrollable page. Closest to the current builder; good when users need full context upfront.'
		},
		{
			href: '/app/proto/purchase/sections',
			title: 'Section navigator',
			disclosure: 'Medium — outline visible, one section focused',
			description:
				'Sidebar shows the full checklist with completion status. Main area focuses one section at a time; jump freely between sections.'
		},
		{
			href: '/app/proto/purchase/wizard',
			title: 'Step wizard',
			disclosure: 'High — one step at a time',
			description:
				'Linear flow with back/continue navigation. Only the current step is shown; requirements appear when relevant categories are selected earlier.'
		}
	];
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div {@attach (el) => clerkContext.clerk.mountSignIn(el, {})}></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<ProtoHeader
			title="Purchase flow prototypes"
			subtitle="Three approaches to progressive disclosure for the new purchase request builder."
			disclosure="Compare variants"
		/>

		<main class="mx-auto max-w-5xl space-y-8 px-6 py-8">
			<section class="panel">
				<h2 class="text-sm font-semibold">Choose a prototype</h2>
				<div class="mt-4 grid gap-4 md:grid-cols-3">
					{#each prototypes as proto (proto.href)}
						<a class="proto-card" href={proto.href}>
							<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">
								{proto.disclosure}
							</p>
							<h3 class="mt-1 text-base font-semibold">{proto.title}</h3>
							<p class="mt-2 text-sm text-stone-600">{proto.description}</p>
						</a>
					{/each}
				</div>
			</section>

			<section class="panel">
				<h2 class="text-sm font-semibold">Live state preview</h2>
				<p class="mt-1 text-sm text-stone-500">
					Shared dummy data used across all prototypes. Edit below to see state propagate.
				</p>
				<pre class="state-dump">{JSON.stringify(form, null, 2)}</pre>
				<details class="mt-4">
					<summary class="cursor-pointer text-sm font-medium">Edit dummy state</summary>
					<div class="mt-4 space-y-4">
						{#each protoSections.slice(0, -1) as section (section.id)}
							<div class="edit-section">
								<h3>{section.label}</h3>
								<ProtoSectionBody sectionId={section.id} bind:state={form} onChange={() => {}} />
							</div>
						{/each}
					</div>
				</details>
			</section>
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

	.proto-card {
		display: block;
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		padding: 1rem;
		transition: border-color 120ms;
	}

	.proto-card:hover {
		border-color: rgb(168 162 158);
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

	.edit-section {
		border-top: 1px solid rgb(245 245 244);
		padding-top: 1rem;
	}

	.edit-section h3 {
		margin-bottom: 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
	}
</style>
