<script lang="ts">
	import { ConvexClient, ConvexHttpClient } from 'convex/browser';
	import { onMount } from 'svelte';
	import { browser } from 'wxt/browser';
	import { api } from '../../../../../convex/_generated/api';
	import { readConvexUrl, readWebAppUrl } from '../../lib/env';
	import type { ReadyPurchaseRequest, RuntimeMessage, RuntimeResponse } from '../../lib/messages';
	import {
		readConvexTokenFromWebAppStorage,
		type WebAppTokenStorageResponse
	} from '../../lib/web-app-token-storage';

	type DiagnosticEntry = {
		id: number;
		time: string;
		message: string;
		context: string;
	};

	let signedIn = $state(false);
	let email = $state<string | null>(null);
	let status = $state('Loading...');
	let purchases = $state<ReadyPurchaseRequest[]>([]);
	let readyState = $state<'idle' | 'loading' | 'ready' | 'error'>('idle');
	let diagnostics = $state<DiagnosticEntry[]>([]);

	const runtimeTimeoutMs = 5_000;
	const readySubscriptionTimeoutMs = 8_000;
	const webAppUrl = readWebAppUrl();
	const convexUrl = readConvexUrl();
	const convex = new ConvexClient(convexUrl);
	let stopReadySubscription: (() => void) | null = null;
	let stopConnectionStateSubscription: (() => void) | null = null;
	let readySubscriptionTimeout: ReturnType<typeof setTimeout> | null = null;
	let nextDiagnosticId = 0;

	onMount(() => {
		logPopup('popup mounted', {
			convexOrigin: new URL(convexUrl).origin,
			webAppOrigin: new URL(webAppUrl).origin
		});
		void refreshAuth();
		return () => {
			stopRealtime();
			void convex.close();
		};
	});

	async function refreshAuth() {
		status = 'Loading...';
		logPopup('auth refresh start');
		const response = await sendRuntimeMessage({ type: 'AUTH_STATE' });
		if (!response.ok) {
			logPopup('auth refresh failed', { message: response.message });
			status = response.message;
			return;
		}
		if (!('signedIn' in response)) return;

		signedIn = response.signedIn;
		email = response.email;
		logPopup('auth refresh complete', { signedIn, emailPresent: email !== null });
		if (!signedIn) {
			stopRealtime();
			purchases = [];
			readyState = 'idle';
			status = 'Sign in to continue.';
			return;
		}

		status = 'Loading ready purchase requests...';
		startRealtime();
	}

	function openSignIn() {
		status = 'Finish sign-in in the browser, then reopen this popup.';
		void browser.tabs.create({ url: `${webAppUrl}/app` });
	}

	async function signOut() {
		status = 'Signing out...';
		const response = await sendRuntimeMessage({ type: 'SIGN_OUT' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		await refreshAuth();
	}

	function startRealtime() {
		if (stopReadySubscription !== null) {
			logPopup('ready subscription already active');
			return;
		}

		readyState = 'loading';
		logPopup('ready subscription start');
		convex.setAuth(fetchConvexToken);
		startConnectionStateLogging();
		void runReadyHttpCheck('startup');
		const subscription = convex.onUpdate(
			api.authed.extension.listReadyPurchases,
			{},
			(rows) => {
				clearReadySubscriptionTimeout();
				logPopup('ready subscription update', { count: rows.length });
				purchases = rows;
				readyState = 'ready';
				status =
					rows.length === 0 ? 'No ready purchase requests yet.' : 'Ready requests update live.';
			},
			(error) => {
				clearReadySubscriptionTimeout();
				logPopup('ready subscription error', { message: error.message });
				readyState = 'error';
				status = error.message;
			}
		);
		stopReadySubscription = subscription.unsubscribe;
		startReadySubscriptionTimeout();
	}

	function stopRealtime() {
		clearReadySubscriptionTimeout();
		stopConnectionStateSubscription?.();
		stopConnectionStateSubscription = null;
		stopReadySubscription?.();
		stopReadySubscription = null;
	}

	async function fetchConvexToken() {
		logPopup('convex token request start');
		const webToken = await fetchWebAppConvexToken();
		if (webToken !== null) return webToken;

		const response = await sendRuntimeMessage({ type: 'GET_CONVEX_TOKEN' });
		if (response.ok && 'token' in response) {
			logPopup('convex token request complete', { tokenPresent: response.token !== null });
			if (response.token === null) throw new Error('Signed in session missing Convex token.');
			return response.token;
		}
		if (!response.ok) throw new Error(response.message);
		throw new Error('Background did not return a Convex token.');
	}

	async function fetchWebAppConvexToken() {
		const webAppOrigin = new URL(webAppUrl).origin;
		logPopup('web app token request start', { origin: webAppOrigin });
		try {
			const tabs = await browser.tabs.query({ url: `${webAppOrigin}/*` });
			const tab = tabs.find((candidate) => typeof candidate.id === 'number');
			if (!tab?.id) {
				logPopup('web app token request skipped', { reason: 'no-app-tab' });
				return null;
			}

			const [{ result }] = await withTimeout(
				browser.scripting.executeScript({
					target: { tabId: tab.id },
					world: 'MAIN',
					func: readConvexTokenFromWebAppStorage,
					args: [120_000]
				}),
				`Web app token bridge did not respond within ${runtimeTimeoutMs / 1_000}s.`,
				runtimeTimeoutMs
			);
			if (!isWebTokenResponse(result)) {
				logPopup('web app token request failed', {
					message: 'Invalid web app token response.'
				});
				return null;
			}
			if (!result.ok) {
				logPopup('web app token request failed', { message: result.message });
				return null;
			}
			logPopup('web app token request complete', { tokenPresent: result.token !== null });
			return result.token;
		} catch (error) {
			logPopup('web app token request failed', {
				message: error instanceof Error ? error.message : String(error)
			});
			return null;
		}
	}

	async function sendRuntimeMessage(message: RuntimeMessage) {
		logPopup('runtime message start', { type: message.type });
		try {
			const response = await withTimeout(
				browser.runtime.sendMessage(message).then((value) => {
					return (value as RuntimeResponse | undefined) ?? extensionNoResponse();
				}),
				`${message.type} did not respond within ${runtimeTimeoutMs / 1_000}s.`,
				runtimeTimeoutMs
			);
			logPopup('runtime message complete', summarizeResponse(response));
			return response;
		} catch (error) {
			const response = {
				ok: false,
				message: error instanceof Error ? error.message : String(error)
			} as const;
			logPopup('runtime message failed', { type: message.type, message: response.message });
			return response;
		}
	}

	function extensionNoResponse(): RuntimeResponse {
		return { ok: false, message: 'Extension did not respond.' };
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(value);
	}

	function reviewStatus(purchase: ReadyPurchaseRequest) {
		if (purchase.lastFilledAt === null) return 'Not reviewed';
		return `Review reached ${new Date(purchase.lastFilledAt).toLocaleDateString()}`;
	}

	function startReadySubscriptionTimeout() {
		clearReadySubscriptionTimeout();
		readySubscriptionTimeout = setTimeout(() => {
			if (readyState !== 'loading') return;
			readyState = 'error';
			status = 'Timed out waiting for ready purchase requests. Check Convex and extension logs.';
			logPopup('ready subscription timeout');
			void runReadyHttpCheck('realtime-timeout');
		}, readySubscriptionTimeoutMs);
	}

	function clearReadySubscriptionTimeout() {
		if (readySubscriptionTimeout === null) return;
		clearTimeout(readySubscriptionTimeout);
		readySubscriptionTimeout = null;
	}

	function startConnectionStateLogging() {
		stopConnectionStateSubscription?.();
		logPopup('convex connection state', summarizeConnectionState(convex.connectionState()));
		stopConnectionStateSubscription = convex.subscribeToConnectionState((connectionState) => {
			logPopup('convex connection state', summarizeConnectionState(connectionState));
		});
	}

	async function runReadyHttpCheck(reason: string) {
		logPopup('ready http check start', { reason });
		try {
			const token = await fetchConvexToken();
			const http = new ConvexHttpClient(convexUrl);
			http.setAuth(token);
			const rows = await withTimeout(
				http.query(api.authed.extension.listReadyPurchases, {}),
				`HTTP ready purchase check did not respond within ${runtimeTimeoutMs / 1_000}s.`,
				runtimeTimeoutMs
			);
			logPopup('ready http check complete', { reason, count: rows.length });
		} catch (error) {
			logPopup('ready http check failed', {
				reason,
				message: error instanceof Error ? error.message : String(error)
			});
		}
	}

	function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs: number) {
		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
			promise.then(resolve, reject).finally(() => clearTimeout(timeout));
		});
	}

	function logPopup(message: string, context: Record<string, unknown> = {}) {
		diagnostics = [
			...diagnostics,
			{
				id: nextDiagnosticId++,
				time: new Date().toLocaleTimeString(),
				message,
				context: formatDiagnosticContext(context)
			}
		].slice(-12);
		console.info('[Engage Form][popup]', message, context);
	}

	function formatDiagnosticContext(context: Record<string, unknown>) {
		const entries = Object.entries(context);
		if (entries.length === 0) return '';
		return entries.map(([key, value]) => `${key}=${formatDiagnosticValue(value)}`).join(' ');
	}

	function formatDiagnosticValue(value: unknown) {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value === 'string') return value.length > 80 ? `${value.slice(0, 77)}...` : value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		const json = JSON.stringify(value);
		return json.length > 80 ? `${json.slice(0, 77)}...` : json;
	}

	function summarizeConnectionState(connectionState: ReturnType<ConvexClient['connectionState']>) {
		return {
			hasEverConnected: connectionState.hasEverConnected,
			isWebSocketConnected: connectionState.isWebSocketConnected,
			connectionRetries: connectionState.connectionRetries,
			timeOfOldestInflightRequest:
				connectionState.timeOfOldestInflightRequest?.toISOString() ?? null
		};
	}

	function summarizeResponse(response: RuntimeResponse) {
		if (!response.ok) return { ok: false, message: response.message };
		if ('token' in response) return { ok: true, tokenPresent: response.token !== null };
		if ('signedIn' in response)
			return { ok: true, signedIn: response.signedIn, emailPresent: response.email !== null };
		return { ok: true, message: response.message };
	}

	function isWebTokenResponse(value: unknown): value is WebTokenResponse {
		if (typeof value !== 'object' || value === null) return false;
		if (!('ok' in value) || typeof value.ok !== 'boolean') return false;
		if (value.ok)
			return 'token' in value && (typeof value.token === 'string' || value.token === null);
		return 'message' in value && typeof value.message === 'string';
	}

	type WebTokenResponse = WebAppTokenStorageResponse;
