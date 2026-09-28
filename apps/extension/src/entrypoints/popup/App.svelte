<script lang="ts">
	import { ConvexClient } from 'convex/browser';
	import { onMount } from 'svelte';
	import { browser } from 'wxt/browser';
	import { api } from '../../../../../convex/_generated/api';
	import type { Id } from '../../../../../convex/_generated/dataModel';
	import { readConvexUrl, readWebAppUrl } from '../../lib/env';
	import type { ReadyPurchaseRequest, RuntimeMessage, RuntimeResponse } from '../../lib/messages';
	import { isPendingFillFresh, type PendingFill } from '../../lib/pending-fill';
	import { withTimeout } from '../../lib/timeout';

	let signedIn = $state(false);
	let email = $state<string | null>(null);
	let status = $state('Loading…');
	let purchases = $state<ReadyPurchaseRequest[] | null>(null);
	let pendingFill = $state<PendingFill | null>(null);
	let fillingPurchaseId = $state<string | null>(null);

	const runtimeTimeoutMs = 5_000;
	const webAppUrl = readWebAppUrl();
	const convex = new ConvexClient(readConvexUrl());
	const subscriptions: (() => void)[] = [];
	const freshPendingFill = $derived(
		pendingFill !== null && isPendingFillFresh(pendingFill, Date.now()) ? pendingFill : null
	);

	onMount(() => {
		void refreshAuth();
		return () => {
			stopRealtime();
			void convex.close();
		};
	});

	async function refreshAuth() {
		const response = await sendRuntimeMessage({ type: 'AUTH_STATE' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		if (!('signedIn' in response)) return;

		signedIn = response.signedIn;
		email = response.email;
		if (!signedIn) {
			stopRealtime();
			purchases = null;
			pendingFill = null;
			status = '';
			return;
		}

		status = '';
		startRealtime();
	}

	function startRealtime() {
		if (subscriptions.length > 0) return;
		convex.setAuth(fetchConvexToken);
		subscriptions.push(
			convex.onUpdate(
				api.authed.extension.listReadyPurchases,
				{},
				(rows) => {
					purchases = rows;
				},
				(error) => {
					status = error.message;
				}
			).unsubscribe,
			convex.onUpdate(
				api.authed.extension.getPendingFill,
				{},
				(value) => {
					pendingFill = value;
				},
				(error) => {
					status = error.message;
				}
			).unsubscribe
		);
	}

	function stopRealtime() {
		for (const unsubscribe of subscriptions.splice(0)) unsubscribe();
	}

	async function fetchConvexToken() {
		const response = await sendRuntimeMessage({ type: 'GET_CONVEX_TOKEN' });
		if (!response.ok) throw new Error(response.message);
		if (!('token' in response)) throw new Error('Background did not return a Convex token.');
		if (response.token === null) throw new Error('Signed in session missing Convex token.');
		return response.token;
	}

	async function fillPurchase(purchaseId: string) {
		fillingPurchaseId = purchaseId;
		status = 'Filling the open Engage tab…';
		try {
			const token = await fetchConvexToken();
			const response = await sendRuntimeMessage({ type: 'START_FILL', purchaseId, token });
			status = response.ok ? '' : response.message;
		} catch (error) {
			status = error instanceof Error ? error.message : String(error);
		} finally {
			fillingPurchaseId = null;
		}
	}

	async function cancelPendingFill(purchaseRequestId: string) {
		await convex.mutation(api.authed.extension.clearPendingFill, {
			purchaseRequestId: purchaseRequestId as Id<'purchaseRequests'>
		});
	}

	async function signOut() {
		const response = await sendRuntimeMessage({ type: 'SIGN_OUT' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		await refreshAuth();
	}

	function openTab(url: string) {
		void browser.tabs.create({ url });
	}

	async function sendRuntimeMessage(message: RuntimeMessage): Promise<RuntimeResponse> {
		try {
			return await withTimeout(
				browser.runtime.sendMessage(message).then(
					(value) =>
						(value as RuntimeResponse | undefined) ?? {
							ok: false,
							message: 'Extension did not respond.'
						}
				),
				`${message.type} did not respond within ${runtimeTimeoutMs / 1_000}s.`,
				runtimeTimeoutMs
			);
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
</script>

<main class="w-80 bg-stone-50 font-sans text-stone-950">
	<header class="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-3">
		<h1 class="text-sm font-semibold">Engage Form</h1>
		{#if signedIn}
			<button class="text-xs text-stone-500 hover:text-stone-900" type="button" onclick={signOut}>
				Sign out
			</button>
		{/if}
	</header>

	<section class="space-y-3 p-4">
		{#if status}
			<p class="text-sm text-stone-600">{status}</p>
		{/if}

		{#if !signedIn}
			<p class="text-sm text-stone-600">Sign in on the web app, then reopen this popup.</p>
			<button
				class="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
				type="button"
				onclick={() => openTab(`${webAppUrl}/app`)}
			>
				Sign in
			</button>
		{:else}
			{#if freshPendingFill !== null}
				{@const pending = freshPendingFill}
				<div class="rounded-md border border-stone-900 bg-white p-3">
					<p class="text-xs text-stone-500">Waiting for Engage</p>
					<p class="mt-0.5 text-sm font-semibold">{pending.label}</p>
					<div class="mt-2 flex gap-3 text-sm">
						<button
							class="font-medium underline"
							type="button"
							onclick={() => openTab(pending.engageUrl)}
						>
							Open Engage
						</button>
						<button
							class="text-stone-500 hover:text-stone-900"
							type="button"
							onclick={() => cancelPendingFill(pending.purchaseRequestId)}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			{#if purchases === null}
				<p class="text-sm text-stone-500">Loading…</p>
			{:else if purchases.length === 0}
				<p class="text-sm text-stone-600">
					No ready purchase requests. Use <strong>Fill on Engage</strong> in the web app.
				</p>
			{:else}
				<div class="space-y-2">
					<p class="text-xs text-stone-500">Fill the open Engage tab with:</p>
					{#each purchases as purchase (purchase.id)}
						<button
							class="flex w-full items-start justify-between gap-3 rounded-md border border-stone-200 bg-white p-3 text-left hover:bg-stone-100 disabled:opacity-60"
							type="button"
							disabled={fillingPurchaseId !== null}
							onclick={() => fillPurchase(purchase.id)}
						>
							<span>
								<span class="block text-sm font-medium">
									{purchase.itemDescription || 'Untitled purchase request'}
								</span>
								<span class="block text-xs text-stone-500">{purchase.organization}</span>
							</span>
							<span class="text-sm tabular-nums">{money(purchase.totalAmount)}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex items-center justify-between text-xs text-stone-500">
				<span class="truncate">{email ?? ''}</span>
				<button
					class="hover:text-stone-900"
					type="button"
					onclick={() => openTab(`${webAppUrl}/app`)}
				>
					Open app
				</button>
			</div>
		{/if}
	</section>
</main>
