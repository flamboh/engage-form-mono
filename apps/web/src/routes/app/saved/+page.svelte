<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type Fund = 'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T';

	const clerkContext = getClerkContext();
	const client = useConvexClient();

	let includeArchived = $state(false);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived } : 'skip'
	);
	const currentUserQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, () =>
		clerkContext.currentSession ? {} : 'skip'
	);
	const savedData = $derived<
		| {
				organizations: Doc<'organizations'>[];
				purchasers: Doc<'purchasers'>[];
				eventPresets: Doc<'eventPresets'>[];
		  }
		| undefined
	>(savedQuery.data);
	const currentUser = $derived(currentUserQuery.data ?? null);

	let orgId = $state<Id<'organizations'> | null>(null);
	let orgName = $state('');
	let orgIndex = $state('');
	let orgFund = $state<Fund>('I');
	let orgBudgetLines = $state<string[]>(['Event Expenses']);
	let orgTemplate = $state(
		'{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given as a gift to {recipient} ({recipientUo95}) for {recipientReason} during {eventName} which took place on {eventDate} at {eventTime} in {eventLocation} with about {attendance} students in attendance.'
	);

	let purchaserOrgId = $state<Id<'organizations'> | ''>('');
	let purchaserId = $state<Id<'purchasers'> | null>(null);
	let purchaserName = $state('');
	let purchaserUo95 = $state('');
	let purchaserAddress = $state('');
	let idFrontFileId = $state<Id<'files'> | null>(null);
	let idBackFileId = $state<Id<'files'> | null>(null);

	let eventOrgId = $state<Id<'organizations'> | ''>('');
	let eventId = $state<Id<'eventPresets'> | null>(null);
	let eventName = $state('');
	let eventTime = $state('');
	let eventLocation = $state('');
	let eventAttendance = $state(50);
	let error = $state('');

	function editOrg(org: Doc<'organizations'>) {
		orgId = org._id;
		orgName = org.name;
		orgIndex = org.indexNumber;
		orgFund = org.fundLetter;
		orgBudgetLines = org.budgetLines.length > 0 ? [...org.budgetLines] : [''];
		orgTemplate = org.businessPurposeTemplate;
	}

	function editPurchaser(purchaser: Doc<'purchasers'>) {
		purchaserId = purchaser._id;
		purchaserOrgId = purchaser.organizationId;
		purchaserName = purchaser.name;
		purchaserUo95 = purchaser.uo95;
		purchaserAddress = purchaser.permanentAddress;
		idFrontFileId = purchaser.idCardFrontFileId;
		idBackFileId = purchaser.idCardBackFileId;
	}

	function editEvent(eventPreset: Doc<'eventPresets'>) {
		eventId = eventPreset._id;
		eventOrgId = eventPreset.organizationId;
		eventName = eventPreset.name;
		eventTime = eventPreset.time;
		eventLocation = eventPreset.location;
		eventAttendance = eventPreset.estimatedAttendance;
	}

	function addBudgetLine() {
		orgBudgetLines = [...orgBudgetLines, ''];
	}

	function removeBudgetLine(i: number) {
		orgBudgetLines = orgBudgetLines.filter((_, index) => index !== i);
	}

	async function upload(kind: 'id_front' | 'id_back', input: HTMLInputElement) {
		const session = clerkContext.currentSession;
		const file = input.files?.[0];
		if (!session || !file) return;
		const fileId = await uploadFile(session, kind, file);
		if (kind === 'id_front') idFrontFileId = fileId;
		if (kind === 'id_back') idBackFileId = fileId;
	}

	async function saveOrg(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: orgId,
				name: orgName,
				indexNumber: orgIndex,
				fundLetter: orgFund,
				budgetLines: orgBudgetLines,
				businessPurposeTemplate: orgTemplate
			});
			orgId = null;
			orgName = '';
			orgIndex = '';
			orgBudgetLines = ['Event Expenses'];
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function archiveRecord(
		table: 'organizations' | 'purchasers' | 'eventPresets',
		id: Id<'organizations'> | Id<'purchasers'> | Id<'eventPresets'>,
		archived: boolean
	) {
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.setArchived, {
				table,
				id,
				archived
			});
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function savePurchaser(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!purchaserOrgId || idFrontFileId === null || idBackFileId === null) {
			error = 'Student organization and ID card documents required.';
			return;
		}
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertPurchaser, {
				id: purchaserId,
				organizationId: purchaserOrgId,
				name: purchaserName,
				uo95: purchaserUo95,
				permanentAddress: purchaserAddress,
				idCardFrontFileId: idFrontFileId,
				idCardBackFileId: idBackFileId
			});
			purchaserId = null;
			purchaserName = '';
			purchaserUo95 = '';
			purchaserAddress = '';
			idFrontFileId = null;
			idBackFileId = null;
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function saveEvent(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (!eventOrgId) {
			error = 'Student organization required.';
			return;
		}
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertEventPreset, {
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

		<main class="mx-auto max-w-6xl space-y-6 px-6 py-8">
			{#if error}<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>{/if}

			<section class="rounded-lg border border-stone-200 bg-white p-5">
				<div class="flex items-center justify-between gap-3">
					<div>
						<h2 class="text-sm font-semibold">Your profile</h2>
						{#if currentUser}
							<p class="mt-1 text-sm text-stone-500">
								{currentUser.name} · {currentUser.uo95} · {currentUser.studentEmail}
							</p>
						{:else}
							<p class="mt-1 text-sm text-stone-500">Profile not set.</p>
						{/if}
					</div>
					<a class="secondary" href="/app/welcome/profile">Edit profile</a>
				</div>
			</section>

			<div class="grid gap-6 lg:grid-cols-3">
				<section class="rounded-lg border border-stone-200 bg-white p-5">
					<h2 class="text-sm font-semibold">Student Organizations</h2>
					<form class="mt-4 space-y-3" onsubmit={saveOrg}>
						<input
							class="field"
							placeholder="Student organization name"
							required
							bind:value={orgName}
						/>
						<input class="field" placeholder="Index number" required bind:value={orgIndex} />
						<select class="field" bind:value={orgFund}>
							<option>I</option><option>E</option><option>G</option><option>N</option><option
								>U</option
							><option>D</option><option>T</option>
						</select>
						<div>
							<span class="text-xs font-medium text-stone-500">Budget Line Items</span>
							{#each orgBudgetLines as _line, i (i)}
								<div class="mt-1 flex items-center gap-2">
									<input class="field flex-1" required bind:value={orgBudgetLines[i]} />
									{#if orgBudgetLines.length > 1}
										<button class="link-button" type="button" onclick={() => removeBudgetLine(i)}>
											Remove
										</button>
									{/if}
								</div>
							{/each}
							<button class="link-button mt-2" type="button" onclick={addBudgetLine}
								>Add line</button
							>
						</div>
						<textarea class="field min-h-32" bind:value={orgTemplate}></textarea>
						<button class="button" type="submit">Save student organization</button>
					</form>
					<ul class="mt-5 divide-y divide-stone-200">
						{#each savedData?.organizations ?? [] as org (org._id)}
							<li class="py-3 text-sm">
								<p class="font-medium">{org.name}</p>
								<p class="text-stone-500">{org.indexNumber} · Fund {org.fundLetter}</p>
								<div class="mt-2 flex gap-2">
									<button class="link-button" type="button" onclick={() => editOrg(org)}
										>Edit</button
									>
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
					<h2 class="text-sm font-semibold">Purchasers</h2>
					<p class="mt-1 text-xs text-stone-500">Other people who paid (not you).</p>
					<form class="mt-4 space-y-3" onsubmit={savePurchaser}>
						<select class="field" bind:value={purchaserOrgId}>
							<option value="">Student Organization</option>
							{#each savedData?.organizations ?? [] as org (org._id)}
								<option value={org._id}>{org.name}</option>
							{/each}
						</select>
						<input class="field" placeholder="Name" required bind:value={purchaserName} />
						<input class="field" placeholder="UO 95" required bind:value={purchaserUo95} />
						<input
							class="field"
							placeholder="Permanent address"
							autocomplete="street-address"
							required
							bind:value={purchaserAddress}
						/>
						<label class="block text-xs font-medium text-stone-500">
							ID card front document
							<input
								class="mt-1 block text-sm"
								type="file"
								onchange={(e) => upload('id_front', e.currentTarget)}
							/>
						</label>
						<label class="block text-xs font-medium text-stone-500">
							ID card back document
							<input
								class="mt-1 block text-sm"
								type="file"
								onchange={(e) => upload('id_back', e.currentTarget)}
							/>
						</label>
						<button class="button" type="submit">Save purchaser</button>
					</form>
					<ul class="mt-5 divide-y divide-stone-200">
						{#each savedData?.purchasers ?? [] as purchaser (purchaser._id)}
							<li class="py-3 text-sm">
								<p class="font-medium">{purchaser.name}</p>
								<p class="text-stone-500">{purchaser.uo95}</p>
								<div class="mt-2 flex gap-2">
									<button
										class="link-button"
										type="button"
										onclick={() => editPurchaser(purchaser)}
									>
										Edit
									</button>
									<button
										class="link-button"
										type="button"
										onclick={() => archiveRecord('purchasers', purchaser._id, !purchaser.archived)}
									>
										{purchaser.archived ? 'Unarchive' : 'Archive'}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</section>

				<section class="rounded-lg border border-stone-200 bg-white p-5">
					<h2 class="text-sm font-semibold">Event Templates</h2>
					<form class="mt-4 space-y-3" onsubmit={saveEvent}>
						<select class="field" bind:value={eventOrgId}>
							<option value="">Student Organization</option>
							{#each savedData?.organizations ?? [] as org (org._id)}
								<option value={org._id}>{org.name}</option>
							{/each}
						</select>
						<input class="field" placeholder="Name" required bind:value={eventName} />
						<input class="field" placeholder="Time" required bind:value={eventTime} />
						<input class="field" placeholder="Location" required bind:value={eventLocation} />
						<input class="field" type="number" min="1" bind:value={eventAttendance} />
						<button class="button" type="submit">Save event template</button>
					</form>
					<ul class="mt-5 divide-y divide-stone-200">
						{#each savedData?.eventPresets ?? [] as eventPreset (eventPreset._id)}
							<li class="py-3 text-sm">
								<p class="font-medium">{eventPreset.name}</p>
								<p class="text-stone-500">{eventPreset.time} · {eventPreset.location}</p>
								<div class="mt-2 flex gap-2">
									<button class="link-button" type="button" onclick={() => editEvent(eventPreset)}>
										Edit
									</button>
									<button
										class="link-button"
										type="button"
										onclick={() =>
											archiveRecord('eventPresets', eventPreset._id, !eventPreset.archived)}
									>
										{eventPreset.archived ? 'Unarchive' : 'Archive'}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				</section>
			</div>
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

	.secondary {
		display: inline-flex;
		align-items: center;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.45rem 0.75rem;
		font-size: 0.8125rem;
		font-weight: 500;
		text-decoration: none;
		color: inherit;
	}

	.link-button {
		font-size: 0.75rem;
		font-weight: 600;
		color: rgb(87 83 78);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>
