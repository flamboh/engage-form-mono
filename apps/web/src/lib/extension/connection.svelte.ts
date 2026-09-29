import { api } from '$convex/_generated/api';
import type { Id } from '$convex/_generated/dataModel';
import type { ConvexClient } from 'convex/browser';
import { createContext } from 'svelte';
import { sendToExtension, type ExtensionStatus } from './bridge';

export type ExtensionState = 'checking' | 'missing' | 'connected' | 'disconnected';

type ActiveSession = { id: Id<'extensionSessions'> };

export class ExtensionConnection {
	status = $state<ExtensionStatus | null>(null);
	checked = $state(false);
	busy = $state(false);
	error = $state('');
	private autoConnectTried = false;

	constructor(private readonly client: ConvexClient) {}

	state(sessions: ActiveSession[] | undefined): ExtensionState {
		if (!this.checked) return 'checking';
		if (this.status === null) return 'missing';
		if (sessions === undefined) return 'checking';
		return this.status.connected &&
			sessions.some((session) => session.id === this.status?.sessionId)
			? 'connected'
			: 'disconnected';
	}

	async refresh() {
		this.status = await sendToExtension({ type: 'STATUS' });
		this.checked = true;
	}

	async autoConnect(sessions: ActiveSession[]) {
		if (this.autoConnectTried || this.busy) return;
		this.autoConnectTried = true;
		await this.refresh();
		if (this.status === null || this.status.signedOut) return;
		if (this.state(sessions) === 'connected') return;
		await this.connect();
	}

	async connect() {
		if (this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			const minted = await this.client.action(api.authed.extensionSessions.connectExtension, {
				label: 'Chrome extension'
			});
			const status = await sendToExtension({
				type: 'CONNECT',
				token: minted.token,
				sessionId: minted.sessionId
			});
			if (status === null) {
				await this.client.mutation(api.authed.extensionSessions.disconnectExtension, {
					sessionId: minted.sessionId
				});
				this.error = 'The extension didn’t answer. Reload this page and try again.';
			}
			this.status = status;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.busy = false;
		}
	}

	async disconnect(sessionId: Id<'extensionSessions'>) {
		if (this.busy) return;
		this.busy = true;
		this.error = '';
		try {
			await this.client.mutation(api.authed.extensionSessions.disconnectExtension, { sessionId });
			if (this.status?.sessionId === sessionId) {
				this.status = await sendToExtension({ type: 'DISCONNECT' });
			}
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.busy = false;
		}
	}
}

const [getContext, setContext] = createContext<ExtensionConnection>();

export function setExtensionConnection(client: ConvexClient) {
	return setContext(new ExtensionConnection(client));
}

export function getExtensionConnection() {
	return getContext();
}
