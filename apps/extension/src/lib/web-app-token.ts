import { browser } from 'wxt/browser';
import { isTokenUsable } from './convex-token';
import { withTimeout } from './timeout';
import {
	readConvexTokenFromWebAppStorage,
	type WebAppTokenStorageResponse
} from './web-app-token-storage';

const bridgeTimeoutMs = 5_000;
const maxTokenAgeMs = 120_000;

export async function readWebAppConvexToken(webAppUrl: string) {
	try {
		const tabs = await browser.tabs.query({ url: `${new URL(webAppUrl).origin}/*` });
		const tab = tabs.find((candidate) => typeof candidate.id === 'number');
		if (tab?.id === undefined) return null;

		const [injection] = await withTimeout(
			browser.scripting.executeScript({
				target: { tabId: tab.id },
				world: 'MAIN',
				func: readConvexTokenFromWebAppStorage,
				args: [maxTokenAgeMs]
			}),
			`Web app token bridge did not respond within ${bridgeTimeoutMs / 1_000}s.`,
			bridgeTimeoutMs
		);
		const result: unknown = injection?.result;
		if (!isWebTokenResponse(result) || !result.ok) return null;
		return isTokenUsable(result.token, Date.now()) ? result.token : null;
	} catch {
		return null;
	}
}

function isWebTokenResponse(value: unknown): value is WebAppTokenStorageResponse {
	if (typeof value !== 'object' || value === null) return false;
	if (!('ok' in value) || typeof value.ok !== 'boolean') return false;
	if (value.ok)
		return 'token' in value && (typeof value.token === 'string' || value.token === null);
	return 'message' in value && typeof value.message === 'string';
}
