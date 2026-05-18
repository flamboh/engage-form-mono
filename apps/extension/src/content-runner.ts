import type { Purchase } from '@engage-form/domain';
import {
	createFillPlan,
	detectStep,
	type EngageStep,
	type FillAction
} from '@engage-form/fill-engine';

export type ExtensionMessage =
	| {
			type: 'ENGAGE_FILL_READY_PURCHASE';
			purchase: Purchase;
	  }
	| {
			type: 'ENGAGE_COMPLETE_READY_PURCHASE';
			purchase: Purchase;
	  };

export type ExtensionResponse = {
	ok: boolean;
	message: string;
	step: EngageStep;
	filled: number;
	missed: string[];
};

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
	loadPurchase(purchaseId: string): Promise<Purchase | null>;
	loadFillRun(): FillRunState | null;
	saveFillRun(state: FillRunState): void;
	clearFillRun(): void;
};

const MAX_RUN_PAGES = 16;

export function createContentRunner(deps: ContentRunnerDeps) {
	async function fillCurrentPage(purchase: Purchase): Promise<ExtensionResponse> {
		const step = detectStep(deps.pageHeading());
		const plan = createFillPlan(step, purchase);
		const result = await deps.applyFillPlan(plan.actions);

		return {
			ok: result.missed.length === 0,
			message: result.message,
			step,
			filled: result.filled,
			missed: result.missed
		};
	}

	async function startFillRun(purchase: Purchase): Promise<ExtensionResponse> {
		deps.saveFillRun({ purchaseId: purchase.id, filled: 0, pageCount: 0 });
		return continueFillRun();
	}

	async function resumeFillRun() {
		const state = deps.loadFillRun();
		if (state === null) return null;

		return continueFillRun();
	}

	async function continueFillRun(): Promise<ExtensionResponse> {
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

		const purchase = await deps.loadPurchase(state.purchaseId);
		if (purchase === null) {
			deps.clearFillRun();
			return {
				ok: false,
				message: 'Selected purchase is no longer cached in the extension.',
				step,
				filled: state.filled,
				missed: []
			};
		}

		const result = await fillCurrentPage(purchase);
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

	function handleMessage(message: ExtensionMessage) {
		return message.type === 'ENGAGE_COMPLETE_READY_PURCHASE'
			? startFillRun(message.purchase)
			: fillCurrentPage(message.purchase);
	}

	return {
		continueFillRun,
		fillCurrentPage,
		handleMessage,
		resumeFillRun,
		startFillRun
	};
}
