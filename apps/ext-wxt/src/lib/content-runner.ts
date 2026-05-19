import type { PurchaseRequest } from '@engage-form/domain';
import { createFillPlan, detectStep, type FillAction } from '@engage-form/fill-engine';
import type { FillMessage, FillResponse } from './messages';

export type FillRunState = {
	purchaseId: string;
	filled: number;
	pageCount: number;
};

type FillResult = {
	filled: number;
	missed: string[];
	message: string;
};

type ContentRunnerDeps = {
	pageHeading(): string;
	applyFillPlan(actions: FillAction[]): Promise<FillResult>;
	clickNextStep(): boolean;
	sendReviewReached(purchaseId: string): void;
	loadPurchaseRequest(purchaseId: string): Promise<PurchaseRequest | null>;
	loadFillRun(): FillRunState | null;
	saveFillRun(state: FillRunState): void;
	clearFillRun(): void;
};

const MAX_RUN_PAGES = 16;

export function createContentRunner(deps: ContentRunnerDeps) {
	async function fillCurrentPage(purchaseRequest: PurchaseRequest): Promise<FillResponse> {
		const step = detectStep(deps.pageHeading());
		const plan = createFillPlan(step, purchaseRequest);
		const result = await deps.applyFillPlan(plan.actions);

		return {
			ok: result.missed.length === 0,
			message: result.message,
			step,
			filled: result.filled,
			missed: result.missed
		};
	}

	async function startFillRun(purchaseRequest: PurchaseRequest): Promise<FillResponse> {
		deps.saveFillRun({ purchaseId: purchaseRequest.id, filled: 0, pageCount: 0 });
		return continueFillRun();
	}

	async function resumeFillRun() {
		const state = deps.loadFillRun();
		if (state === null) return null;

		return continueFillRun();
	}

	async function continueFillRun(): Promise<FillResponse> {
		const state = deps.loadFillRun();
		const step = detectStep(deps.pageHeading());
		if (state === null) {
			return {
				ok: false,
				message: 'No active fill run.',
				step,
				filled: 0,
				missed: []
			};
		}

		if (step === 'review') {
			deps.clearFillRun();
			deps.sendReviewReached(state.purchaseId);
			return {
				ok: true,
				message: `Review reached. Filled ${state.filled} fields.`,
				step,
				filled: state.filled,
				missed: []
			};
		}

		if (step === 'unknown') {
			deps.clearFillRun();
			return {
				ok: false,
				message: 'Unknown Engage step. Stopped before advancing.',
				step,
				filled: state.filled,
				missed: []
			};
		}

		if (state.pageCount >= MAX_RUN_PAGES) {
			deps.clearFillRun();
			return {
				ok: false,
				message: 'Stopped after too many Engage steps.',
				step,
				filled: state.filled,
				missed: []
			};
		}

		const purchaseRequest = await deps.loadPurchaseRequest(state.purchaseId);
		if (purchaseRequest === null) {
			deps.clearFillRun();
			return {
				ok: false,
				message: 'Selected purchase request could not be loaded from Convex.',
				step,
				filled: state.filled,
				missed: []
			};
		}

		const result = await fillCurrentPage(purchaseRequest);
		const filled = state.filled + result.filled;

		if (result.missed.length > 0) {
			deps.clearFillRun();
			return { ...result, filled, ok: false };
		}

		if (!deps.clickNextStep()) {
			deps.clearFillRun();
			return {
				ok: false,
				message: 'Current page filled, but no next button found.',
				step,
				filled,
				missed: []
			};
		}

		deps.saveFillRun({ ...state, filled, pageCount: state.pageCount + 1 });
		return {
			ok: true,
			message: `Continuing to review. Filled ${filled} fields.`,
			step,
			filled,
			missed: []
		};
	}

	function handleMessage(message: FillMessage) {
		return fillCurrentPage(message.purchase);
	}

	return {
		continueFillRun,
		fillCurrentPage,
		handleMessage,
		resumeFillRun,
		startFillRun
	};
}
