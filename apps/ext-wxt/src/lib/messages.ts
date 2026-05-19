import type { Id } from '../../../../convex/_generated/dataModel';

export type ReadyPurchaseRequest = {
	id: Id<'purchaseRequests'>;
	status: 'ready';
	organization: string;
	purchaser: string;
	itemDescription: string;
	totalAmount: number;
	updatedAt: number;
	lastFilledAt: number | null;
};

export type RuntimeMessage =
	| { type: 'AUTH_STATE' }
	| { type: 'GET_CONVEX_TOKEN' }
	| { type: 'SIGN_OUT' };

export type RuntimeResponse =
	| { ok: true; signedIn: boolean; email: string | null }
	| { ok: true; token: string | null }
	| { ok: true; message: string }
	| { ok: false; message: string };

export function runtimeError(error: unknown): RuntimeResponse {
	return {
		ok: false,
		message: error instanceof Error ? error.message : String(error)
	};
}
