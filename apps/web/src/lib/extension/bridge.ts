import { extensionId } from '$convex/extensionTokens';

export type ExtensionStatus = {
	connected: boolean;
	sessionId: string | null;
	signedOut: boolean;
};

type ExtensionMessage =
	| { type: 'STATUS' }
	| { type: 'CONNECT'; token: string; sessionId: string }
	| { type: 'DISCONNECT' };

type ChromeRuntime = {
	lastError?: { message?: string };
	sendMessage(id: string, message: ExtensionMessage, callback: (response: unknown) => void): void;
};

const replyTimeoutMs = 3_000;

export function sendToExtension(message: ExtensionMessage): Promise<ExtensionStatus | null> {
	const runtime = (globalThis as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;
	if (typeof runtime?.sendMessage !== 'function') return Promise.resolve(null);

	return new Promise((resolve) => {
		const timeout = setTimeout(() => resolve(null), replyTimeoutMs);
		try {
			runtime.sendMessage(extensionId, message, (response) => {
				clearTimeout(timeout);
				resolve(runtime.lastError === undefined ? statusFrom(response) : null);
			});
		} catch {
			clearTimeout(timeout);
			resolve(null);
		}
	});
}

function statusFrom(response: unknown): ExtensionStatus | null {
	if (typeof response !== 'object' || response === null) return null;
	const value = response as Record<string, unknown>;
	if (value.ok !== true || typeof value.connected !== 'boolean') return null;
	return {
		connected: value.connected,
		sessionId: typeof value.sessionId === 'string' ? value.sessionId : null,
		signedOut: value.signedOut === true
	};
}
