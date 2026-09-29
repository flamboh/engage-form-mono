<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import ExtensionSteps from '$lib/app/ExtensionSteps.svelte';
	import { errorMessage } from '$lib/errors';
	import ReceiptDrop from '$lib/board/ReceiptDrop.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { prefetchRequest } from '$lib/request/prefetch';
	import { startUploads } from '$lib/uploads.svelte';
	import Button from '$lib/ui/Button.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, { includeArchived: false });
	const organization = $derived(savedQuery.data?.organizations[0] ?? null);

	let starting = $state(false);
	let error = $state('');

	async function startRequest(files: File[]) {
		const session = clerkContext.currentSession;
		if (!session || !organization || starting) return;
		starting = true;
		error = '';
		try {
			const created = client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
				organizationId: organization._id
			});
			if (files.length > 0) startUploads(session, created, files, 'auto');
			const id = await created;
			prefetchRequest(client, id, organization._id);
			await goto(`/app/org/${organization._id}/purchase/${id}`);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			starting = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">Set up the Chrome extension</h1>
	<p class="text-sm text-quiet">
		It types your request into Engage for you. You can do this now or when your first request is
		ready.
	</p>
</div>

<ExtensionSteps />

{#if organization}
	<div class="flex flex-col gap-4 pt-4">
		<SectionHeader title="Have a receipt handy?" />
		<ReceiptDrop busy={starting} onFiles={startRequest} />
		{#if error}<InlineError message={error} />{/if}
		<div>
			<Button variant="secondary" href={`/app/org/${organization._id}`}>
				Go to {organization.name}
			</Button>
		</div>
	</div>
{/if}
