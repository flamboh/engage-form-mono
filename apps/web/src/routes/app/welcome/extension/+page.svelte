<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import ExtensionSteps from '$lib/app/ExtensionSteps.svelte';
	import { errorMessage } from '$lib/app/styles';
	import ReceiptDrop from '$lib/board/ReceiptDrop.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { startUploads } from '$lib/uploads.svelte';
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
			const id = await client.mutation(api.authed.purchaseBuilder.createDraftForOrganization, {
				organizationId: organization._id
			});
			void startUploads(session, id, files, 'auto');
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
	<p class="text-sm text-stone-600">
		It types your request into Engage for you. You can do this now or when your first request is
		ready.
	</p>
</div>

<ExtensionSteps />

{#if organization}
	<div class="flex flex-col gap-4 border-t border-stone-200 pt-8">
		<h2 class="text-lg font-semibold">Have a receipt handy?</h2>
		<ReceiptDrop busy={starting} onFiles={startRequest} />
		{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
		<a
			class="self-start text-sm font-medium text-[#154733] underline underline-offset-4"
			href={`/app/org/${organization._id}`}
		>
			Go to {organization.name}
		</a>
	</div>
{/if}
