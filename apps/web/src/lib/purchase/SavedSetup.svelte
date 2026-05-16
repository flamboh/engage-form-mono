<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { convexMutation, type ClerkSession } from '$lib/convex-http';
	import FilePicker from '$lib/purchase/FilePicker.svelte';

	type SavedData = {
		organizations: Array<{ _id: Id<'organizations'>; name: string; defaultBudgetLineItem: string }>;
		people: Array<{ _id: Id<'people'>; organizationId: Id<'organizations'>; name: string; isRequester: boolean }>;
		eventPresets: Array<{ _id: Id<'eventPresets'>; organizationId: Id<'organizations'>; name: string }>;
	};

	type Props = {
		session: ClerkSession;
		savedData?: SavedData;
		organizationId: Id<'organizations'> | null;
		purchaserPersonId: Id<'people'> | null;
		eventPresetId: Id<'eventPresets'> | null;
		onChange: () => void;
		onSavedChange: () => Promise<void>;
	};

	let {
		session,
		savedData,
		organizationId = $bindable(),
		purchaserPersonId = $bindable(),
		eventPresetId = $bindable(),
		onChange,
		onSavedChange
	}: Props = $props();

	const defaultTemplate =
		'{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given as a gift to {recipient} ({recipientUo95}) for {recipientReason} during {eventName} which took place on {eventDate} at {eventTime} in {eventLocation} with about {attendance} students in attendance.';

	let mode = $state<'none' | 'org' | 'person' | 'event'>('none');
	let error = $state('');

	let orgName = $state('');
	let orgIndex = $state('');
	let orgBudget = $state('Event Expenses');
	let orgTemplate = $state(defaultTemplate);

	let personName = $state('');
	let personUo95 = $state('');
	let personAddress = $state('');
	let personEmail = $state('');
	let personPhone = $state('');
	let personRequester = $state(false);
	let idFrontFileId = $state<Id<'files'> | null>(null);
	let idBackFileId = $state<Id<'files'> | null>(null);

	let eventName = $state('');
	let eventTime = $state('');
	let eventLocation = $state('');
	let eventAttendance = $state(50);

	const organizations = $derived(savedData?.organizations ?? []);
	const people = $derived((savedData?.people ?? []).filter((person) => person.organizationId === organizationId));
	const eventPresets = $derived(
		(savedData?.eventPresets ?? []).filter((eventPreset) => eventPreset.organizationId === organizationId)
	);
	const requester = $derived(people.find((person) => person.isRequester));

	function selectOrganization(value: string) {
		organizationId = value === '' ? null : (value as Id<'organizations'>);
		const orgPeople = (savedData?.people ?? []).filter((person) => person.organizationId === organizationId);
		purchaserPersonId = orgPeople.find((person) => person.isRequester)?._id ?? null;
		eventPresetId = null;
		onChange();
	}

	function selectPurchaser(value: string) {
		purchaserPersonId = value === '' ? null : (value as Id<'people'>);
		onChange();
	}

	function selectEvent(value: string) {
		eventPresetId = value === '' ? null : (value as Id<'eventPresets'>);
		onChange();
	}

	async function uploadId(kind: 'id_front' | 'id_back', input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;
		const uploadUrl = await convexMutation(session, api.authed.purchaseBuilder.generateUploadUrl, {});
		const response = await fetch(uploadUrl, {
			method: 'POST',
			headers: { 'Content-Type': file.type || 'application/octet-stream' },
			body: file
		});
		const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
		const fileId = await convexMutation(session, api.authed.purchaseBuilder.saveFile, {
			kind,
			storageId,
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size
		});
		if (kind === 'id_front') idFrontFileId = fileId;
		if (kind === 'id_back') idBackFileId = fileId;
	}

	async function createOrg(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			organizationId = await convexMutation(session, api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: orgName,
				indexNumber: orgIndex,
				fundLetter: 'I',
				defaultBudgetLineItem: orgBudget,
				businessPurposeTemplate: orgTemplate
			});
			purchaserPersonId = null;
			eventPresetId = null;
			mode = 'none';
			await onSavedChange();
			onChange();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function createPerson(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (organizationId === null || idFrontFileId === null || idBackFileId === null) {
			error = 'Organization and ID files required.';
			return;
		}
		try {
			purchaserPersonId = await convexMutation(session, api.authed.purchaseBuilder.upsertPerson, {
				id: null,
				organizationId,
				name: personName,
				uo95: personUo95,
				permanentAddress: personAddress,
				idCardFrontFileId: idFrontFileId,
				idCardBackFileId: idBackFileId,
				email: personRequester && personEmail ? personEmail : null,
				phone: personRequester && personPhone ? personPhone : null,
				isRequester: personRequester
			});
			mode = 'none';
			await onSavedChange();
			onChange();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function createEvent(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (organizationId === null) {
			error = 'Organization required.';
			return;
		}
		try {
			eventPresetId = await convexMutation(session, api.authed.purchaseBuilder.upsertEventPreset, {
				id: null,
				organizationId,
				name: eventName,
				time: eventTime,
				location: eventLocation,
				estimatedAttendance: eventAttendance
			});
			mode = 'none';
			await onSavedChange();
			onChange();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

<section class="panel">
	<div class="flex items-center justify-between gap-3">
		<h2 class="text-sm font-semibold">Saved setup</h2>
		<div class="flex gap-2">
			<button class="secondary" type="button" onclick={() => (mode = 'org')}>New org</button>
			<button class="secondary" type="button" onclick={() => (mode = 'person')}>New person</button>
			<button class="secondary" type="button" onclick={() => (mode = 'event')}>New event</button>
		</div>
	</div>

	{#if error}<p class="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

	<div class="mt-4 grid gap-4 md:grid-cols-3">
		<label>
			<span>Organization</span>
			<select class="field" onchange={(e) => selectOrganization(e.currentTarget.value)}>
				<option value="">Select</option>
				{#each organizations as org (org._id)}
					<option value={org._id} selected={org._id === organizationId}>{org.name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Purchaser</span>
			<select
				class="field"
				value={purchaserPersonId ?? ''}
				onchange={(e) => selectPurchaser(e.currentTarget.value)}
				disabled={organizationId === null}
			>
				<option value="">Select</option>
				{#each people as person (person._id)}
					<option value={person._id}>{person.name}</option>
				{/each}
			</select>
		</label>
		<label>
			<span>Event</span>
			<select
				class="field"
				value={eventPresetId ?? ''}
				onchange={(e) => selectEvent(e.currentTarget.value)}
				disabled={organizationId === null}
			>
				<option value="">Select</option>
				{#each eventPresets as eventPreset (eventPreset._id)}
					<option value={eventPreset._id}>{eventPreset.name}</option>
				{/each}
			</select>
		</label>
	</div>

	{#if organizationId !== null && requester === undefined}
		<p class="mt-3 text-sm text-red-700">Set a requester for this organization.</p>
	{/if}

	{#if mode === 'org'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createOrg}>
			<input class="field" placeholder="Organization name" bind:value={orgName} />
			<input class="field" placeholder="Index number" bind:value={orgIndex} />
			<input class="field" placeholder="Budget line item" bind:value={orgBudget} />
			<textarea class="field min-h-24" bind:value={orgTemplate}></textarea>
			<button class="button" type="submit">Create organization</button>
		</form>
	{:else if mode === 'person'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createPerson}>
			<input class="field" placeholder="Name" bind:value={personName} />
			<input class="field" placeholder="UO 95" bind:value={personUo95} />
			<input
				class="field"
				placeholder="Permanent address"
				autocomplete="street-address"
				bind:value={personAddress}
			/>
			<div class="grid gap-3 md:grid-cols-2">
				<FilePicker
					label="ID front"
					status={idFrontFileId ? 'Uploaded' : 'Required'}
					onFiles={(input) => uploadId('id_front', input)}
				/>
				<FilePicker
					label="ID back"
					status={idBackFileId ? 'Uploaded' : 'Required'}
					onFiles={(input) => uploadId('id_back', input)}
				/>
			</div>
			<label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={personRequester} />Requester</label>
			{#if personRequester}
				<input class="field" type="email" placeholder="Requester email" bind:value={personEmail} />
				<input class="field" type="tel" placeholder="Requester phone" bind:value={personPhone} />
			{/if}
			<button class="button" type="submit">Create person</button>
		</form>
	{:else if mode === 'event'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createEvent}>
			<input class="field" placeholder="Event name" bind:value={eventName} />
			<input class="field" placeholder="Time" bind:value={eventTime} />
			<input class="field" placeholder="Location" bind:value={eventLocation} />
			<input class="field" type="number" min="1" bind:value={eventAttendance} />
			<button class="button" type="submit">Create event</button>
		</form>
	{/if}
</section>

<style>
	.panel {
		border: 1px solid rgb(231 229 228);
		border-radius: 0.5rem;
		background: white;
		padding: 1.25rem;
	}

	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}

	.secondary {
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.45rem 0.7rem;
		font-size: 0.8125rem;
		font-weight: 500;
	}

	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
</style>
