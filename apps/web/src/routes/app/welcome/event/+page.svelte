<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);

	let organizationId = $state<Id<'organizations'> | null>(null);
	const organizations = $derived(savedQuery.data?.organizations ?? []);
	let name = $state('');
	let time = $state('');
	let location = $state('');
	let estimatedAttendance = $state(50);
	let saving = $state(false);
	let error = $state('');

	$effect(() => {
		if (organizations.length > 0 && organizationId === null) organizationId = organizations[0]._id;
	});

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (organizationId === null) return;
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertEventPreset, {
				id: null,
				organizationId,
				name,
				time,
				location,
				estimatedAttendance
			});
			await goto('/app/welcome/extension');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}

	function skip() {
		void goto('/app/welcome/extension');
	}
</script>

<form class="space-y-5" onsubmit={save}>
	<header>
		<h2 class="text-lg font-semibold">Event preset (optional)</h2>
		<p class="mt-1 text-sm text-stone-500">
			Save a recurring event so future requests prefill name, time, and location. Skip if you don't
			have one yet.
		</p>
	</header>

	{#if error}
		<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
	{/if}

	{#if organizations.length > 1}
		<label class="block text-sm">
			<span class="font-medium">Organization</span>
			<select class="field mt-1" bind:value={organizationId}>
				{#each organizations as org (org._id)}
					<option value={org._id}>{org.name}</option>
				{/each}
			</select>
		</label>
	{/if}

	<label class="block text-sm">
		<span class="font-medium">Event name</span>
		<input class="field mt-1" required bind:value={name} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Time</span>
		<input class="field mt-1" required placeholder="e.g. Wednesdays 6:00 PM" bind:value={time} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Location</span>
		<input class="field mt-1" required bind:value={location} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Estimated attendance</span>
		<input class="field mt-1" type="number" min="1" required bind:value={estimatedAttendance} />
	</label>

	<div class="flex items-center gap-3">
		<button class="button" type="submit" disabled={saving}>
			{saving ? 'Saving...' : 'Save and continue'}
		</button>
		<button class="secondary" type="button" onclick={skip}>Skip for now</button>
	</div>
</form>

<style>
	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
	.button:disabled {
		opacity: 0.6;
	}
	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}
</style>
