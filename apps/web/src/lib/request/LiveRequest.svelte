<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { settleUploads, startUploads, uploadsFor } from '$lib/uploads.svelte';
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
	const purposesQuery = useQuery(api.authed.board.recentPurposes, () =>
		clerkContext.currentSession ? { organizationId, excludeId: purchaseRequestId } : 'skip'
	);

	const eventsQuery = useQuery(api.authed.events.listEvents, () =>
		clerkContext.currentSession ? { organizationId } : 'skip'
	);
	const approversQuery = useQuery(api.authed.approvers.recentApprovers, () =>
		clerkContext.currentSession ? { organizationId } : 'skip'
	);

	const pending = $derived(uploadsFor(purchaseRequestId));
	const serverFileIds = $derived(viewQuery.data?.documents.map((document) => document.fileId));

	$effect(() => {
		if (serverFileIds !== undefined) settleUploads(purchaseRequestId, serverFileIds);
	});

	const backend: RequestBackend = {
		saveSnapshot: async (snapshot, changedFields) => {
			await client.mutation(api.authed.purchaseBuilder.saveDraftSnapshot, {
				id: purchaseRequestId,
				snapshot,
				changedFields
			});
		},
		saveEvent: ({ id, ...details }) =>
			client.mutation(api.authed.events.upsertEvent, { id, organizationId, ...details }),
		resolveReview: async (field, value) => {
			await client.mutation(api.authed.documents.resolveReview, {
				purchaseRequestId,
				field,
				value
			});
		},
		retryReading: async (fileId) => {
			await client.mutation(api.authed.documents.retryExtraction, { purchaseRequestId, fileId });
		},
		freshPreview: (fileId) =>
			client.query(api.authed.previews.freshPreviewUrl, { fileId, nonce: Date.now() }),
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
		discard: async () => {
			await client.mutation(api.authed.purchaseBuilder.discardDraft, { id: purchaseRequestId });
		},
		rememberApprover: async (approver) => {
			await client.mutation(api.authed.approvers.rememberApprover, { organizationId, ...approver });
		},
		forgetApprover: async (id) => {
			await client.mutation(api.authed.approvers.forgetApprover, { id });
		},
		answerFoodPackaging: async (packaged) => {
			await client.mutation(api.authed.checks.answerFoodPackaging, {
				purchaseRequestId,
				packaged
			});
		},
		confirmCheck: async (checkId) => {
			await client.mutation(api.authed.checks.confirmCheck, { purchaseRequestId, checkId });
		},
		confirmFields: async (fields) => {
			await client.mutation(api.authed.documents.confirmFields, { purchaseRequestId, fields });
		},
		markSentBack: async (note) => {
			await client.mutation(api.authed.board.markSentBack, { purchaseRequestId, note });
		},
		uploadIdCard: async (side, file) => {
			const session = clerkContext.currentSession;
			if (!session) throw new Error('Sign in again to add the photo.');
			return await uploadFile(session, side === 'front' ? 'id_front' : 'id_back', file);
		},
		saveIdCards: async (purchaser, source) => {
			if (purchaser.idCardBackFileId === null) return;
			const ids = {
				idCardFrontFileId: purchaser.idCardFrontFileId,
				idCardBackFileId: purchaser.idCardBackFileId
			};
			if (source.kind === 'self') {
				const user = userQuery.data;
				if (!user) return;
				await client.mutation(api.authed.purchaseBuilder.upsertUserProfile, {
					name: user.name,
					uo95: user.uo95,
					permanentAddress: user.permanentAddress,
					studentEmail: user.studentEmail,
					phone: user.phone,
					...ids
				});
				return;
			}
			const saved = savedQuery.data?.purchasers.find((item) => item._id === source.purchaserId);
			if (saved === undefined) return;
			await client.mutation(api.authed.purchaseBuilder.upsertPurchaser, {
				id: saved._id,
				organizationId: saved.organizationId,
				name: saved.name,
				uo95: saved.uo95,
				permanentAddress: saved.permanentAddress,
				...ids
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
	events={eventsQuery.data ?? []}
	recentPurposes={purposesQuery.data ?? []}
	approvers={approversQuery.data ?? []}
	{organizationId}
	{pending}
	{backend}
	loadError={viewQuery.error ? 'This request couldn’t be loaded. Refresh to try again.' : ''}
/>
