<script lang="ts">
	type Props = {
		saveState: string;
		onDiscard: () => Promise<void>;
	};

	let { saveState, onDiscard }: Props = $props();
</script>

<header class="sticky top-0 z-10 border-b border-stone-200 bg-white">
	<div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
		<div class="flex items-center gap-3">
			<a class="text-sm text-stone-500 hover:text-stone-900" href="/app">Back</a>
			<h1 class="text-lg font-semibold">Purchase Request Builder</h1>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-xs text-stone-500">{saveState}</span>
			<button
				class="rounded-md px-3 py-2 text-sm hover:bg-stone-100"
				type="button"
				onclick={onDiscard}
			>
				Discard
			</button>
		</div>
	</div>
</header>
