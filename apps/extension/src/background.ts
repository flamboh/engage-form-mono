import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api.js';
import type { Id } from '../../../convex/_generated/dataModel.js';
import { EXTENSION_TOKEN_KEY } from './storage.ts';

type RuntimeMessage = {
	type: 'ENGAGE_REVIEW_REACHED';
	purchaseId: string;
};

type ChromeApi = {
	runtime: {
		onMessage: {
			addListener(
				callback: (
					message: RuntimeMessage,
					sender: unknown,
					sendResponse: (response: { ok: boolean; message: string }) => void
				) => boolean | void
			): void;
		};
	};
	storage: {
		local: {
			get(
				keys: string[],
				callback: (items: Partial<Record<typeof EXTENSION_TOKEN_KEY, string>>) => void
			): void;
		};
	};
};

declare const chrome: ChromeApi;

const convex = new ConvexHttpClient(readConvexUrl());

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type !== 'ENGAGE_REVIEW_REACHED') return;

	chrome.storage.local.get([EXTENSION_TOKEN_KEY], (items) => {
		const token = items[EXTENSION_TOKEN_KEY];
		if (token === undefined) {
			sendResponse({ ok: false, message: 'Extension not linked.' });
			return;
		}

		void convex
			.mutation(api.extension.markReviewReached, {
				token,
				id: message.purchaseId as Id<'purchaseRequests'>
			})
			.then(() => sendResponse({ ok: true, message: 'Marked review reached.' }))
			.catch((error: unknown) =>
				sendResponse({
					ok: false,
					message: error instanceof Error ? error.message : String(error)
				})
			);
	});

	return true;
});

function readConvexUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_URL for extension.');
	}
	return env;
}
