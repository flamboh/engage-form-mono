import type { PurchaseRequest } from '@engage-form/domain';
import { detectStep, type FillAction } from '@engage-form/fill-engine';
import {
	createContentRunner,
	type ExtensionMessage,
	type ExtensionResponse,
	type FillRunState
} from './content-runner.ts';
import {
	clickNextStep,
	type FileUploadResult,
	setChoice,
	setComboBox,
	setField,
	setFiles,
	setSelect,
	uploadMiss
} from './form-controls.ts';

type ChromeApi = {
	runtime: {
		getURL(path: string): string;
		lastError?: { message: string };
		sendMessage(
			message:
				| { type: 'ENGAGE_GET_READY_PURCHASE'; purchaseId: string }
				| { type: 'ENGAGE_REVIEW_REACHED'; purchaseId: string }
				| { type: 'ENGAGE_FILL_RUN_ENDED' },
			callback?: (
				response?:
					| { ok: true; purchase: PurchaseRequest }
					| { ok: true; message: string }
					| { ok: false; message: string }
			) => void
		): void;
		onMessage: {
			addListener(
				callback: (
					message: ExtensionMessage,
					sender: unknown,
					sendResponse: (response: ExtensionResponse) => void
				) => boolean | void
			): void;
		};
	};
};

declare const chrome: ChromeApi;

const FILL_RUN_KEY = 'engageFormFillRun';
const windowState = window as Window & { __engageFormContentLoaded?: boolean };
const runner = createContentRunner({
	pageHeading,
	applyFillPlan,
	clickNextStep,
	sendReviewReached(purchaseId) {
		chrome.runtime.sendMessage({
			type: 'ENGAGE_REVIEW_REACHED',
			purchaseId
		});
	},
	loadFillRun,
	saveFillRun,
	clearFillRun,
	loadPurchaseRequest
});

if (windowState.__engageFormContentLoaded !== true) {
	windowState.__engageFormContentLoaded = true;

	chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
		void runner
			.handleMessage(message)
			.then((result) => {
				showToast(result.message);
				sendResponse(result);
			})
			.catch((error: unknown) => {
				const errorMessage = error instanceof Error ? error.message : 'Unknown fill error.';
				clearFillRun();
				showToast(errorMessage);
				sendResponse({
					ok: false,
					message: errorMessage,
					step: detectStep(pageHeading()),
					filled: 0,
					missed: []
				});
			});
		return true;
	});

	window.setTimeout(() => {
		void resumeFillRun();
	}, 500);
}

async function resumeFillRun() {
	const result = await runner.resumeFillRun();
	if (result === null) return;
	showToast(result.message);
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
	files: {
		filename: string;
		contentType: string;
		storageKey: string;
		dataUrl?: string;
	}[],
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
	files: {
		filename: string;
		contentType: string;
		storageKey: string;
		dataUrl?: string;
	}[],
	dropTarget: HTMLElement
): Promise<FileUploadResult> {
	const transfer = new DataTransfer();

	for (const file of files) {
		const response = await fetch(file.dataUrl ?? chrome.runtime.getURL(file.storageKey));
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
	chrome.runtime.sendMessage({ type: 'ENGAGE_FILL_RUN_ENDED' });
}

function loadPurchaseRequest(purchaseId: string) {
	return new Promise<PurchaseRequest | null>((resolve) => {
		chrome.runtime.sendMessage({ type: 'ENGAGE_GET_READY_PURCHASE', purchaseId }, (response) => {
			if (
				chrome.runtime.lastError !== undefined ||
				response?.ok !== true ||
				!('purchase' in response)
			) {
				resolve(null);
				return;
			}
			resolve(response.purchase);
		});
	});
}

function parseFillRunState(value: unknown): FillRunState | null {
	if (!isRecord(value)) return null;
	const purchaseId =
		typeof value.purchaseId === 'string' ? value.purchaseId : legacyPurchaseId(value);
	if (purchaseId === null) return null;

	return {
		purchaseId,
		filled: typeof value.filled === 'number' ? value.filled : 0,
		pageCount: typeof value.pageCount === 'number' ? value.pageCount : 0
	};
}

function legacyPurchaseId(value: Record<string, unknown>) {
	return isRecord(value.purchase) && typeof value.purchase.id === 'string'
		? value.purchase.id
		: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function showToast(message: string) {
	const existing = document.querySelector('#engage-form-toast');
	existing?.remove();

	const toast = document.createElement('div');
	toast.id = 'engage-form-toast';
	toast.textContent = message;
	toast.style.cssText = [
		'position: fixed',
		'right: 18px',
		'bottom: 18px',
		'z-index: 2147483647',
		'max-width: 320px',
		'padding: 12px 14px',
		'border: 1px solid #171717',
		'border-radius: 8px',
		'background: #fffefa',
		'color: #171717',
		'font: 14px/1.4 system-ui, sans-serif',
		'box-shadow: 0 16px 40px rgb(33 30 24 / 18%)'
	].join(';');

	document.body.append(toast);
	window.setTimeout(() => toast.remove(), 5000);
}
