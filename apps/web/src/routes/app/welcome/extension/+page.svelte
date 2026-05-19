<script lang="ts">
	import { goto } from '$app/navigation';

	function done() {
		void goto('/app/welcome/done');
	}
</script>

<div class="space-y-5">
	<header>
		<h2 class="text-lg font-semibold">Chrome extension</h2>
		<p class="mt-1 text-sm text-stone-500">
			The extension uses the same Clerk session as the web app and shows ready purchase requests
			automatically.
		</p>
	</header>

	<ol class="space-y-3 text-sm">
		<li>
			<span class="font-medium">1. Install the extension.</span>
			<p class="text-stone-500">Ask your team lead for the install link.</p>
		</li>
		<li>
			<span class="font-medium">2. Sign in from the extension popup.</span>
			<p class="text-stone-500">Choose Sign in on web for OAuth.</p>
		</li>
		<li>
			<span class="font-medium">3. Select a ready purchase request in Engage.</span>
			<p class="text-stone-500">No token or manual sync is required.</p>
		</li>
	</ol>

	<button class="button" type="button" onclick={done}>Continue</button>
</div>

<style>
	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
</style>
