<script lang="ts">
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		documentCount,
		ondeleted
	}: {
		editor: RequestEditor;
		documentCount: number;
		ondeleted: () => void | Promise<void>;
	} = $props();

	let menu = $state<HTMLDetailsElement | null>(null);
	let confirming = $state(false);
	let deleting = $state(false);

	async function remove() {
		deleting = true;
		const deleted = await editor.discard();
		if (deleted) {
			await ondeleted();
			return;
		}
		deleting = false;
		confirming = false;
	}

	function closeOnOutside(event: MouseEvent) {
		if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
			menu.open = false;
			confirming = false;
		}
	}
</script>

<svelte:window onclick={closeOnOutside} />

<details class="relative" bind:this={menu}>
	<summary
		class="grid size-9 cursor-pointer list-none place-items-center border border-(--line) bg-(--surface) text-(--ink) hover:border-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
		aria-label="More actions"
	>
		<span aria-hidden="true" class="text-lg leading-none">⋯</span>
	</summary>
	<div
		class="absolute top-full right-0 z-30 mt-1 w-64 border border-(--line) bg-(--surface) p-1 shadow-lg"
	>
		{#if confirming}
			<div class="flex flex-col gap-3 p-3" role="alertdialog" aria-labelledby="delete-title">
				<p id="delete-title" class="text-sm text-(--ink)">
					Delete this request{documentCount > 0
						? ` and its ${documentCount === 1 ? 'document' : `${documentCount} documents`}`
						: ''}? This can’t be undone.
				</p>
				<div class="flex gap-2">
					<button
						class="inline-flex min-h-9 items-center bg-(--alert) px-3 text-sm font-semibold text-white disabled:opacity-60"
						type="button"
						disabled={deleting}
						onclick={remove}>{deleting ? 'Deleting…' : 'Delete'}</button
					>
					<button
						class="inline-flex min-h-9 items-center border border-(--line) px-3 text-sm text-(--ink) hover:border-(--ink)"
						type="button"
						disabled={deleting}
						onclick={() => (confirming = false)}>Keep it</button
					>
				</div>
			</div>
		{:else}
			<button
				class="w-full px-3 py-2 text-left text-sm text-(--alert) hover:bg-(--alert-soft) focus-visible:outline-2 focus-visible:outline-(--pine)"
				type="button"
				onclick={() => (confirming = true)}>Delete request</button
			>
		{/if}
	</div>
</details>
