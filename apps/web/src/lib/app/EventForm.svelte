<script lang="ts">
	import { untrack } from 'svelte';
	import { weekdayName } from '$convex/events';
	import type { EventDetails } from '$lib/purchase/draftDetails';
	import { errorMessage, inputClass, labelClass, primaryButtonClass } from '$lib/app/styles';

	let {
		initial = null,
		submitLabel,
		cancelLabel = 'Cancel',
		tone = 'app',
		autofocus = false,
		onsubmit,
		oncancel
	}: {
		initial?: Partial<EventDetails> | null;
		submitLabel: string;
		cancelLabel?: string;
		tone?: 'app' | 'request';
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

	const field = $derived(tone === 'request' ? 'input' : inputClass);
	const label = $derived(
		tone === 'request' ? 'flex flex-col gap-1.5 text-sm font-medium text-(--ink)' : labelClass
	);

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

<form
	class="event-form flex flex-col gap-4"
	class:tone-request={tone === 'request'}
	onsubmit={save}
>
	<label class={label}>
		Event name
		<input
			class={field}
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
		<span class="text-xs text-(--quiet,#78716c)">
			{weekday === null
				? 'We’ll suggest the receipt date for each request.'
				: `We’ll suggest the ${weekdayName(weekday)} after each receipt.`}
		</span>
	</fieldset>

	<div class="grid gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_8rem]">
		<label class={label}>
			Start time
			<input class={field} type="time" bind:value={time} />
		</label>
		<label class={label}>
			Building and room
			<input class={field} maxlength="120" placeholder="McKenzie 240A" bind:value={location} />
		</label>
		<label class={label}>
			Students
			<input
				class={field}
				type="number"
				min="0"
				inputmode="numeric"
				placeholder="40"
				bind:value={attendance}
			/>
		</label>
	</div>

	<label class="flex items-center gap-2 text-sm">
		<input class="size-4 accent-[#154733]" type="checkbox" bind:checked={openToAllStudents} />
		Open to all students
	</label>

	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<div class="flex items-center gap-3">
		<button
			class={tone === 'request' ? 'submit-request' : primaryButtonClass}
			type="submit"
			disabled={saving}
		>
			{saving ? 'Saving…' : submitLabel}
		</button>
		{#if oncancel}
			<button class="text-sm text-stone-600 hover:text-stone-900" type="button" onclick={oncancel}>
				{cancelLabel}
			</button>
		{/if}
	</div>
</form>

<style>
	.day {
		display: inline-flex;
		min-height: 2.25rem;
		min-width: 3rem;
		cursor: pointer;
		align-items: center;
		justify-content: center;
		border: 1px solid #d6d3d1;
		border-radius: 9999px;
		background: white;
		padding: 0 0.75rem;
		font-size: 0.875rem;
	}

	.tone-request .day {
		border-color: var(--line);
		border-radius: 0;
	}

	.day:hover {
		border-color: #154733;
	}

	.day:has(:checked) {
		border-color: #154733;
		background: #154733;
		color: white;
	}

	.day:has(:focus-visible) {
		outline: 2px solid #154733;
		outline-offset: 2px;
	}

	.submit-request {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		background: var(--pine);
		padding: 0 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.submit-request:hover {
		background: var(--pine-deep);
	}

	.submit-request:disabled {
		opacity: 0.6;
	}
</style>
