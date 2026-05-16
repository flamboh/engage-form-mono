<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { convexMutation, convexQuery } from '$lib/convex-http';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	const clerkContext = getClerkContext();

	let includeArchived = $state(false);
	let savedData = $state<{
		organizations: Doc<'organizations'>[];
		people: Doc<'people'>[];
		eventPresets: Doc<'eventPresets'>[];
	}>();

	let orgId = $state<Id<'organizations'> | null>(null);
	let orgName = $state('');
	let orgIndex = $state('');
	let orgFund = $state<'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T'>('I');
	let orgBudget = $state('Event Expenses');
	let orgTemplate = $state(
		'{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given as a gift to {recipient} ({recipientUo95}) for {recipientReason} during {eventName} which took place on {eventDate} at {eventTime} in {eventLocation} with about {attendance} students in attendance.'
	);

	let personOrgId = $state<Id<'organizations'> | ''>('');
	let personId = $state<Id<'people'> | null>(null);
	let personName = $state('');
	let personUo95 = $state('');
	let personAddress = $state('');
	let personEmail = $state('');
	let personPhone = $state('');
	let personRequester = $state(false);
	let idFrontFileId = $state<Id<'files'> | null>(null);
	let idBackFileId = $state<Id<'files'> | null>(null);

	let eventOrgId = $state<Id<'organizations'> | ''>('');
	let eventId = $state<Id<'eventPresets'> | null>(null);
	let eventName = $state('');
	let eventTime = $state('');
	let eventLocation = $state('');
	let eventAttendance = $state(50);
	let error = $state('');

	$effect(() => {
		if (!clerkContext.currentSession) return;
		void loadSaved();
	});

	async function loadSaved() {
		if (!clerkContext.currentSession) return;
		error = '';
		try {
			savedData = await convexQuery(clerkContext.currentSession, api.authed.purchaseBuilder.listSaved, {
				includeArchived
			});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	function editOrg(org: Doc<'organizations'>) {
		orgId = org._id;
		orgName = org.name;
		orgIndex = org.indexNumber;
		orgFund = org.fundLetter;
		orgBudget = org.defaultBudgetLineItem;
		orgTemplate = org.businessPurposeTemplate;
	}

	function editPerson(person: Doc<'people'>) {
		personId = person._id;
		personOrgId = person.organizationId;
		personName = person.name;
		personUo95 = person.uo95;
		personAddress = person.permanentAddress;
		personEmail = person.email ?? '';
		personPhone = person.phone ?? '';
		personRequester = person.isRequester;
		idFrontFileId = person.idCardFrontFileId;
		idBackFileId = person.idCardBackFileId;
	}

	function editEvent(eventPreset: Doc<'eventPresets'>) {
		eventId = eventPreset._id;
		eventOrgId = eventPreset.organizationId;
		eventName = eventPreset.name;
		eventTime = eventPreset.time;
		eventLocation = eventPreset.location;
		eventAttendance = eventPreset.estimatedAttendance;
	}

	async function upload(kind: 'id_front' | 'id_back', input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;
		if (!clerkContext.currentSession) return;
		const uploadUrl = await convexMutation(
			clerkContext.currentSession,
			api.authed.purchaseBuilder.generateUploadUrl,
			{}
		);
		const response = await fetch(uploadUrl, {
			method: 'POST',
			headers: { 'Content-Type': file.type || 'application/octet-stream' },
			body: file
		});
		const { storageId } = (await response.json()) as { storageId: Id<'_storage'> };
		const fileId = await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.saveFile, {
			kind,
			storageId,
			filename: file.name,
			contentType: file.type || 'application/octet-stream',
			size: file.size
		});
		if (kind === 'id_front') idFrontFileId = fileId;
		if (kind === 'id_back') idBackFileId = fileId;
	}

	async function saveOrg(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!clerkContext.currentSession) return;
		try {
			await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.upsertOrganization, {
				id: orgId,
				name: orgName,
				indexNumber: orgIndex,
				fundLetter: orgFund,
				defaultBudgetLineItem: orgBudget,
				businessPurposeTemplate: orgTemplate
			});
			orgId = null;
			orgName = '';
			orgIndex = '';
			await loadSaved();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function archiveRecord(
		table: 'organizations' | 'people' | 'eventPresets',
		id: Id<'organizations'> | Id<'people'> | Id<'eventPresets'>,
		archived: boolean
	) {
		error = '';
		if (!clerkContext.currentSession) return;
		try {
			await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.setArchived, {
				table,
				id,
				archived
			});
			await loadSaved();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function savePerson(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!personOrgId || idFrontFileId === null || idBackFileId === null) {
			error = 'Organization and ID files required.';
			return;
		}
		if (!clerkContext.currentSession) return;
		try {
			await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.upsertPerson, {
				id: personId,
				organizationId: personOrgId,
				name: personName,
				uo95: personUo95,
				permanentAddress: personAddress,
				idCardFrontFileId: idFrontFileId,
				idCardBackFileId: idBackFileId,
				email: personEmail || null,
				phone: personPhone || null,
				isRequester: personRequester
			});
			personId = null;
			personName = '';
			personUo95 = '';
			personAddress = '';
			personEmail = '';
			personPhone = '';
			personRequester = false;
			idFrontFileId = null;
			idBackFileId = null;
			await loadSaved();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function saveEvent(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!eventOrgId) {
			error = 'Organization required.';
			return;
		}
		if (!clerkContext.currentSession) return;
		try {
			await convexMutation(clerkContext.currentSession, api.authed.purchaseBuilder.upsertEventPreset, {
				id: eventId,
				organizationId: eventOrgId,
				name: eventName,
				time: eventTime,
				location: eventLocation,
				estimatedAttendance: eventAttendance
			});
			eventId = null;
			eventName = '';
			eventTime = '';
			eventLocation = '';
			await loadSaved();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}
</script>

{#if !clerkContext.currentSession}
	<div class="flex min-h-screen items-center justify-center bg-stone-50">
		<div
			{@attach (el) => {
				clerkContext.clerk.mountSignIn(el, {});
			}}
		></div>
	</div>
{:else}
	<div class="min-h-screen bg-stone-50 text-stone-950">
		<header class="border-b border-stone-200 bg-white">
			<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
				<div class="flex items-center gap-3">
					<a class="text-sm text-stone-500 hover:text-stone-900" href="/app">Back</a>
					<h1 class="text-lg font-semibold">Saved</h1>
				</div>
				<label class="flex items-center gap-2 text-sm text-stone-600">
					<input type="checkbox" bind:checked={includeArchived} />
					Show archived
				</label>
			</div>
		</header>

		<main class="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-3">
			{#if error}<p class="lg:col-span-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<h2 class="text-sm font-semibold">Organizations</h2>
				<form class="mt-4 space-y-3" onsubmit={saveOrg}>
					<input class="field" placeholder="Name" bind:value={orgName} />
					<input class="field" placeholder="Index number" bind:value={orgIndex} />
					<select class="field" bind:value={orgFund}>
						<option>I</option><option>E</option><option>G</option><option>N</option><option>U</option
						><option>D</option><option>T</option>
					</select>
					<input class="field" placeholder="Budget line item" bind:value={orgBudget} />
					<textarea class="field min-h-32" bind:value={orgTemplate}></textarea>
					<button class="button" type="submit">Save organization</button>
				</form>
				<ul class="mt-5 divide-y divide-stone-200">
					{#each savedData?.organizations ?? [] as org (org._id)}
						<li class="py-3 text-sm">
							<p class="font-medium">{org.name}</p>
							<p class="text-stone-500">{org.indexNumber} · Fund {org.fundLetter}</p>
							<div class="mt-2 flex gap-2">
								<button class="link-button" type="button" onclick={() => editOrg(org)}>Edit</button>
								<button
									class="link-button"
									type="button"
									onclick={() => archiveRecord('organizations', org._id, !org.archived)}
								>
									{org.archived ? 'Unarchive' : 'Archive'}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>

			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<h2 class="text-sm font-semibold">People</h2>
				<form class="mt-4 space-y-3" onsubmit={savePerson}>
					<select class="field" bind:value={personOrgId}>
						<option value="">Organization</option>
						{#each savedData?.organizations ?? [] as org (org._id)}
							<option value={org._id}>{org.name}</option>
						{/each}
					</select>
					<input class="field" placeholder="Name" bind:value={personName} />
					<input class="field" placeholder="UO 95" bind:value={personUo95} />
					<input class="field" placeholder="Permanent address" bind:value={personAddress} />
					<label class="block text-xs font-medium text-stone-500">
						ID front
						<input class="mt-1 block text-sm" type="file" onchange={(e) => upload('id_front', e.currentTarget)} />
					</label>
					<label class="block text-xs font-medium text-stone-500">
						ID back
						<input class="mt-1 block text-sm" type="file" onchange={(e) => upload('id_back', e.currentTarget)} />
					</label>
					<label class="flex items-center gap-2 text-sm">
						<input type="checkbox" bind:checked={personRequester} />
						Set as requester
					</label>
					<input class="field" placeholder="Requester email" bind:value={personEmail} />
					<input class="field" placeholder="Requester phone" bind:value={personPhone} />
					<button class="button" type="submit">Save person</button>
				</form>
				<ul class="mt-5 divide-y divide-stone-200">
					{#each savedData?.people ?? [] as person (person._id)}
						<li class="py-3 text-sm">
							<p class="font-medium">{person.name}</p>
							<p class="text-stone-500">
								{person.uo95}{person.isRequester ? ' · requester' : ''}
							</p>
							<div class="mt-2 flex gap-2">
								<button class="link-button" type="button" onclick={() => editPerson(person)}>Edit</button>
								<button
									class="link-button"
									type="button"
									onclick={() => archiveRecord('people', person._id, !person.archived)}
								>
									{person.archived ? 'Unarchive' : 'Archive'}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>

			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<h2 class="text-sm font-semibold">Event presets</h2>
				<form class="mt-4 space-y-3" onsubmit={saveEvent}>
					<select class="field" bind:value={eventOrgId}>
						<option value="">Organization</option>
						{#each savedData?.organizations ?? [] as org (org._id)}
							<option value={org._id}>{org.name}</option>
						{/each}
					</select>
					<input class="field" placeholder="Name" bind:value={eventName} />
					<input class="field" placeholder="Time" bind:value={eventTime} />
					<input class="field" placeholder="Location" bind:value={eventLocation} />
					<input class="field" type="number" min="1" bind:value={eventAttendance} />
					<button class="button" type="submit">Save event</button>
				</form>
				<ul class="mt-5 divide-y divide-stone-200">
					{#each savedData?.eventPresets ?? [] as eventPreset (eventPreset._id)}
						<li class="py-3 text-sm">
							<p class="font-medium">{eventPreset.name}</p>
							<p class="text-stone-500">{eventPreset.time} · {eventPreset.location}</p>
							<div class="mt-2 flex gap-2">
								<button class="link-button" type="button" onclick={() => editEvent(eventPreset)}>Edit</button>
								<button
									class="link-button"
									type="button"
									onclick={() => archiveRecord('eventPresets', eventPreset._id, !eventPreset.archived)}
								>
									{eventPreset.archived ? 'Unarchive' : 'Archive'}
								</button>
							</div>
						</li>
					{/each}
				</ul>
			</section>
		</main>
	</div>
{/if}

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
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}

	.link-button {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgb(87 83 78);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
