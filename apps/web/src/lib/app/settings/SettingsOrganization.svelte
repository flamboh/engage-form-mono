<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc } from '$convex/_generated/dataModel';
	import OrganizationEvents from '$lib/app/OrganizationEvents.svelte';
	import BudgetLines from '$lib/app/settings/BudgetLines.svelte';
	import OrganizationPeople from '$lib/app/settings/OrganizationPeople.svelte';
	import { errorMessage } from '$lib/app/styles';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { useConvexClient } from 'convex-svelte';

	type Organization = Doc<'organizations'>;
	type Patch = Partial<Pick<Organization, 'name' | 'indexNumber' | 'fundLetter' | 'budgetLines'>>;

	let {
		organization,
		purchasers
	}: {
		organization: Organization;
		purchasers: Doc<'purchasers'>[];
	} = $props();

	const client = useConvexClient();
	const otherFunds: Organization['fundLetter'][] = ['E', 'G', 'N', 'U', 'D', 'T'];
	let choosingFund = $state(false);
	let pending = $state<Required<Patch> | null>(null);
	let error = $state('');

	const current = $derived<Required<Patch>>(
		pending ?? {
			name: organization.name,
			indexNumber: organization.indexNumber,
			fundLetter: organization.fundLetter,
			budgetLines: organization.budgetLines
		}
	);

	const hasAllocations = $derived(current.budgetLines.some((line) => line.allocations.length > 0));

	async function save(patch: Patch) {
		const next = { ...current, ...patch };
		pending = next;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: organization._id,
				...next
			});
			return null;
		} catch (err) {
			return errorMessage(err);
		} finally {
			if (pending === next) pending = null;
		}
	}

	async function saveRow(patch: Patch) {
		error = (await save(patch)) ?? '';
	}

	async function chooseFund(fundLetter: Organization['fundLetter']) {
		choosingFund = false;
		await saveRow({ fundLetter });
	}

	async function archive() {
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.setArchived, {
				table: 'organizations',
				id: organization._id,
				archived: true
			});
		} catch (err) {
			error = errorMessage(err);
		}
	}

	function funding(fundLetter: Organization['fundLetter']) {
		return fundLetter === 'I'
			? 'ASUO, student fee money. Events need publicity'
			: `Fund ${fundLetter}`;
	}
</script>

<div class="flex flex-col gap-7">
	<div>
		<dl class="border-t border-line">
			<FieldRow label="Name" value={current.name} oncommit={(name) => saveRow({ name })} />
			<FieldRow
				label="Index number"
				value={current.indexNumber}
				oncommit={(indexNumber) => saveRow({ indexNumber })}
			/>
			<FieldRow
				label="Funding"
				value={funding(current.fundLetter)}
				actionLabel={choosingFund ? 'Close' : 'Change'}
				onaction={() => (choosingFund = !choosingFund)}
			/>
		</dl>
		{#if choosingFund}
			<div class="funds" role="group" aria-label="Funding">
				<Chip selected={current.fundLetter === 'I'} onclick={() => chooseFund('I')}>
					ASUO, student fee money
				</Chip>
				{#each otherFunds as fund (fund)}
					<Chip selected={current.fundLetter === fund} onclick={() => chooseFund(fund)}>
						Fund {fund}
					</Chip>
				{/each}
			</div>
		{/if}
		{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}
	</div>

	<BudgetLines
		lines={current.budgetLines}
		budgetHref={hasAllocations ? `/app/org/${organization._id}/budget` : null}
		onsave={(budgetLines) => save({ budgetLines })}
	/>

	<OrganizationEvents {organization} />

	<OrganizationPeople {organization} {purchasers} />

	<div>
		<Button variant="quiet" size="sm" onclick={archive}>Archive {organization.name}</Button>
	</div>
</div>

<style>
	.funds {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		border-bottom: 1px solid var(--line);
		padding: 12px 0;
	}
</style>
