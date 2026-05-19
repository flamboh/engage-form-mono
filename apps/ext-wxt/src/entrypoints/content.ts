import type { PurchaseRequest } from '@engage-form/domain';
import { detectStep, type FillAction } from '@engage-form/fill-engine';
import { browser } from 'wxt/browser';
import { createContentRunner } from '../lib/content-runner';
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
import type { FillMessage, FillResponse } from '../lib/messages';

const FILL_RUN_KEY = 'engageFormFillRun';

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

		browser.runtime.onMessage.addListener((message) => {
			return runner
				.handleMessage(message as FillMessage)
				.then((response) => {
					showToast(response.message);
					return response;
				})
				.catch((error: unknown) => {
					const messageText = error instanceof Error ? error.message : 'Unknown fill error.';
					const response: FillResponse = {
						ok: false,
						message: messageText,
						step: detectStep(pageHeading()),
						filled: 0,
						missed: []
					};
					showToast(response.message);
					return response;
				});
		});

		window.setTimeout(() => {
			void runner.resumeFillRun().then((response) => {
				if (response !== null) showToast(response.message);
			});
		}, 500);
	}
});

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

function saveFillRun(state: { purchaseId: string; filled: number; pageCount: number }) {
	window.sessionStorage.setItem(FILL_RUN_KEY, JSON.stringify(state));
}

function clearFillRun() {
	window.sessionStorage.removeItem(FILL_RUN_KEY);
	void browser.runtime.sendMessage({ type: 'FILL_RUN_ENDED' });
}

async function loadPurchaseRequest(purchaseId: string) {
	const response = (await browser.runtime.sendMessage({
		type: 'GET_FILL_PAYLOAD',
		purchaseId
	})) as { ok: true; purchase: PurchaseRequest } | { ok: false; message: string } | undefined;

	return response?.ok === true && 'purchase' in response ? response.purchase : null;
}

function parseFillRunState(value: unknown) {
	if (!isRecord(value) || typeof value.purchaseId !== 'string') return null;
	return {
		purchaseId: value.purchaseId,
		filled: typeof value.filled === 'number' ? value.filled : 0,
		pageCount: typeof value.pageCount === 'number' ? value.pageCount : 0
	};
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
