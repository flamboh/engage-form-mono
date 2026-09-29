<script lang="ts">
	import { untrack } from 'svelte';
	import { weekdayName } from '$convex/events';
	import { errorMessage } from '$lib/errors';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import Button from '$lib/ui/Button.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';

	let {
		initial = null,
		submitLabel,
		cancelLabel = 'Cancel',
		autofocus = false,
		onsubmit,
		oncancel
	}: {
		initial?: Partial<EventDetails> | null;
		submitLabel: string;
		cancelLabel?: string;
		autofocus?: boolean;
		onsubmit: (details: EventDetails) => Promise<void> | void;
		oncancel?: () => void;
	} = $props();

	const uid = $props.id();
	const start = untrack(() => initial);
	const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

	let name = $state(start?.name ?? '');
	let weekday = $state<number | null>(start?.weekday ?? null);
	let time = $state(start?.time ?? '');
	let location = $state(start?.location ?? '');
	let attendance = $state<number | null>(start?.attendance ?? null);
	let openToAllStudents = $state(start?.openToAllStudents ?? true);
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const count =
			typeof attendance === 'number' && Number.isFinite(attendance) ? Math.round(attendance) : null;
		if (count !== null && count < 0) {
			error = 'Attendance should be a number of students.';
			return;
		}
		error = '';
		saving = true;
		try {
			await onsubmit({
				name: name.trim(),
				weekday,
				time,
				location: location.trim(),
				attendance: count,
				openToAllStudents
			});
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Event name
		<input
			class="input"
			required
			maxlength="80"
			placeholder="Weekly listening session"
			bind:value={name}
			{@attach (node) => {
				if (autofocus) node.focus();
			}}
		/>
	</label>

	<fieldset class="flex flex-col gap-2">
		<legend class="mb-1.5 text-sm font-medium">Does it repeat every week?</legend>
		<div class="flex flex-wrap gap-1.5">
			{#each days as day, index (day)}
				<label class="day">
					<input
						class="sr-only"
						type="radio"
						name={`weekday-${uid}`}
						checked={weekday === index}
						onchange={() => (weekday = index)}
					/>
					<span>{day}</span>
				</label>
			{/each}
			<label class="day">
				<input
					class="sr-only"
					type="radio"
					name={`weekday-${uid}`}
					checked={weekday === null}
					onchange={() => (weekday = null)}
				/>
				<span>One time</span>
			</label>
		</div>
		<span class="text-xs text-quiet">
			{weekday === null
				? 'We’ll suggest the receipt date for each request.'
				: `We’ll suggest the ${weekdayName(weekday)} after each receipt.`}
		</span>
	</fieldset>

	<div class="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]">
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Start time
			<input class="input" type="time" bind:value={time} />
		</label>
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Building and room
			<input class="input" maxlength="120" placeholder="McKenzie 240A" bind:value={location} />
		</label>
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Students
			<input
				class="input"
				type="number"
				min="0"
				inputmode="numeric"
				placeholder="40"
				bind:value={attendance}
			/>
		</label>
	</div>

	<label class="flex items-center gap-2 text-sm">
		<input class="size-4 accent-pine" type="checkbox" bind:checked={openToAllStudents} />
		Open to all students
	</label>

	{#if error}<InlineError message={error} />{/if}
	<div class="flex items-center gap-4">
		<Button variant="primary" type="submit" busy={saving}>
			{saving ? 'Saving…' : submitLabel}
		</Button>
		{#if oncancel}
			<Button variant="quiet" onclick={oncancel}>{cancelLabel}</Button>
		{/if}
	</div>
</form>

<style>
	.day {
		display: inline-flex;
		min-height: 36px;
		min-width: 3rem;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}

	.day:hover {
		border-color: var(--pine);
	}

	.day:has(:checked) {
		border-color: var(--pine);
		background: var(--pine);
		color: white;
	}

	.day:has(:focus-visible) {
		outline: 2px solid var(--pine);
		outline-offset: 2px;
	}
</style>
