<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import DocumentPicker from '$lib/app/DocumentPicker.svelte';
	import { errorMessage } from '$lib/app/styles';
	import Button from '$lib/ui/Button.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { useConvexClient } from 'convex-svelte';

	let {
		purchaser,
		organizations,
		onDone
	}: {
		purchaser: Doc<'purchasers'> | null;
		organizations: Doc<'organizations'>[];
		onDone: () => void;
	} = $props();

	const client = useConvexClient();
	const start = untrack(() => purchaser);

	let organizationId = $state<Id<'organizations'> | ''>(
		start?.organizationId ?? untrack(() => organizations[0]?._id) ?? ''
	);
	let name = $state(start?.name ?? '');
	let uo95 = $state(start?.uo95 ?? '');
	let permanentAddress = $state(start?.permanentAddress ?? '');
	let idCardFrontFileId = $state<Id<'files'> | null>(start?.idCardFrontFileId ?? null);
	let idCardBackFileId = $state<Id<'files'> | null>(start?.idCardBackFileId ?? null);
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (organizationId === '') {
			error = 'Choose an organization.';
			return;
		}
		if (idCardFrontFileId === null || idCardBackFileId === null) {
			error = 'Add photos of the front and back of their UO ID card.';
			return;
		}
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertPurchaser, {
				id: start?._id ?? null,
				organizationId,
				name: name.trim(),
				uo95: uo95.trim(),
				permanentAddress: permanentAddress.trim(),
				idCardFrontFileId,
				idCardBackFileId
			});
			onDone();
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
	{#if organizations.length > 1}
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Organization
			<select class="input" bind:value={organizationId}>
				{#each organizations as org (org._id)}
					<option value={org._id}>{org.name}</option>
				{/each}
			</select>
		</label>
	{/if}
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Full name
		<input class="input" required bind:value={name} />
	</label>
	<div class="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			UO ID number
			<input class="input" required inputmode="numeric" placeholder="95…" bind:value={uo95} />
		</label>
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Permanent address
			<input class="input" required bind:value={permanentAddress} />
		</label>
	</div>
	<div class="flex flex-col gap-2">
		<span class="text-sm font-medium">Their UO ID card</span>
		<div class="flex flex-wrap gap-3">
			<DocumentPicker bind:fileId={idCardFrontFileId} kind="id_front" label="Front" />
			<DocumentPicker bind:fileId={idCardBackFileId} kind="id_back" label="Back" />
		</div>
	</div>
	{#if error}<InlineError message={error} />{/if}
	<div class="flex items-center gap-4">
		<Button variant="primary" type="submit" busy={saving}>
			{saving ? 'Saving…' : start ? 'Save' : 'Add person'}
		</Button>
		<Button variant="quiet" onclick={onDone}>Cancel</Button>
	</div>
</form>
