<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import EventForm from '$lib/app/EventForm.svelte';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const client = useConvexClient();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, { includeArchived: false });
	const organization = $derived(savedQuery.data?.organizations[0] ?? null);

	async function save(details: EventDetails) {
		if (organization === null) return;
		await client.mutation(api.authed.events.upsertEvent, {
			organizationId: organization._id,
			...details
		});
		await goto('/app/welcome/extension');
	}
</script>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">Do you have a regular event?</h1>
	<p class="text-sm text-quiet">
		Something you hold every week in the same room. Engage wants the date, time, place, and turnout
		on every request. Save them once and each request fills them in.
	</p>
</div>

{#if organization !== null}
	<EventForm
		submitLabel="Save event"
		cancelLabel="Skip"
		onsubmit={save}
		oncancel={() => goto('/app/welcome/extension')}
	/>
{/if}
