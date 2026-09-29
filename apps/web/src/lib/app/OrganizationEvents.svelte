<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { formatEventTime } from '$convex/events';
	import EventForm from '$lib/app/EventForm.svelte';
	import { errorMessage } from '$lib/errors';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	let { organization }: { organization: Doc<'organizations'> } = $props();

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

	function cadence(event: Doc<'events'>) {
		return event.weekday === null ? 'One time' : 'Weekly';
	}

	function summary(event: Doc<'events'>) {
		const days = [
			'Sundays',
			'Mondays',
			'Tuesdays',
			'Wednesdays',
			'Thursdays',
			'Fridays',
			'Saturdays'
		];
		return [
			event.name,
			event.weekday === null
				? ''
				: `${days[event.weekday]}${event.time ? ` ${formatEventTime(event.time)}` : ''}`,
			event.location,
			event.attendance === null ? '' : `about ${event.attendance}`
		]
			.filter((part) => part !== '')
			.join(', ');
	}
</script>

<div class="flex flex-col">
	<SectionHeader title="Events" level={3}>
		{#snippet action()}
			<Button variant="quiet" size="sm" onclick={() => toggle('new')}>Add event</Button>
		{/snippet}
	</SectionHeader>
	{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}
	{#if editing === 'new'}
		<div class="border-b border-line py-5">
			<EventForm
				submitLabel="Add event"
				autofocus
				onsubmit={(details) => save(details)}
				oncancel={() => (editing = null)}
			/>
		</div>
	{/if}
	<dl>
		{#each events as event (event._id)}
			{#if editing === event._id}
				<div class="border-b border-line py-5">
					<EventForm
						initial={event}
						submitLabel="Save"
						onsubmit={(details) => save(details, event._id)}
						oncancel={() => (editing = null)}
					/>
					<div class="pt-4">
						<Button variant="quiet" size="sm" onclick={() => archive(event._id)}>
							Archive this event
						</Button>
					</div>
				</div>
			{:else}
				<FieldRow
					label={cadence(event)}
					value={summary(event)}
					onaction={() => toggle(event._id)}
				/>
			{/if}
		{:else}
			{#if editing !== 'new' && eventsQuery.data !== undefined}
				<EmptyState
					title="No events yet."
					body="Add one you hold often and requests fill in its time, room, and turnout."
				/>
			{/if}
		{/each}
	</dl>
</div>
