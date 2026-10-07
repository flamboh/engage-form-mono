<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import type { RequestEditor } from './editor.svelte';
	import { monthDay } from './labels';

	export type BarMode =
		| { kind: 'loading' }
		| { kind: 'reading' }
		| { kind: 'steps'; left: number; next: string }
		| { kind: 'ready' }
		| { kind: 'filled'; filledAt: number }
		| { kind: 'approved' };

	let {
		editor,
		mode,
		boardHref,
		trackedHref,
		onsentback
	}: {
		editor: RequestEditor;
		mode: BarMode;
		boardHref: string;
		trackedHref: string;
		onsentback: () => void;
	} = $props();

	const opening = $derived(editor.fillPhase === 'opening');
</script>

<div
	class="bar sticky bottom-0 z-20 border-t border-(--line) pb-[env(safe-area-inset-bottom)] backdrop-blur"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
		<div class="min-w-0 text-sm" role="status" aria-live="polite">
			{#if editor.error}
				<p class="text-(--alert)">{editor.error}</p>
			{:else if mode.kind === 'reading'}
				<p class="font-semibold text-(--ink)">It’s tracked already</p>
				<p class="text-(--quiet)">You can leave. It keeps reading.</p>
			{:else if mode.kind === 'steps'}
				<p class="font-semibold text-(--ink)">
					{mode.left}
					{mode.left === 1 ? 'thing' : 'things'} left
				</p>
				<p class="truncate text-(--quiet)">Next: {mode.next}</p>
			{:else if mode.kind === 'ready' && editor.fillPhase === 'sent'}
				<p class="font-semibold text-(--ink)">Filling on Engage…</p>
				<p class="text-(--quiet)">
					Keep the Engage tab open.
					<a class="underline" href={editor.engageUrl} target="_blank" rel="noreferrer"
						>Open it again</a
					>
				</p>
			{:else if mode.kind === 'ready'}
				<p class="font-semibold text-(--ink)">Ready for Engage</p>
				<p class="text-(--quiet) max-sm:hidden">
					The extension fills it in a new tab. You review and submit.
				</p>
			{:else if mode.kind === 'filled'}
				<p class="font-semibold text-(--ink)">Filled on Engage {monthDay(mode.filledAt)}</p>
				<button
					class="text-(--quiet) underline underline-offset-3 hover:text-(--ink) disabled:opacity-60"
					type="button"
					disabled={opening}
					onclick={() => void editor.fill()}>{opening ? 'Opening Engage…' : 'Fill again'}</button
				>
			{:else if mode.kind === 'approved'}
				<p class="font-semibold text-(--ink)">Approved</p>
				<p class="text-(--quiet)">This request is done.</p>
			{/if}
		</div>

		<div class="flex shrink-0 items-center gap-2">
			{#if mode.kind === 'reading'}
				<Button variant="secondary" href={trackedHref}>Back to board</Button>
			{:else if mode.kind === 'steps'}
				<Button variant="secondary" href={boardHref}>Finish later</Button>
			{:else if mode.kind === 'ready'}
				<Button variant="secondary" href={boardHref}>Later</Button>
				<Button variant="primary" busy={opening} onclick={() => void editor.fill()}>
					{opening ? 'Opening Engage…' : 'Fill on Engage'}
				</Button>
			{:else if mode.kind === 'filled'}
				<Button variant="secondary" disabled={editor.busy} onclick={onsentback}>Sent back</Button>
				<Button variant="primary" busy={editor.busy} onclick={() => void editor.markApproved()}>
					Mark approved
				</Button>
			{:else if mode.kind === 'approved'}
				<Button variant="secondary" busy={editor.busy} onclick={() => void editor.reopen()}>
					Reopen
				</Button>
			{/if}
		</div>
	</div>
</div>

<style>
	.bar {
		background: color-mix(in oklab, var(--paper) 88%, transparent);
	}
</style>
