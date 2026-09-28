import type { PurchaseRequest } from '@engage-form/domain';
import { detectStep, type EngageStep, type FillAction } from '@engage-form/fill-engine';
import { browser } from 'wxt/browser';
import { hideBanner, showBanner } from '../lib/banner';
import { createContentRunner, fillLabel, type FillRunState } from '../lib/content-runner';
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
const CONFIRM_DISMISSED_KEY = 'engageFormConfirmDismissed';
const STEP_WAIT_MS = 10_000;
const STEP_CHANGE_WAIT_MS = 20_000;
const STEP_SETTLE_MS = 750;
const cancelledMessage = 'Fill cancelled.';
const runActiveMessage = 'Engage Form is already filling this page.';

type UploadDocument = {
	filename: string;
	contentType: string;
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
		let runActive = false;
		let promptShown = false;

		browser.runtime.onMessage.addListener((message) => {
			const fillMessage = message as FillMessage;
			if (runActive || loadFillRun() !== null) {
				return Promise.resolve<FillResponse>({
					ok: false,
					message: runActiveMessage,
					step: detectStep(pageHeading()),
					filled: 0,
					missed: []
				});
			}
			if (fillMessage.type === 'START_FILL_RUN') {
				showFilling(fillLabel(fillMessage.purchase), fillMessage.purchase.id);
			}
			busy = true;
			runActive = true;
			return runner
				.handleMessage(fillMessage)
				.then((response) => {
					if (fillMessage.type === 'START_FILL_RUN') {
						void drive(fillMessage.purchase.id, response).finally(() => {
							busy = false;
							runActive = false;
						});
					} else {
						busy = false;
						runActive = false;
						showBanner({ text: response.message, hideAfterMs: 5_000 });
					}
					return response;
				})
				.catch((error: unknown) => {
					busy = false;
					runActive = false;
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
			await checkPageWith(runPage);
		}

		async function checkPageWith(run: () => Promise<void>) {
			if (busy) return;
			busy = true;
			try {
				await run();
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
				await runExclusive(async () => {
					showFilling(activeRun.label, activeRun.purchaseId);
					await waitForKnownStep();
					await drive(activeRun.purchaseId, await runner.continueFillRun());
				});
				return;
			}

			const step = await waitForKnownStep();
			const pendingFillState = await readPendingFillState();
			if (pendingFillState === null) return;

			const decision = autoStartDecision({
				url: window.location.href,
				step,
				activeRun: runActive || loadFillRun() !== null,
				state: pendingFillState,
				signInDismissed: window.sessionStorage.getItem(SIGN_IN_DISMISSED_KEY) !== null,
				confirmDismissed:
					pendingFillState.signedIn &&
					pendingFillState.pendingFill !== null &&
					window.sessionStorage.getItem(CONFIRM_DISMISSED_KEY) ===
						pendingFillState.pendingFill.purchaseRequestId
			});

			if (decision.type === 'signIn') {
				showSignIn();
				return;
			}

			if (decision.type === 'confirm') {
				showConfirm(decision.pendingFill);
				return;
			}

			if (promptShown) {
				promptShown = false;
				hideBanner();
			}

			if (decision.type === 'start') {
				await startPendingFill(decision.pendingFill);
			}
		}

		async function runExclusive(run: () => Promise<void>) {
			if (runActive) return;
			runActive = true;
			try {
				await run();
			} finally {
				runActive = false;
			}
		}

		async function startPendingFill(pendingFill: PendingFill) {
			if (runActive || loadFillRun() !== null) return;
			await runExclusive(async () => {
				const claimed = await claimPendingFill(pendingFill.purchaseRequestId);
				if (claimed === null) return;
				showFilling(claimed.label, claimed.purchaseRequestId);
				const purchase = await loadPurchaseRequest(claimed.purchaseRequestId);
				if (purchase === null) {
					showBanner({
						text: `Couldn’t load “${claimed.label}”. Open it in Engage Form and try again.`,
						tone: 'error',
						actions: [dismissAction()]
					});
					return;
				}
				await drive(claimed.purchaseRequestId, await runner.startFillRun(purchase, claimed.label));
			});
		}

		function showConfirm(pendingFill: PendingFill) {
			promptShown = true;
			showBanner({
				text: `Fill this form with “${pendingFill.label}”?`,
				actions: [
					{
						label: 'Fill',
						onClick: () => {
							promptShown = false;
							void checkPageWith(() => startPendingFill(pendingFill));
						}
					},
					{
						label: 'Not now',
						onClick: () => {
							window.sessionStorage.setItem(CONFIRM_DISMISSED_KEY, pendingFill.purchaseRequestId);
							promptShown = false;
							hideBanner();
						}
					}
				]
			});
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
			showRunResult(response);
		}

		function showRunResult(response: FillResponse) {
			if (response.ok && response.step === 'review') {
				showBanner({
					text: 'Engage is filled. Review it, then submit.',
					tone: 'done',
					hideAfterMs: 10_000
				});
				return;
			}
			if (response.message === cancelledMessage) return;
			showBanner({ text: response.message, tone: 'error', actions: [dismissAction()] });
		}

		function showFilling(label: string, purchaseId: string) {
			promptShown = false;
			showBanner({
				text: `Filling “${label}”…`,
				actions: [{ label: 'Cancel', onClick: () => cancel(purchaseId) }]
			});
		}

		function cancel(purchaseId: string) {
			if (loadFillRun()?.purchaseId !== purchaseId) return;
			clearFillRun();
			showBanner({ text: cancelledMessage, hideAfterMs: 3_000 });
		}

		function showSignIn() {
			promptShown = true;
			showBanner({
				text: 'Sign in to Engage Form to fill this automatically.',
				actions: [
					{
						label: 'Sign in',
						onClick: () => void sendRuntimeMessage({ type: 'SIGN_IN' })
					},
					{
						label: 'Not now',
						onClick: () => {
							window.sessionStorage.setItem(SIGN_IN_DISMISSED_KEY, '1');
							promptShown = false;
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

async function claimPendingFill(purchaseId: string): Promise<PendingFill | null> {
	const response = await sendRuntimeMessage({ type: 'CLAIM_PENDING_FILL', purchaseId });
	if (response?.ok === true && 'claimedFill' in response) return response.claimedFill;
	if (response?.ok === false) throw new Error(response.message);
	return null;
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
		if (file.dataUrl === undefined) return uploadMiss(`Upload asset missing: ${file.filename}.`);
		const response = await fetch(file.dataUrl);
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
