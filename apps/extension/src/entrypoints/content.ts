import type { PurchaseRequest } from '@engage-form/domain';
import { detectStep, type EngageStep, type FillAction } from '@engage-form/fill-engine';
import { browser } from 'wxt/browser';
import { hideBanner, showBanner } from '../lib/banner';
import { createContentRunner, fillLabel, type FillRunState } from '../lib/content-runner';
import { readWebAppUrl } from '../lib/env';
import {
	clickNextStep,
	type FileUploadResult,
	setChoice,
	setComboBox,
	setField,
	setFiles,
	setSelect,
	uploadMiss
} from '../lib/form-controls';
import type { FillMessage, FillResponse, RuntimeMessage, RuntimeResponse } from '../lib/messages';
import { autoStartDecision, type PendingFill, type PendingFillState } from '../lib/pending-fill';

const FILL_RUN_KEY = 'engageFormFillRun';
const SIGN_IN_DISMISSED_KEY = 'engageFormSignInDismissed';
const STEP_WAIT_MS = 10_000;
const STEP_CHANGE_WAIT_MS = 20_000;
const STEP_SETTLE_MS = 750;
const cancelledMessage = 'Fill cancelled.';

type UploadDocument = {
	filename: string;
	contentType: string;
	storageKey: string;
	dataUrl?: string;
};

export default defineContentScript({
	matches: ['https://uoregon.campuslabs.com/engage/submitter/form/*'],
	main() {
		const state = window as Window & { __engageFormWxtContentLoaded?: boolean };
		if (state.__engageFormWxtContentLoaded === true) return;
		state.__engageFormWxtContentLoaded = true;

		const runner = createContentRunner({
			pageHeading,
			applyFillPlan,
			clickNextStep,
			sendReviewReached,
			loadPurchaseRequest,
			loadFillRun,
			saveFillRun,
			clearFillRun
		});
		let busy = false;
		let signInShown = false;

		browser.runtime.onMessage.addListener((message) => {
			const fillMessage = message as FillMessage;
			if (fillMessage.type === 'START_FILL_RUN') {
				showFilling(fillLabel(fillMessage.purchase), fillMessage.purchase.id);
			}
			busy = true;
			return runner
				.handleMessage(fillMessage)
				.then((response) => {
					if (fillMessage.type === 'START_FILL_RUN') {
						void drive(fillMessage.purchase.id, response).finally(() => {
							busy = false;
						});
					} else {
						busy = false;
						showBanner({ text: response.message, hideAfterMs: 5_000 });
					}
					return response;
				})
				.catch((error: unknown) => {
					busy = false;
					const response: FillResponse = {
						ok: false,
						message: error instanceof Error ? error.message : 'Unknown fill error.',
						step: detectStep(pageHeading()),
						filled: 0,
						missed: []
					};
					showBanner({ text: response.message, tone: 'error', actions: [dismissAction()] });
					return response;
				});
		});

		window.setTimeout(() => void checkPage(), 500);
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') void checkPage();
		});

		async function checkPage() {
			if (busy) return;
			busy = true;
			try {
				await runPage();
			} catch (error) {
				showBanner({
					text: error instanceof Error ? error.message : 'Engage Form could not fill this page.',
					tone: 'error',
					actions: [dismissAction()]
				});
			} finally {
				busy = false;
			}
		}

		async function runPage() {
			const activeRun = loadFillRun();
			if (activeRun !== null) {
				showFilling(activeRun.label, activeRun.purchaseId);
				await waitForKnownStep();
				await drive(activeRun.purchaseId, await runner.continueFillRun());
				return;
			}

			const step = await waitForKnownStep();
			const pendingFillState = await readPendingFillState();
			if (pendingFillState === null) return;

			const decision = autoStartDecision({
				url: window.location.href,
				step,
				now: Date.now(),
				activeRun: loadFillRun() !== null,
				state: pendingFillState,
				signInDismissed: window.sessionStorage.getItem(SIGN_IN_DISMISSED_KEY) !== null
			});

			if (decision.type === 'signIn') {
				showSignIn();
				return;
			}

			if (signInShown) {
				signInShown = false;
				hideBanner();
			}

			if (decision.type === 'expire') {
				await clearPendingFill(decision.pendingFill.purchaseRequestId);
				return;
			}

			if (decision.type === 'start') {
				await startPendingFill(decision.pendingFill);
			}
		}

		async function startPendingFill(pendingFill: PendingFill) {
			showFilling(pendingFill.label, pendingFill.purchaseRequestId);
			const purchase = await loadPurchaseRequest(pendingFill.purchaseRequestId);
			if (purchase === null) {
				await clearPendingFill(pendingFill.purchaseRequestId);
				showBanner({
					text: `Couldn’t load “${pendingFill.label}”. Open it in Engage Form and try again.`,
					tone: 'error',
					actions: [dismissAction()]
				});
				return;
			}
			await drive(
				pendingFill.purchaseRequestId,
				await runner.startFillRun(purchase, pendingFill.label)
			);
		}

		async function drive(purchaseId: string, first: FillResponse) {
			let response = first;
			while (response.ok && response.step !== 'review') {
				const moved = await waitForStepChange(response.step);
				if (loadFillRun()?.purchaseId !== purchaseId) return;
				if (!moved) {
					clearFillRun();
					response = {
						...response,
						ok: false,
						message: 'Engage didn’t move to the next page. Check this page, then try again.'
					};
					break;
				}
				response = await runner.continueFillRun();
			}
			await showRunResult(purchaseId, response);
		}

		async function showRunResult(purchaseId: string, response: FillResponse) {
			if (response.ok && response.step === 'review') {
				showBanner({
					text: 'Engage is filled. Review it, then submit.',
					tone: 'done',
					hideAfterMs: 10_000
				});
				return;
			}
			if (response.message === cancelledMessage) return;
			await clearPendingFill(purchaseId);
			showBanner({ text: response.message, tone: 'error', actions: [dismissAction()] });
		}

		function showFilling(label: string, purchaseId: string) {
			signInShown = false;
			showBanner({
				text: `Filling “${label}”…`,
				actions: [{ label: 'Cancel', onClick: () => void cancel(purchaseId) }]
			});
		}

		async function cancel(purchaseId: string) {
			clearFillRun();
			showBanner({ text: cancelledMessage, hideAfterMs: 3_000 });
			await clearPendingFill(purchaseId);
		}

		function showSignIn() {
			signInShown = true;
			showBanner({
				text: 'Sign in to Engage Form to fill this automatically.',
				actions: [
					{ label: 'Sign in', href: `${readWebAppUrl()}/app` },
					{
						label: 'Not now',
						onClick: () => {
							window.sessionStorage.setItem(SIGN_IN_DISMISSED_KEY, '1');
							signInShown = false;
							hideBanner();
						}
					}
				]
			});
		}
	}
});

