<script lang="ts">
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		status,
		lastFilledAt,
		ready,
		blockingCount,
		reviewCount,
		reading,
		onjumpfirst
	}: {
		editor: RequestEditor;
		status: 'draft' | 'ready' | 'approved' | undefined;
		lastFilledAt: number | null;
		ready: boolean;
		blockingCount: number;
		reviewCount: number;
		reading: boolean;
		onjumpfirst: () => void;
	} = $props();

	const filled = $derived(status === 'ready' && lastFilledAt !== null);
	const filledOn = $derived(
		lastFilledAt === null
			? ''
			: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(lastFilledAt)
	);
</script>

<div
	class="bar sticky bottom-0 z-20 border-t border-(--line) pb-[env(safe-area-inset-bottom)] backdrop-blur"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
		<div class="min-w-0 text-sm" role="status" aria-live="polite">
			{#if editor.error}
				<p class="text-(--alert)">{editor.error}</p>
			{:else if status === 'approved'}
				<p class="font-medium text-(--ink)">Approved</p>
				<p class="text-(--quiet)">This request is done.</p>
			{:else if editor.fillPhase === 'sent' && !filled}
				<p class="font-medium text-(--ink)">Engage is filling…</p>
				<p class="text-(--quiet)">
					Keep the Engage tab open.
					<a class="underline" href={editor.engageUrl} target="_blank" rel="noreferrer"
						>Open it again</a
					>
				</p>
			{:else if filled}
				<p class="font-medium text-(--ink)">Filled on Engage {filledOn}</p>
				<p class="text-(--quiet)">Mark it approved once SOFS signs off.</p>
			{:else if ready}
				<p class="font-medium text-(--ink)">Ready for Engage</p>
				<p class="text-(--quiet)">
					{reviewCount > 0
						? `${reviewCount} ${reviewCount === 1 ? 'value' : 'values'} to double-check`
						: 'Engage fills itself in a new tab.'}
				</p>
			{:else if reading && blockingCount === 0}
				<p class="font-medium text-(--ink)">Reading your receipt…</p>
			{:else}
				<p class="font-medium text-(--ink)">
					{reading ? 'Reading your receipt… ' : ''}{blockingCount}
					{blockingCount === 1 ? 'thing' : 'things'} left
				</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if status === 'approved'}
				<button
					class="secondary-action"
					type="button"
					disabled={editor.busy}
					onclick={() => void editor.reopen()}>Reopen</button
				>
			{:else if filled}
				<button
					class="secondary-action hidden sm:inline-flex"
					type="button"
					disabled={editor.fillPhase === 'opening'}
					onclick={() => void editor.fill()}
					>{editor.fillPhase === 'opening' ? 'Opening Engage…' : 'Fill again'}</button
				>
				<button
					class="primary-action"
					type="button"
					disabled={editor.busy}
					onclick={() => void editor.markApproved()}>Mark approved</button
				>
			{:else if ready}
				<button
					class="primary-action"
					type="button"
					disabled={editor.fillPhase === 'opening'}
					onclick={() => void editor.fill()}
				>
					{editor.fillPhase === 'opening' ? 'Opening Engage…' : 'Fill on Engage'}
				</button>
			{:else if blockingCount > 0}
				<button class="secondary-action" type="button" onclick={onjumpfirst}>Show next</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.bar {
		background: color-mix(in oklab, var(--paper) 88%, transparent);
	}

	.primary-action,
	.secondary-action {
		display: inline-flex;
		min-height: 2.75rem;
		align-items: center;
		padding: 0 1.25rem;
		font-size: 0.9375rem;
		font-weight: 600;
		transition:
			background-color 120ms,
			transform 120ms;
	}

	.primary-action {
		background: var(--pine);
		color: white;
	}

	.primary-action:hover:not(:disabled) {
		background: var(--pine-deep);
	}

	.secondary-action {
		border: 1px solid var(--ink);
		color: var(--ink);
	}

	.secondary-action:hover:not(:disabled) {
		background: var(--ink);
		color: white;
	}

	.primary-action:active:not(:disabled),
	.secondary-action:active:not(:disabled) {
		transform: scale(0.98);
	}

	.primary-action:disabled,
	.secondary-action:disabled {
		opacity: 0.6;
	}

	.primary-action:focus-visible,
	.secondary-action:focus-visible {
		outline: 2px solid var(--pine);
		outline-offset: 2px;
	}
</style>
