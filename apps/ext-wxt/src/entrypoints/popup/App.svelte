<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from 'wxt/browser';
	import { readWebAppUrl } from '../../lib/env';
	import type { RuntimeMessage, RuntimeResponse } from '../../lib/messages';

	let signedIn = $state(false);
	let email = $state<string | null>(null);
	let status = $state('Loading...');

	const webAppUrl = readWebAppUrl();

	onMount(() => {
		void refreshAuth();
	});

	async function refreshAuth() {
		status = 'Loading...';
		const response = await sendRuntimeMessage({ type: 'AUTH_STATE' });
		if (!response.ok) {
			status = response.message;
			return;
		}
		if (!('signedIn' in response)) return;

		signedIn = response.signedIn;
		email = response.email;
		status = signedIn ? 'Signed in.' : 'Sign in to continue.';
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

	function sendRuntimeMessage(message: RuntimeMessage) {
		return new Promise<RuntimeResponse>((resolve) => {
			void browser.runtime
				.sendMessage(message)
				.then((response) =>
					resolve((response as RuntimeResponse | undefined) ?? extensionNoResponse())
				)
				.catch((error: unknown) =>
					resolve({ ok: false, message: error instanceof Error ? error.message : String(error) })
				);
		});
	}

	function extensionNoResponse(): RuntimeResponse {
		return { ok: false, message: 'Extension did not respond.' };
	}
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
	</section>
</main>
