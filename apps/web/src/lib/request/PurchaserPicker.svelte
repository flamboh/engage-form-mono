<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import PurchaserForm from '$lib/app/PurchaserForm.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		purchasers,
		userName,
		organization
	}: {
		editor: RequestEditor;
		purchasers: Doc<'purchasers'>[];
		userName: string;
		organization: Doc<'organizations'> | undefined;
	} = $props();

	let adding = $state(false);

	const form = $derived(editor.form);
	const selectedId = $derived(
		form?.purchaserSource.kind === 'purchaser' ? form.purchaserSource.purchaserId : null
	);
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap gap-2" role="group" aria-label="Who paid">
		<Chip
			selected={form?.purchaserSource.kind === 'self'}
			onclick={() => editor.choosePurchaserSelf()}
		>
			Me{userName ? `, ${userName.split(' ')[0]}` : ''}
		</Chip>
		{#each purchasers as purchaser (purchaser._id)}
			<Chip
				selected={purchaser._id === selectedId}
				onclick={() => editor.choosePurchaser(purchaser)}
			>
				{purchaser.name}
			</Chip>
		{/each}
		{#if organization !== undefined}
			<Chip variant="add" onclick={() => (adding = !adding)}>
				{adding ? 'Close' : '+ Someone else'}
			</Chip>
		{/if}
	</div>
	{#if adding && organization !== undefined}
		<div class="border border-(--line) bg-(--surface) p-4">
			<p class="mb-3 text-sm text-(--quiet)">
				Saved to {organization.name}. Pick them above once they’re added.
			</p>
			<PurchaserForm
				purchaser={null}
				organizations={[organization]}
				onDone={() => (adding = false)}
			/>
		</div>
	{/if}
</div>
