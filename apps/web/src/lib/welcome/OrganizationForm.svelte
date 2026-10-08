<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import { errorMessage } from '$lib/errors';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { useConvexClient } from 'convex-svelte';

	type FundLetter = Doc<'organizations'>['fundLetter'];

	let {
		submitLabel,
		onSaved,
		onCancel
	}: {
		submitLabel: string;
		onSaved: (id: Id<'organizations'>) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	const client = useConvexClient();
	const otherFunds: FundLetter[] = ['E', 'G', 'N', 'U', 'D', 'T'];

	let name = $state('');
	let indexNumber = $state('');
	let fundLetter = $state<FundLetter>('I');
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		saving = true;
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: null,
				name: name.trim(),
				indexNumber: indexNumber.trim(),
				fundLetter,
				budgetLines: [],
				fundAllocations: []
			});
			await onSaved(id);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-5" onsubmit={save}>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Organization name
		<input class="input" required placeholder="Ski & Snowboard Club" bind:value={name} />
	</label>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Index number
		<span class="text-xs font-normal text-quiet">The account number printed on your budget.</span>
		<input class="input" required bind:value={indexNumber} />
	</label>

	<fieldset class="flex flex-col gap-2 text-sm">
		<legend class="mb-1.5 font-medium">Is this budget funded by ASUO?</legend>
		<div class="flex flex-wrap gap-2">
			<Chip selected={fundLetter === 'I'} onclick={() => (fundLetter = 'I')}>
				Yes, student fee money
			</Chip>
			<Chip selected={fundLetter !== 'I'} onclick={() => (fundLetter = 'E')}>No, another fund</Chip>
		</div>
		{#if fundLetter !== 'I'}
			<label class="mt-2 flex flex-col gap-1.5 font-medium">
				Fund letter on your budget
				<select class="input" bind:value={fundLetter}>
					{#each otherFunds as fund (fund)}
						<option value={fund}>{fund}</option>
					{/each}
				</select>
			</label>
		{:else}
			<span class="text-xs text-quiet">
				ASUO-funded events need proof they were advertised. We’ll ask for it on each request.
			</span>
		{/if}
	</fieldset>

	<p class="text-xs text-quiet">
		ASUO pays from Administrative or Programming funds; you’ll pick one on each request. To track
		your own budget lines, add them later in Settings.
	</p>

	{#if error}<InlineError message={error} />{/if}
	<div class="flex items-center gap-4">
		<Button variant="primary" type="submit" busy={saving}>
			{saving ? 'Saving…' : submitLabel}
		</Button>
		{#if onCancel}<Button variant="quiet" onclick={onCancel}>Cancel</Button>{/if}
	</div>
</form>
