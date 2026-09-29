<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import PurchaserForm from '$lib/app/PurchaserForm.svelte';
	import { errorMessage } from '$lib/errors';
	import Button from '$lib/ui/Button.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	let {
		organization,
		purchasers
	}: {
		organization: Doc<'organizations'>;
		purchasers: Doc<'purchasers'>[];
	} = $props();

	const client = useConvexClient();
	const approversQuery = useQuery(api.authed.approvers.recentApprovers, () => ({
		organizationId: organization._id
	}));
	const active = $derived(purchasers.filter((purchaser) => !purchaser.archived));
	const archived = $derived(purchasers.filter((purchaser) => purchaser.archived));
	const approvers = $derived(approversQuery.data ?? []);

	let editing = $state<Id<'purchasers'> | 'new' | null>(null);
	let error = $state('');

	async function run(action: () => Promise<unknown>) {
		error = '';
		try {
			await action();
		} catch (err) {
			error = errorMessage(err);
		}
	}

	function setArchived(id: Id<'purchasers'>, value: boolean) {
		return run(async () => {
			await client.mutation(api.authed.purchaseBuilder.setArchived, {
				table: 'purchasers',
				id,
				archived: value
			});
			editing = null;
		});
	}

	function forget(id: Id<'approvers'>) {
		return run(() => client.mutation(api.authed.approvers.forgetApprover, { id }));
	}
</script>

<div class="flex flex-col">
	<SectionHeader title="People" level={3}>
		{#snippet action()}
			<Button
				variant="quiet"
				size="sm"
				onclick={() => (editing = editing === 'new' ? null : 'new')}
			>
				Add person
			</Button>
		{/snippet}
	</SectionHeader>
	{#if editing === 'new'}
		<div class="border-b border-line py-5">
			<PurchaserForm
				purchaser={null}
				organizations={[organization]}
				onDone={() => (editing = null)}
			/>
		</div>
	{/if}
	<dl>
		{#each active as purchaser (purchaser._id)}
			{#if editing === purchaser._id}
				<div class="border-b border-line py-5">
					<PurchaserForm
						{purchaser}
						organizations={[organization]}
						onDone={() => (editing = null)}
					/>
					<div class="pt-4">
						<Button variant="quiet" size="sm" onclick={() => setArchived(purchaser._id, true)}>
							Archive {purchaser.name}
						</Button>
					</div>
				</div>
			{:else}
				<FieldRow
					label="Purchaser"
					value={purchaser.name}
					onaction={() => (editing = purchaser._id)}
				>
					<span class="note" class:missing={!purchaser.idCardBackFileId}>
						{purchaser.idCardBackFileId ? 'ID on file' : 'ID back missing'}
					</span>
				</FieldRow>
			{/if}
		{/each}
		{#each approvers as approver (approver.id)}
			<FieldRow
				label="Approver"
				value={[approver.name, approver.email].filter(Boolean).join(', ')}
				actionLabel="Forget"
				onaction={() => forget(approver.id)}
			/>
		{/each}
	</dl>
	{#if active.length === 0 && approvers.length === 0 && editing !== 'new'}
		<EmptyState
			title="Just you so far."
			body="Add people who pay for things and get paid back. Officers you ask for approval show up here too."
		/>
	{/if}
	{#if archived.length > 0}
		<details class="archived">
			<summary>Archived people ({archived.length})</summary>
			<dl>
				{#each archived as purchaser (purchaser._id)}
					<FieldRow
						label="Purchaser"
						value={purchaser.name}
						actionLabel="Restore"
						onaction={() => setArchived(purchaser._id, false)}
					/>
				{/each}
			</dl>
		</details>
	{/if}
	{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}
</div>

<style>
	.note {
		margin-left: 10px;
		font-size: 12.5px;
		color: var(--quiet);
		white-space: nowrap;
	}

	.note::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 5px;
		vertical-align: 1px;
		background: var(--pine);
	}

	.note.missing::before {
		background: var(--marker-deep);
	}

	.archived summary {
		cursor: pointer;
		padding: 12px 0 4px;
		font-size: 13.5px;
		color: var(--quiet);
	}
</style>
