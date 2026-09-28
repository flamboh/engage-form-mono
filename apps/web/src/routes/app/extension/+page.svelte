<script lang="ts">
	import AppShell from '$lib/app/AppShell.svelte';
	import ExtensionSteps from '$lib/app/ExtensionSteps.svelte';
</script>

<svelte:head>
	<title>Chrome extension · Engage Form</title>
</svelte:head>

<AppShell>
	<main class="mx-auto flex max-w-xl flex-col gap-8 px-4 pt-10 pb-16 sm:px-6">
		<div class="flex flex-col gap-2">
			<h1 class="text-2xl font-semibold tracking-tight">Chrome extension</h1>
			<p class="text-sm text-stone-600">
				The extension is what types your request into Engage. Set it up once on the computer you use
				for Engage.
			</p>
		</div>
		<ExtensionSteps />
	</main>
</AppShell>
