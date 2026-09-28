<script lang="ts">
	import type { RequestEditor } from './editor.svelte';
	import SourceCue from './SourceCue.svelte';

	let { editor, resolvedText }: { editor: RequestEditor; resolvedText: string } = $props();

	let customizing = $state(false);
	let textarea = $state<HTMLTextAreaElement | null>(null);

	const variables = [
		'Purpose',
		'Student Organization',
		'Purchaser',
		'Vendor',
		'Item Description',
		'Total Amount',
		'Activity Date',
		'Recipients',
		'Office Location'
	];
	const parts = $derived(
		resolvedText.split(/(\{[^{}]+\})/).map((text) => ({
			text: text.startsWith('{') ? text.slice(1, -1) : text,
			blank: text.startsWith('{')
		}))
	);

	function insert(variable: string) {
		const current = editor.form?.businessPurposeText ?? '';
		const token = `{${variable}}`;
		const start = textarea?.selectionStart ?? current.length;
		const end = textarea?.selectionEnd ?? current.length;
		editor.update(
			{
				businessPurposeText: current.slice(0, start) + token + current.slice(end),
				businessPurposeTouched: true
			},
			{ debounce: true }
		);
		requestAnimationFrame(() => {
			textarea?.focus();
			textarea?.setSelectionRange(start + token.length, start + token.length);
		});
	}
</script>

<section id="field-businessPurpose" class="flex flex-col gap-3" aria-labelledby="purpose-heading">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="purpose-heading" class="flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
			Business Purpose
			<SourceCue source={editor.sourceOf('businessPurposeSource', 'businessPurposeText')} />
		</h2>
		<button
			class="text-sm text-(--pine) underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
			type="button"
			aria-expanded={customizing}
			onclick={() => (customizing = !customizing)}
		>
			{customizing ? 'Done' : 'Customize'}
		</button>
	</div>

	{#if customizing}
		<textarea
			bind:this={textarea}
			class="input min-h-36 leading-relaxed"
			aria-label="Business Purpose template"
			value={editor.form?.businessPurposeText ?? ''}
			oninput={(event) =>
				editor.update(
					{ businessPurposeText: event.currentTarget.value, businessPurposeTouched: true },
					{ debounce: true }
				)}
		></textarea>
		<div class="flex flex-wrap items-center gap-1.5">
			<span class="mr-1 text-xs text-(--quiet)">Insert</span>
			{#each variables as variable (variable)}
				<button
					class="border border-(--line) bg-white px-2 py-1 text-xs text-(--ink) hover:border-(--pine) focus-visible:outline-2 focus-visible:outline-(--pine)"
					type="button"
					onclick={() => insert(variable)}
				>
					{variable}
				</button>
			{/each}
		</div>
		<p class="text-xs text-(--quiet)">Words in braces fill in from this request.</p>
	{:else if resolvedText.trim() === ''}
		<p class="text-sm text-(--quiet)">Say what it was for above, or customize the sentence.</p>
	{:else}
		<p class="max-w-prose text-base leading-relaxed text-(--ink)">
			{#each parts as part, index (index)}
				{#if part.blank}
					<span class="blank px-0.5 text-(--quiet)">{part.text.toLowerCase()}</span>
				{:else}
					{part.text}
				{/if}
			{/each}
		</p>
	{/if}
</section>

<style>
	.blank {
		border-bottom: 1.5px dashed var(--quiet);
		background: color-mix(in oklab, var(--marker) 35%, transparent);
	}
</style>
