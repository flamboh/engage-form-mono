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
</script>

<section class="border-t border-(--line) pt-6" aria-label="Delete request">
	{#if confirming}
		<div class="flex flex-col gap-3" role="alertdialog" aria-labelledby="delete-request-title">
			<p id="delete-request-title" class="text-sm font-medium text-(--ink)">
				Delete this request{documentCount > 0
					? ` and its ${documentCount === 1 ? 'document' : `${documentCount} documents`}`
					: ''}? This can't be undone.
			</p>
			<div class="flex flex-wrap gap-2">
				<button class="danger-action" type="button" disabled={deleting} onclick={remove}>
					{deleting ? 'Deleting…' : 'Delete request'}
				</button>
				<button
					class="keep-action"
					type="button"
					disabled={deleting}
					onclick={() => (confirming = false)}>Keep it</button
				>
			</div>
		</div>
	{:else}
		<button
			class="text-sm text-(--quiet) underline-offset-4 hover:text-(--alert) hover:underline focus-visible:outline-2 focus-visible:outline-(--pine)"
			type="button"
			onclick={() => (confirming = true)}>Delete request</button
		>
	{/if}
</section>

<style>
	.danger-action,
	.keep-action {
		display: inline-flex;
		min-height: 2.5rem;
		align-items: center;
		padding: 0 1rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.danger-action {
		background: var(--alert);
		color: white;
	}

	.keep-action {
		border: 1px solid var(--line);
		color: var(--ink);
	}

	.keep-action:hover:not(:disabled) {
		border-color: var(--ink);
	}

	.danger-action:disabled,
	.keep-action:disabled {
		opacity: 0.6;
	}
</style>
