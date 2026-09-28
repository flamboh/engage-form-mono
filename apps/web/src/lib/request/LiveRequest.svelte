<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { startUploads, uploadsFor } from '$lib/uploads.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';
	import type { RequestBackend } from './editor.svelte';
	import RequestPage from './RequestPage.svelte';

	let {
		organizationId,
		purchaseRequestId
	}: {
		organizationId: Id<'organizations'>;
		purchaseRequestId: Id<'purchaseRequests'>;
	} = $props();

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const viewQuery = useQuery(api.authed.documents.getRequestView, () =>
		clerkContext.currentSession ? { id: purchaseRequestId } : 'skip'
	);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () =>
		clerkContext.currentSession ? { includeArchived: false } : 'skip'
	);
	const userQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	const pending = $derived(uploadsFor(purchaseRequestId));

	const backend: RequestBackend = {
		saveSnapshot: async (snapshot) => {
			await client.mutation(api.authed.purchaseBuilder.saveDraftSnapshot, {
				id: purchaseRequestId,
				snapshot
			});
		},
		applyTemplate: async (templateId) => {
			await client.mutation(api.authed.purchaseBuilder.applyBusinessPurposeTemplate, {
				draftId: purchaseRequestId,
				templateId
			});
		},
		resolveReview: async (field, value) => {
			await client.mutation(api.authed.documents.resolveReview, {
				purchaseRequestId,
				field,
				value
			});
		},
		removeDocument: async (fileId) => {
			await client.mutation(api.authed.documents.removeDocument, { purchaseRequestId, fileId });
		},
		requestFill: () => client.mutation(api.authed.extension.requestFill, { purchaseRequestId }),
		markApproved: async () => {
			await client.mutation(api.authed.purchaseBuilder.markApproved, { id: purchaseRequestId });
		},
		reopen: async () => {
			await client.mutation(api.authed.purchaseBuilder.reopenPurchase, {
				id: purchaseRequestId,
				clearFilled: false
			});
		},
		upload: (files, slot) => {
			const session = clerkContext.currentSession;
			if (!session) return;
			startUploads(session, purchaseRequestId, files, slot);
		}
	};
</script>

<RequestPage
	view={viewQuery.data}
	saved={savedQuery.data}
	user={userQuery.data ?? null}
	{organizationId}
	{pending}
	{backend}
	loadError={viewQuery.error ? 'This request couldn’t be loaded. Refresh to try again.' : ''}
/>
