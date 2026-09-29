<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { formatEventTime, weekdayName } from '$convex/events';
	import EventForm from '$lib/app/EventForm.svelte';
	import { errorMessage, secondaryButtonClass } from '$lib/app/styles';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import { useConvexClient, useQuery } from 'convex-svelte';

	let { organization, showName }: { organization: Doc<'organizations'>; showName: boolean } =
		$props();

	const client = useConvexClient();
	const eventsQuery = useQuery(api.authed.events.listEvents, () => ({
		organizationId: organization._id
	}));
	const events = $derived(eventsQuery.data ?? []);

	let editing = $state<Id<'events'> | 'new' | null>(null);
	let error = $state('');

	function toggle(key: Id<'events'> | 'new') {
		editing = editing === key ? null : key;
		error = '';
	}

	async function save(details: EventDetails, id?: Id<'events'>) {
		await client.mutation(api.authed.events.upsertEvent, {
			id,
			organizationId: organization._id,
			...details
		});
		editing = null;
	}

	async function archive(id: Id<'events'>) {
		error = '';
		try {
			await client.mutation(api.authed.events.archiveEvent, { id });
			if (editing === id) editing = null;
		} catch (err) {
			error = errorMessage(err);
		}
	}

	function summary(event: Doc<'events'>) {
		const when = event.weekday === null ? 'One time' : `${weekdayName(event.weekday)}s`;
		const time = event.time ? ` at ${formatEventTime(event.time)}` : '';
		const where = event.location ? `, ${event.location}` : '';
		const count = event.attendance === null ? '' : `, about ${event.attendance} students`;
		return `${when}${time}${where}${count}`;
	}
</script>

<div class="flex flex-col gap-2">
	<div class="flex items-center justify-between gap-4">
		{#if showName}
			<h3 class="text-sm font-medium text-stone-700">{organization.name}</h3>
		{:else}
			<span></span>
		{/if}
		<button class={secondaryButtonClass} type="button" onclick={() => toggle('new')}>
			Add event
		</button>
	</div>
	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<ul class="divide-y divide-stone-200 border-y border-stone-200">
		{#if editing === 'new'}
			<li class="py-5">
				<EventForm
					submitLabel="Add event"
					autofocus
					onsubmit={(details) => save(details)}
					oncancel={() => (editing = null)}
				/>
			</li>
		{/if}
		{#each events as event (event._id)}
			<li class="py-4">
				<div class="flex items-center justify-between gap-4">
					<div class="min-w-0">
						<p class="truncate font-medium">{event.name}</p>
						<p class="truncate text-sm text-stone-500">{summary(event)}</p>
					</div>
					<div class="flex shrink-0 items-center gap-1">
						<button
							class="rounded-full px-3 py-1.5 text-sm font-medium text-[#154733] hover:bg-[#154733]/10"
							type="button"
							aria-expanded={editing === event._id}
							onclick={() => toggle(event._id)}
						>
							{editing === event._id ? 'Close' : 'Edit'}
						</button>
						<button
							class="rounded-full px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900"
							type="button"
							onclick={() => archive(event._id)}
						>
							Archive
						</button>
					</div>
				</div>
				{#if editing === event._id}
					<div class="pt-5">
						<EventForm
							initial={event}
							submitLabel="Save"
							onsubmit={(details) => save(details, event._id)}
							oncancel={() => (editing = null)}
						/>
					</div>
				{/if}
			</li>
		{:else}
			{#if editing !== 'new' && eventsQuery.data !== undefined}
				<li class="py-4 text-sm text-stone-500">
					Add a meeting or event you hold often. Requests fill in its time, room, and turnout.
				</li>
			{/if}
		{/each}
	</ul>
</div>
