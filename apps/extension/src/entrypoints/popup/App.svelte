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

	function title(purchase: ReadyPurchaseRequest) {
		return purchase.vendor.trim() || purchase.itemDescription.trim() || 'Untitled request';
	}

	function money(value: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
	}
</script>

<main class="w-80 bg-paper font-sans text-ink">
	<header class="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
		<h1 class="text-sm font-[650] tracking-tight text-pine">Engage Form</h1>
		{#if signedIn}
			<button
				class="text-xs text-quiet underline underline-offset-3 hover:text-ink"
				type="button"
				onclick={signOut}
			>
				Disconnect
			</button>
		{/if}
	</header>

	<section class="flex flex-col gap-3 p-4">
		{#if status}
			<p class="text-sm text-quiet">{status}</p>
		{/if}

		{#if !signedIn}
			<p class="text-sm text-quiet">
				Connect the extension to your Engage Form account. It opens Engage Form, where you’re
				already signed in.
			</p>
			<button
				class="inline-flex min-h-[42px] items-center justify-center self-start bg-pine px-[18px] text-sm font-semibold text-white hover:bg-pine-deep"
				type="button"
				onclick={connect}
			>
				Connect the extension
			</button>
		{:else}
			{#if pendingFill !== null}
				{@const pending = pendingFill}
				<div class="border border-marker-deep bg-marker-soft p-3">
					<p class="flex items-center gap-1.5 text-xs font-medium text-ink">
						<span class="size-[7px] animate-pulse bg-marker-deep" aria-hidden="true"></span>
						Waiting for Engage
					</p>
					<p class="mt-1 text-sm font-semibold">{pending.label}</p>
					<div class="mt-2 flex gap-4 text-sm">
						<button
							class="font-semibold text-ink underline underline-offset-3"
							type="button"
							onclick={() => openTab(pending.engageUrl)}
						>
							Open Engage
						</button>
						<button
							class="text-quiet underline underline-offset-3 hover:text-ink"
							type="button"
							onclick={() => cancelPendingFill(pending.purchaseRequestId)}
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}

			{#if purchases === null}
				<p class="text-sm text-quiet">Loading…</p>
			{:else if purchases.length === 0}
				<p class="text-sm text-quiet">
					<b class="font-semibold text-ink">Nothing ready to fill.</b> Press Fill on Engage on a request
					in the web app.
				</p>
			{:else}
				<div class="flex flex-col">
					<p class="border-b border-ink pb-2 text-xs text-quiet">Fill the open Engage tab with</p>
					{#each purchases as purchase (purchase.id)}
						<button
							class="flex w-full items-start justify-between gap-3 border-b border-line bg-surface px-3 py-2.5 text-left hover:bg-pine-soft disabled:opacity-60"
							type="button"
							disabled={fillingPurchaseId !== null}
							onclick={() => fillPurchase(purchase.id)}
						>
							<span class="min-w-0">
								<span class="block truncate text-sm font-semibold">{title(purchase)}</span>
								<span class="block truncate text-xs text-quiet">
									{purchase.vendor.trim() && purchase.itemDescription.trim()
										? `${purchase.itemDescription} · ${purchase.organization}`
										: purchase.organization}
								</span>
								<span
									class="mt-1.5 inline-flex h-5 items-center gap-1.5 border px-1.5 text-[11.5px] font-medium {purchase.lastFilledAt
										? 'border-pine text-pine-deep'
										: 'border-pine bg-pine-soft text-pine-deep'}"
								>
									<span
										class="size-[6px] {purchase.lastFilledAt
											? 'border-[1.5px] border-pine'
											: 'bg-current'}"
										aria-hidden="true"
									></span>
									{purchase.lastFilledAt ? 'Filled' : 'Ready'}
								</span>
							</span>
							<span class="text-sm tabular-nums">{money(purchase.totalAmount)}</span>
						</button>
					{/each}
				</div>
			{/if}

			<div class="flex items-center justify-between text-xs text-quiet">
				<span class="inline-flex items-center gap-1.5">
					<span class="size-2 rounded-full bg-ok" aria-hidden="true"></span>
					Extension connected
				</span>
				<button
					class="underline underline-offset-3 hover:text-ink"
					type="button"
					onclick={() => openTab(`${webAppUrl}/app`)}
				>
					Open app
				</button>
			</div>
		{/if}
	</section>
</main>
