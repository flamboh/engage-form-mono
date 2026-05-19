import type { PurchaseRequest } from '@engage-form/domain';
import type { EngageStep } from '@engage-form/fill-engine';
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
	| { type: 'SIGN_OUT' }
	| { type: 'START_FILL'; purchaseId: string; token: string }
	| { type: 'GET_FILL_PAYLOAD'; purchaseId: string };

export type FillMessage = {
	type: 'FILL_CURRENT_PAGE';
	purchase: PurchaseRequest;
};

export type RuntimeResponse =
	| { ok: true; signedIn: boolean; email: string | null }
	| { ok: true; token: string | null }
	| { ok: true; message: string }
	| { ok: true; purchase: PurchaseRequest }
	| FillResponse
	| { ok: false; message: string };

export type FillResponse = {
	ok: boolean;
	message: string;
	step: EngageStep;
	filled: number;
	missed: string[];
};

export function runtimeError(error: unknown): RuntimeResponse {
	return {
		ok: false,
		message: error instanceof Error ? error.message : String(error)
	};
}
