import type { PurchaseRequest } from '@engage-form/domain';
import type { EngageStep } from '@engage-form/fill-engine';
import type { PendingFill, PendingFillState } from './pending-fill';

export type ReadyPurchaseRequest = {
	id: string;
	status: 'ready';
	organization: string;
	purchaser: string;
	vendor: string;
	itemDescription: string;
	totalAmount: number;
	updatedAt: number;
	lastFilledAt: number | null;
};

export type RuntimeMessage =
	| { type: 'AUTH_STATE' }
	| { type: 'CONNECT' }
	| { type: 'SIGN_OUT' }
	| { type: 'START_FILL'; purchaseId: string }
	| { type: 'PREPARE_FILL_RUN'; purchaseId: string }
	| { type: 'GET_FILL_PAYLOAD'; purchaseId: string }
	| { type: 'GET_FILL_DOCUMENT'; documentId: string }
	| { type: 'REVIEW_REACHED'; purchaseId: string }
	| { type: 'FILL_RUN_ENDED' }
	| { type: 'GET_PENDING_FILL' }
	| { type: 'CLAIM_PENDING_FILL'; purchaseId: string }
	| { type: 'CLEAR_PENDING_FILL'; purchaseId: string }
	| { type: 'LIST_READY' };

export type ExternalMessage =
	| { type: 'STATUS' }
	| { type: 'CONNECT'; token: string; sessionId: string }
	| { type: 'DISCONNECT' };

export type ExternalResponse =
	| { ok: true; connected: boolean; sessionId: string | null; signedOut: boolean }
	| { ok: false; message: string };

export type FillMessage = {
	type: 'START_FILL_RUN';
	purchase: PurchaseRequest;
};

export type RuntimeResponse =
	| { ok: true; signedIn: boolean }
	| { ok: true; message: string }
	| { ok: true; purchase: PurchaseRequest }
	| { ok: true; dataUrl: string }
	| { ok: true; purchases: ReadyPurchaseRequest[] }
	| { ok: true; pendingFillState: PendingFillState }
	| { ok: true; claimedFill: PendingFill | null }
	| FillResponse
	| { ok: false; message: string; authRequired?: boolean };

export type FillResponse = {
	ok: boolean;
	message: string;
	step: EngageStep;
	filled: number;
	missed: string[];
};

export function isAuthRequired(response: RuntimeResponse | undefined) {
	return response?.ok === false && 'authRequired' in response && response.authRequired === true;
}