</script>

<main class="min-w-80 bg-stone-50 text-stone-950">
	<section class="border-b border-stone-200 bg-white px-5 py-4">
		<p class="text-xs font-medium tracking-wide text-stone-400 uppercase">Engage Form</p>
		<h1 class="mt-1 text-lg font-semibold">{signedIn ? 'Extension' : 'Sign in'}</h1>
	</section>

	<section class="space-y-3 px-5 py-5">
		<p class="text-sm text-stone-600">{status}</p>

		{#if signedIn}
			{#if email !== null}
				<p class="text-xs text-stone-500">{email}</p>
			{/if}

			<section class="space-y-2">
				{#if readyState === 'loading'}
					<p class="text-sm text-stone-600">Loading ready purchase requests...</p>
				{:else if readyState === 'error'}
					<p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{status}
					</p>
				{:else if purchases.length === 0}
					<p class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600">
						No ready purchase requests.
					</p>
				{:else}
					{#each purchases as purchase (purchase.id)}
						<article class="rounded-md border border-stone-200 bg-white p-3">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-xs font-medium text-stone-500">{purchase.organization}</p>
									<h2 class="mt-0.5 text-sm font-semibold text-stone-950">
										{purchase.itemDescription || 'Untitled purchase request'}
									</h2>
								</div>
								<strong class="text-sm text-stone-950 tabular-nums">
									{money(purchase.totalAmount)}
								</strong>
							</div>
							<p class="mt-2 text-xs text-stone-600">
								{purchase.purchaser} · {reviewStatus(purchase)}
							</p>
						</article>
					{/each}
				{/if}
			</section>

			<div class="flex gap-2">
				<button
					class="inline-flex rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
					type="button"
					onclick={() => browser.tabs.create({ url: `${webAppUrl}/app` })}
				>
					Open app
				</button>
				<button
					class="inline-flex rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
					type="button"
					onclick={signOut}
				>
					Sign out
				</button>
			</div>
		{:else}
			<button
				class="inline-flex rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
				type="button"
				onclick={openSignIn}
			>
				Sign in on web
			</button>
		{/if}

		<section class="rounded-md border border-stone-200 bg-white p-3">
			<h2 class="text-xs font-semibold tracking-wide text-stone-500 uppercase">Diagnostics</h2>
			<div class="mt-2 max-h-44 space-y-1 overflow-y-auto font-mono text-[11px] text-stone-600">
				{#each diagnostics as entry (entry.id)}
					<p class="break-words">
						<span class="text-stone-400">{entry.time}</span>
						<span class="text-stone-900">{entry.message}</span>
						{#if entry.context}
							<span>{entry.context}</span>
						{/if}
					</p>
				{/each}
			</div>
		</section>
	</section>
</main>