function dismissAction() {
	return { label: 'Dismiss', onClick: hideBanner };
}

async function waitForKnownStep() {
	return await pollStep((step) => step !== 'unknown', STEP_WAIT_MS);
}

async function waitForStepChange(previous: EngageStep) {
	const step = await pollStep(
		(current) => current !== 'unknown' && current !== previous,
		STEP_CHANGE_WAIT_MS
	);
	if (step === 'unknown' || step === previous) return false;
	await wait(STEP_SETTLE_MS);
	return true;
}

async function pollStep(done: (step: EngageStep) => boolean, timeoutMs: number) {
	const startedAt = Date.now();
	let step = detectStep(pageHeading());
	while (!done(step) && Date.now() - startedAt < timeoutMs) {
		await wait(250);
		step = detectStep(pageHeading());
	}
	return step;
}

function wait(ms: number) {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function readPendingFillState(): Promise<PendingFillState | null> {
	const response = await sendRuntimeMessage({ type: 'GET_PENDING_FILL' });
	return response?.ok === true && 'pendingFillState' in response ? response.pendingFillState : null;
}

async function clearPendingFill(purchaseId: string) {
	await sendRuntimeMessage({ type: 'CLEAR_PENDING_FILL', purchaseId });
}

async function sendRuntimeMessage(message: RuntimeMessage) {
	try {
		return (await browser.runtime.sendMessage(message)) as RuntimeResponse | undefined;
	} catch {
		return undefined;
	}
}

async function applyFillPlan(actions: FillAction[]) {
	let filled = 0;
	const missed: string[] = [];
	const stopMessages: string[] = [];

	for (const action of actions) {
		if (action.type === 'stop') {
			stopMessages.push(action.message);
			continue;
		}

		const result = await applyAction(action);
		if (result === true || (typeof result === 'object' && result.ok)) {
			filled += 1;
		} else {
			missed.push(typeof result === 'object' ? result.message : actionLabel(action));
			if (action.type === 'file') break;
		}
	}

	if (stopMessages.length > 0) {
		return { filled, missed, message: stopMessages.join(' ') };
	}

	if (missed.length > 0) {
		return { filled, missed, message: `Filled ${filled}; missed ${missed.join(', ')}.` };
	}

	return { filled, missed, message: 'Filled current page.' };
}

async function applyAction(action: Exclude<FillAction, { type: 'stop' }>) {
	if (action.type === 'text') {
		return setField(action.labelIncludes, action.value, 'input');
	}

	if (action.type === 'textarea') {
		return setField(action.labelIncludes, action.value, 'textarea');
	}

	if (action.type === 'checkbox') {
		return setChoice(action.labelIncludes, 'checkbox', action.checked);
	}

	if (action.type === 'radio') {
		return setChoice(action.labelIncludes, 'radio', true);
	}

	if (action.type === 'combobox') {
		return setComboBox(action.labelIncludes, action.valueIncludes);
	}

	if (action.type === 'file') {
		return setFiles(action.labelIncludes, action.files, uploadFiles);
	}

	return setSelect(action.labelIncludes, action.valueIncludes);
}

async function uploadFiles(
	selector: string,
	files: UploadDocument[],
	dropSelector: string
): Promise<FileUploadResult> {
	const input = document.querySelector(selector);
	if (!(input instanceof HTMLInputElement)) return uploadMiss('Tagged file input disappeared.');

	const dropTarget = document.querySelector(dropSelector);
	if (!(dropTarget instanceof HTMLElement)) return uploadMiss('Tagged upload target disappeared.');

	return assignFiles(input, files, dropTarget);
}

async function assignFiles(
	input: HTMLInputElement,
	files: UploadDocument[],
	dropTarget: HTMLElement
): Promise<FileUploadResult> {
	const transfer = new DataTransfer();

	for (const file of files) {
		const response = await fetch(file.dataUrl ?? browser.runtime.getURL(file.storageKey as never));
		if (!response.ok) return uploadMiss(`Upload asset missing: ${file.filename}.`);

		transfer.items.add(
			new File([await response.blob()], file.filename, { type: file.contentType })
		);
	}

	input.files = transfer.files;
	input.dispatchEvent(new Event('input', { bubbles: true }));
	input.dispatchEvent(new Event('change', { bubbles: true }));
	dropTarget.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
	return { ok: true };
}

function pageHeading() {
	return Array.from(document.querySelectorAll('h1, h2, h3'))
		.map((heading) => heading.textContent ?? '')
		.join(' ');
}

function actionLabel(action: Exclude<FillAction, { type: 'stop' }>) {
	if (action.type === 'text' || action.type === 'textarea' || action.type === 'file') {
		return `${action.type}:${action.labelIncludes}`;
	}

	if (action.type === 'checkbox') {
		return `checkbox:${action.labelIncludes}`;
	}

	return `${action.type}:${action.labelIncludes}`;
}

function sendReviewReached(purchaseId: string) {
	void browser.runtime.sendMessage({
		type: 'REVIEW_REACHED',
		purchaseId
	});
}

function loadFillRun() {
	const json = window.sessionStorage.getItem(FILL_RUN_KEY);
	if (json === null) return null;

	try {
		const state = parseFillRunState(JSON.parse(json));
		if (state === null) clearFillRun();
		return state;
	} catch {
		clearFillRun();
		return null;
	}
}

function saveFillRun(state: FillRunState) {
	window.sessionStorage.setItem(FILL_RUN_KEY, JSON.stringify(state));
}

function clearFillRun() {
	window.sessionStorage.removeItem(FILL_RUN_KEY);
	void browser.runtime.sendMessage({ type: 'FILL_RUN_ENDED' });
}

async function loadPurchaseRequest(purchaseId: string): Promise<PurchaseRequest | null> {
	const response = await sendRuntimeMessage({ type: 'GET_FILL_PAYLOAD', purchaseId });
	return response?.ok === true && 'purchase' in response ? response.purchase : null;
}

function parseFillRunState(value: unknown): FillRunState | null {
	if (!isRecord(value) || typeof value.purchaseId !== 'string') return null;
	return {
		purchaseId: value.purchaseId,
		filled: typeof value.filled === 'number' ? value.filled : 0,
		pageCount: typeof value.pageCount === 'number' ? value.pageCount : 0,
		label: typeof value.label === 'string' ? value.label : 'purchase request'
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
