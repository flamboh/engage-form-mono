<script lang="ts">
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import {
		formatEventDates,
		formatEventTime,
		suggestEventDates,
		weekdayName,
		weekdayOf
	} from '$convex/events';
	import EventForm from '$lib/app/EventForm.svelte';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import Chip from '$lib/ui/Chip.svelte';
	import EditableValue from './EditableValue.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { dateInputValue } from './labels';
	import SourceCue from '$lib/ui/SourceCue.svelte';

	let { editor, events }: { editor: RequestEditor; events: Doc<'events'>[] } = $props();

	let creating = $state(false);
	let addingDate = $state(false);
	let typedDate = $state(false);
	let draftDate = $state('');
	let autoDate = $state<string | null>(null);
	let savingBack = $state(false);
	let editing = $state({ time: false, location: false, attendance: false });

	const activity = $derived(editor.form?.activity);
	const chosen = $derived(events.find((event) => event._id === activity?.eventId) ?? null);
	const unsavedName = $derived(
		chosen === null && activity !== undefined && activity.name.trim() !== '' ? activity.name : null
	);
	const dates = $derived(activity?.dates ?? []);
	const suggestion = $derived(
		suggestEventDates({ weekday: chosen?.weekday ?? null }, editor.receiptDate || null)
	);
	const suggestedDates = $derived(suggestion.dates.filter((date) => !dates.includes(date)));
	const autoApplied = $derived(autoDate !== null && dates.length === 1 && dates[0] === autoDate);
	const offDays = $derived(
		chosen === null || chosen.weekday === null
			? []
			: dates.filter((date) => weekdayOf(date) !== chosen.weekday)
	);
	const changed = $derived(
		chosen === null || activity === undefined
			? []
			: (['time', 'location', 'attendance', 'openToAllStudents'] as const).filter(
					(key) => activity[key] !== chosen[key]
				)
	);
	const source = $derived(editor.sourceOf('activity'));

	function shortDate(value: string) {
		const weekday = weekdayOf(value);
		if (weekday === null) return value;
		return `${weekdayName(weekday).slice(0, 3)} ${value.slice(5, 7)}/${value.slice(8, 10)}`;
	}

	function choose(event: EventDetails & { _id: Id<'events'> }) {
		if (dates.length > 0 && !autoApplied) {
			editor.chooseEvent(event);
			return;
		}
		const suggested =
			event.weekday === null
				? null
				: suggestEventDates({ weekday: event.weekday }, editor.receiptDate || null).suggested;
		autoDate = suggested;
		editor.chooseEvent(event, suggested === null ? [] : [suggested]);
	}

	async function create(details: EventDetails) {
		const id = await editor.saveEvent(details);
		choose({ _id: id, ...details });
		creating = false;
	}

	async function saveBack() {
		if (chosen === null || activity === undefined) return;
		const name = chosen.name;
		savingBack = true;
		editor.error = '';
		await editor
			.saveEvent({
				id: chosen._id,
				name: chosen.name,
				weekday: chosen.weekday,
				time: activity.time,
				location: activity.location,
				attendance: activity.attendance,
				openToAllStudents: activity.openToAllStudents
			})
			.catch(() => (editor.error = `Couldn’t update ${name}. Try again.`))
			.finally(() => (savingBack = false));
	}

	function commitAttendance(value: string) {
		const count = Math.round(Number(value.replace(/[^\d.]/g, '')));
		editor.updateActivity({ attendance: value.trim() === '' || !count ? null : count });
	}

	function toggleDate(date: string) {
		autoDate = null;
		editor.toggleDate(date);
	}

	function openDateInput() {
		draftDate = dateInputValue(suggestion.suggested);
		typedDate = false;
		addingDate = true;
	}

	function closeDateInput() {
		addingDate = false;
		typedDate = false;
	}

	function addDate(value: string) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
		if (!dates.includes(value)) toggleDate(value);
		closeDateInput();
	}

	function dateKey(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key === 'Enter') {
			event.preventDefault();
			addDate(event.currentTarget.value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			closeDateInput();
		} else if (event.key !== 'Tab' && event.key !== 'Shift') {
			typedDate = true;
		}
	}

	function dateBlur(value: string) {
		if (!addingDate) return;
		if (typedDate) addDate(value);
		closeDateInput();
	}
</script>

