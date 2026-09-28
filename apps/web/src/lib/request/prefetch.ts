import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { ConvexClient } from 'convex/browser';

const holdMs = 20_000;

export function prefetchRequest(
	client: ConvexClient,
	purchaseRequestId: Id<'purchaseRequests'>,
	organizationId: Id<'organizations'>
) {
	const ignore = () => {};
	const stops = [
		client.onUpdate(api.authed.documents.getRequestView, { id: purchaseRequestId }, ignore),
		client.onUpdate(
			api.authed.board.recentPurposes,
			{ organizationId, excludeId: purchaseRequestId },
			ignore
		),
		client.onUpdate(api.authed.purchaseBuilder.getCurrentUser, {}, ignore),
		client.onUpdate(api.authed.purchaseBuilder.listSaved, { includeArchived: false }, ignore)
	];
	setTimeout(() => {
		for (const stop of stops) stop();
	}, holdMs);
}
