<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import DocumentPicker from '$lib/app/DocumentPicker.svelte';
	import { errorMessage, inputClass, labelClass, primaryButtonClass } from '$lib/app/styles';
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
		<label class={labelClass}>
			Organization
			<select class={inputClass} bind:value={organizationId}>
				{#each organizations as org (org._id)}
					<option value={org._id}>{org.name}</option>
				{/each}
			</select>
		</label>
	{/if}
	<label class={labelClass}>
		Full name
		<input class={inputClass} required bind:value={name} />
	</label>
	<label class={labelClass}>
		UO ID number
		<input class={inputClass} required inputmode="numeric" placeholder="95…" bind:value={uo95} />
	</label>
	<label class={labelClass}>
		Permanent address
		<input class={inputClass} required bind:value={permanentAddress} />
	</label>
	<div class="grid gap-5 sm:grid-cols-2">
		<DocumentPicker bind:fileId={idCardFrontFileId} kind="id_front" label="UO ID card, front" />
		<DocumentPicker bind:fileId={idCardBackFileId} kind="id_back" label="UO ID card, back" />
	</div>
	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<div class="flex items-center gap-3">
		<button class={primaryButtonClass} type="submit" disabled={saving}>
			{saving ? 'Saving…' : start ? 'Save' : 'Add purchaser'}
		</button>
		<button class="text-sm text-stone-600 hover:text-stone-900" type="button" onclick={onDone}>
			Cancel
		</button>
	</div>
</form>