<div class="flex flex-col gap-5">
	<fieldset id="field-event" class="flex flex-col gap-3">
		<legend class="mb-3 flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
			Which event? {#if source === 'previous' && activity?.eventId}<SourceCue {source} />{/if}
		</legend>
		<div class="flex flex-wrap gap-2">
			{#each events as event (event._id)}
				<Chip selected={event._id === activity?.eventId} onclick={() => choose(event)}>
					{event.name}
				</Chip>
			{/each}
			{#if unsavedName}
				<Chip selected onclick={() => {}}>{unsavedName}</Chip>
			{/if}
			<button
				class="new inline-flex min-h-9 items-center border border-dashed px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
				type="button"
				aria-expanded={creating}
				onclick={() => (creating = !creating)}
			>
				{creating ? 'Close' : '+ New event'}
			</button>
		</div>
		{#if events.length === 0 && !creating && unsavedName === null}
			<p class="text-sm text-(--quiet)">
				Add the event once with its usual time, room, and turnout. Next time it’s one tap.
			</p>
		{/if}
		{#if creating}
			<div class="border border-(--line) bg-white p-4">
				<EventForm
					autofocus
					submitLabel="Save and use"
					initial={activity?.eventId === null ? activity : null}
					onsubmit={create}
					oncancel={() => (creating = false)}
				/>
			</div>
		{/if}
	</fieldset>

	{#if activity !== undefined && (activity.eventId !== null || activity.name.trim() !== '')}
		<div class="facts flex flex-col gap-4 border-l-2 border-(--pine) pl-4">
			<div id="field-dates" class="flex flex-col gap-2">
				<span class="text-sm font-medium text-(--ink)">
					{dates.length > 1 ? 'Dates' : 'Date'}
					{#if dates.length > 0}
						<span class="font-normal text-(--quiet)">· {formatEventDates(dates)}</span>
					{/if}
					{#if autoApplied}<SourceCue source="suggested" />{/if}
				</span>
				<div class="flex flex-wrap items-center gap-2">
					{#each dates as date (date)}
						<Chip selected onclick={() => toggleDate(date)}>
							{shortDate(date)}
							<span class="sr-only">, selected. Remove</span>
							<span aria-hidden="true" class="opacity-70">×</span>
						</Chip>
					{/each}
					{#each suggestedDates as date (date)}
						<Chip onclick={() => toggleDate(date)}>
							{shortDate(date)}
							{#if date === suggestion.suggested && dates.length === 0}
								<span class="text-xs text-(--quiet)">suggested</span>
							{/if}
						</Chip>
					{/each}
					{#if addingDate}
						<input
							class="input max-w-44"
							type="date"
							aria-label="Add a date"
							bind:value={draftDate}
							onchange={(event) => {
								if (!typedDate) addDate(event.currentTarget.value);
							}}
							onkeydown={dateKey}
							onblur={(event) => dateBlur(event.currentTarget.value)}
							{@attach (node) => node.focus()}
						/>
						{#if typedDate}
							<button
								class="min-h-9 border border-(--pine) px-3 text-sm font-medium text-(--pine) disabled:opacity-50"
								type="button"
								disabled={!/^\d{4}-\d{2}-\d{2}$/.test(draftDate)}
								onpointerdown={(event) => event.preventDefault()}
								onclick={() => addDate(draftDate)}
							>
								Add
							</button>
						{/if}
					{:else}
						<button
							class="px-2 text-sm text-(--quiet) underline hover:text-(--ink)"
							type="button"
							onclick={openDateInput}
						>
							{dates.length === 0 && suggestedDates.length === 0 ? 'Pick a date' : 'Another date'}
						</button>
					{/if}
				</div>
				{#if dates.length === 0 && suggestedDates.length === 0}
					<p class="text-xs text-(--quiet)">
						Add the receipt and we’ll suggest the date. Used across several meetings? Add each one.
					</p>
				{:else if offDays.length > 0 && chosen?.weekday != null}
					<p class="text-xs text-(--quiet)">
						{offDays.map(shortDate).join(', ')}
						{offDays.length === 1
							? `isn’t a ${weekdayName(chosen.weekday)}`
							: `aren’t ${weekdayName(chosen.weekday)}s`}. That’s fine if the event moved that week.
					</p>
				{/if}
			</div>

			<p class="sentence text-base leading-loose text-(--ink)">
				<span id="field-time" class="fact">
					<EditableValue
						hint={false}
						label="Start time"
						placeholder="Add time"
						type="time"
						value={activity.time}
						display={formatEventTime(activity.time)}
						bind:editing={editing.time}
						oncommit={(value) => editor.updateActivity({ time: value })}
					/>
				</span>
				<span class="text-(--quiet)">in</span>
				<span id="field-location" class="fact">
					<EditableValue
						hint={false}
						label="Location"
						placeholder="Add building and room"
						value={activity.location}
						bind:editing={editing.location}
						oncommit={(value) => editor.updateActivity({ location: value })}
					/>
				</span>
				<span class="text-(--quiet)">with about</span>
				<span id="field-attendance" class="fact">
					<EditableValue
						hint={false}
						label="Students attending"
						placeholder="how many"
						type="number"
						value={activity.attendance === null ? '' : String(activity.attendance)}
						bind:editing={editing.attendance}
						oncommit={commitAttendance}
					/>
				</span>
				<span class="text-(--quiet)">students</span>
			</p>

			<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
				<label class="flex items-center gap-2 text-(--ink)">
					<input
						class="size-4 accent-(--pine)"
						type="checkbox"
						checked={activity.openToAllStudents}
						onchange={(event) =>
							editor.updateActivity({ openToAllStudents: event.currentTarget.checked })}
					/>
					Open to all students
				</label>
				{#if chosen !== null}
					<span class="text-xs text-(--quiet)">
						{#if changed.length === 0}
							From {chosen.name}
						{:else}
							Changed for this request.
							<button
								class="text-(--pine) underline disabled:opacity-60"
								type="button"
								disabled={savingBack}
								onclick={saveBack}>Save to {chosen.name}</button
							>
						{/if}
					</span>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.fact {
		display: inline-block;
		margin: 0 0.125rem;
		font-weight: 500;
		white-space: nowrap;
	}

	.fact :global(button) {
		border-bottom: 1px dashed var(--quiet);
	}

	.new {
		border-color: var(--quiet);
		color: var(--ink);
		background: transparent;
	}

	.new:hover {
		border-color: var(--pine);
		color: var(--pine);
	}
</style>
