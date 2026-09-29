<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from 'wxt/browser';
	import { readWebAppUrl } from '../../lib/env';
	import {
		isAuthRequired,
		type ReadyPurchaseRequest,
		type RuntimeMessage,
		type RuntimeResponse
	} from '../../lib/messages';
	import type { PendingFill } from '../../lib/pending-fill';
	import { withTimeout } from '../../lib/timeout';

	let signedIn = $state(false);
	let status = $state('Loading…');
	let purchases = $state<ReadyPurchaseRequest[] | null>(null);
	let pendingFill = $state<PendingFill | null>(null);
	let fillingPurchaseId = $state<string | null>(null);

	const runtimeTimeoutMs = 20_000;
	const webAppUrl = readWebAppUrl();

	onMount(() => {
		void refresh();
	});

	async function refresh() {
		const response = await sendRuntimeMessage({ type: 'AUTH_STATE' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		if (!('signedIn' in response)) return;

		signedIn = response.signedIn;
		status = '';
		if (!signedIn) {
			purchases = null;
			pendingFill = null;
			return;
		}

		const [ready, pending] = await Promise.all([
			sendRuntimeMessage({ type: 'LIST_READY' }),
			sendRuntimeMessage({ type: 'GET_PENDING_FILL' })
		]);
		if (isAuthRequired(ready)) {
			signedIn = false;
			return;
		}
		if (ready.ok && 'purchases' in ready) purchases = ready.purchases;
		else if (!ready.ok) status = ready.message;
		if (pending.ok && 'pendingFillState' in pending && pending.pendingFillState.signedIn) {
			pendingFill = pending.pendingFillState.pendingFill;
		}
	}

	async function fillPurchase(purchaseId: string) {
		fillingPurchaseId = purchaseId;
		status = 'Filling the open Engage tab…';
		const response = await sendRuntimeMessage({ type: 'START_FILL', purchaseId });
		status = response.ok ? '' : response.message;
		fillingPurchaseId = null;
	}

	async function cancelPendingFill(purchaseRequestId: string) {
		const response = await sendRuntimeMessage({
			type: 'CLEAR_PENDING_FILL',
			purchaseId: purchaseRequestId
		});
		if (!response.ok) status = response.message;
		await refresh();
	}

	async function signOut() {
		const response = await sendRuntimeMessage({ type: 'SIGN_OUT' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		await refresh();
	}

	async function connect() {
		const response = await sendRuntimeMessage({ type: 'CONNECT' });
		if (!response.ok) status = response.message;
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
				Disconnect
			</button>
		{/if}
	</header>

	<section class="space-y-3 p-4">
		{#if status}
			<p class="text-sm text-stone-600">{status}</p>
		{/if}

		{#if !signedIn}
			<p class="text-sm text-stone-600">
				Connect the extension to your Engage Form account. It opens Engage Form, where you're
				already signed in.
			</p>
			<button
				class="rounded-md bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
				type="button"
				onclick={connect}
			>
				Connect the extension
			</button>
		{:else}
			{#if pendingFill !== null}
				{@const pending = pendingFill}
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
				<span>Extension connected</span>
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
