<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import type { ClerkSession } from '$lib/convex-http';
	import FilePicker from '$lib/purchase/FilePicker.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient } from 'convex-svelte';

	type SavedData = {
		organizations: Doc<'organizations'>[];
		purchasers: Doc<'purchasers'>[];
		eventPresets: Doc<'eventPresets'>[];
	};

	export type PurchaserRef =
		| { kind: 'self' }
		| { kind: 'purchaser'; purchaserId: Id<'purchasers'> };

	type Props = {
		session: ClerkSession;
		savedData?: SavedData;
		organizationId: Id<'organizations'> | null;
		purchaser: PurchaserRef;
		eventPresetId: Id<'eventPresets'> | null;
		onChange: () => void;
		onSavedChange: () => Promise<void>;
	};

	let {
		session,
		savedData,
		organizationId = $bindable(),
		purchaser = $bindable(),
		eventPresetId = $bindable(),
		onChange,
		onSavedChange
	}: Props = $props();

	const client = useConvexClient();

	let mode = $state<'none' | 'org' | 'purchaser' | 'event'>('none');
	let error = $state('');

	let orgName = $state('');
	let orgIndex = $state('');
	let orgBudgetLines = $state<string[]>(['Event Expenses']);
	let orgTemplate = $state(
		'{org} wishes to reimburse {purchaser} because they purchased {item} from {vendor} for {amount}. This {item} was given as a gift to {recipient} ({recipientUo95}) for {recipientReason} during {eventName} which took place on {eventDate} at {eventTime} in {eventLocation} with about {attendance} students in attendance.'
	);

	let purchaserName = $state('');
	let purchaserUo95 = $state('');
	let purchaserAddress = $state('');
	let idFrontFileId = $state<Id<'files'> | null>(null);
	let idBackFileId = $state<Id<'files'> | null>(null);

	let eventName = $state('');
	let eventTime = $state('');
	let eventLocation = $state('');
	let eventAttendance = $state(50);

	const organizations = $derived(savedData?.organizations ?? []);
	const purchasers = $derived(
		(savedData?.purchasers ?? []).filter((p) => p.organizationId === organizationId)
	);
	const eventPresets = $derived(
		(savedData?.eventPresets ?? []).filter(
			(eventPreset) => eventPreset.organizationId === organizationId
		)
	);

	function selectOrganization(value: string) {
		organizationId = value === '' ? null : (value as Id<'organizations'>);
		purchaser = { kind: 'self' };
		eventPresetId = null;
		onChange();
	}

	function setPurchaserMode(value: 'self' | 'other') {
		if (value === 'self') {
			purchaser = { kind: 'self' };
		} else if (purchaser.kind !== 'purchaser') {
			const first = purchasers[0];
			purchaser = first ? { kind: 'purchaser', purchaserId: first._id } : { kind: 'self' };
		}
		onChange();
	}

	function selectPurchaser(value: string) {
		if (value === '') {
			purchaser = { kind: 'self' };
		} else {
			purchaser = { kind: 'purchaser', purchaserId: value as Id<'purchasers'> };
		}
		onChange();
	}

	function selectEvent(value: string) {
		eventPresetId = value === '' ? null : (value as Id<'eventPresets'>);
		onChange();
	}

	function addBudgetLine() {
		orgBudgetLines = [...orgBudgetLines, ''];
	}

	function removeBudgetLine(i: number) {
		orgBudgetLines = orgBudgetLines.filter((_, index) => index !== i);
	}

	async function uploadId(kind: 'id_front' | 'id_back', input: HTMLInputElement) {
		const file = input.files?.[0];
		if (!file) return;
		const fileId = await uploadFile(session, kind, file);
		if (kind === 'id_front') idFrontFileId = fileId;
		if (kind === 'id_back') idBackFileId = fileId;
	}

	async function createOrg(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		try {
			organizationId = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: orgName,
				indexNumber: orgIndex,
				fundLetter: 'I',
				budgetLines: orgBudgetLines,
				businessPurposeTemplate: orgTemplate
			});
			purchaser = { kind: 'self' };
			eventPresetId = null;
			mode = 'none';
			await onSavedChange();
			onChange();
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		}
	}

	async function createPurchaser(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		if (organizationId === null || idFrontFileId === null || idBackFileId === null) {
			error = 'Organization and ID files required.';
			return;
		}
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertPurchaser, {
				id: null,
				organizationId,
				name: purchaserName,
				uo95: purchaserUo95,
				permanentAddress: purchaserAddress,
				idCardFrontFileId: idFrontFileId,
				idCardBackFileId: idBackFileId
			});
			purchaser = { kind: 'purchaser', purchaserId: id };
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
			eventPresetId = await client.mutation(api.authed.purchaseBuilder.upsertEventPreset, {
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
		<h2 class="text-sm font-semibold">Setup</h2>
		<div class="flex gap-2">
			<button class="secondary" type="button" onclick={() => (mode = 'org')}>New org</button>
			<button class="secondary" type="button" onclick={() => (mode = 'purchaser')}>
				New purchaser
			</button>
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

	<div class="mt-4 space-y-2">
		<span class="text-sm font-medium">Purchaser</span>
		<div class="flex gap-3 text-sm">
			<label class="flex items-center gap-2">
				<input
					type="radio"
					name="purchaser-mode"
					checked={purchaser.kind === 'self'}
					onchange={() => setPurchaserMode('self')}
				/>
				I'm the purchaser
			</label>
			<label class="flex items-center gap-2">
				<input
					type="radio"
					name="purchaser-mode"
					checked={purchaser.kind === 'purchaser'}
					onchange={() => setPurchaserMode('other')}
					disabled={organizationId === null}
				/>
				Someone else
			</label>
		</div>
		{#if purchaser.kind === 'purchaser'}
			<select
				class="field"
				value={purchaser.purchaserId}
				onchange={(e) => selectPurchaser(e.currentTarget.value)}
			>
				{#each purchasers as p (p._id)}
					<option value={p._id}>{p.name}</option>
				{/each}
			</select>
		{/if}
	</div>

	{#if mode === 'org'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createOrg}>
			<input class="field" placeholder="Organization name" required bind:value={orgName} />
			<input class="field" placeholder="Index number" required bind:value={orgIndex} />
			<div>
				<span class="text-xs font-medium text-stone-500">Budget lines</span>
				{#each orgBudgetLines as _line, i (i)}
					<div class="mt-1 flex items-center gap-2">
						<input class="field flex-1" required bind:value={orgBudgetLines[i]} />
						{#if orgBudgetLines.length > 1}
							<button class="secondary" type="button" onclick={() => removeBudgetLine(i)}>
								Remove
							</button>
						{/if}
					</div>
				{/each}
				<button class="secondary mt-2" type="button" onclick={addBudgetLine}>Add line</button>
			</div>
			<textarea class="field min-h-24" bind:value={orgTemplate}></textarea>
			<button class="button" type="submit">Create organization</button>
		</form>
	{:else if mode === 'purchaser'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createPurchaser}>
			<input class="field" placeholder="Name" required bind:value={purchaserName} />
			<input class="field" placeholder="UO 95" required bind:value={purchaserUo95} />
			<input
				class="field"
				placeholder="Permanent address"
				autocomplete="street-address"
				required
				bind:value={purchaserAddress}
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
			<button class="button" type="submit">Create purchaser</button>
		</form>
	{:else if mode === 'event'}
		<form class="mt-4 grid gap-3 rounded-md border border-stone-200 p-3" onsubmit={createEvent}>
			<input class="field" placeholder="Event name" required bind:value={eventName} />
			<input class="field" placeholder="Time" required bind:value={eventTime} />
			<input class="field" placeholder="Location" required bind:value={eventLocation} />
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
