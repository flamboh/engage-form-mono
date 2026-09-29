<script lang="ts">
	import type { RequestEditor } from './editor.svelte';
	import SourceCue from './SourceCue.svelte';

	let {
		editor,
		resolvedText,
		missing
	}: {
		editor: RequestEditor;
		resolvedText: string;
		missing: { fact: string; label: string }[];
	} = $props();

	let customizing = $state(false);

	const override = $derived(editor.form?.businessPurposeOverride ?? null);
</script>

<section id="field-businessPurpose" class="flex flex-col gap-3" aria-labelledby="purpose-heading">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="purpose-heading" class="flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
			Business Purpose
			<SourceCue source={editor.sourceOf('businessPurposeOverride')} />
		</h2>
		<div class="flex gap-3">
			{#if override !== null}
				<button
					class="text-sm text-(--pine) underline"
					type="button"
					onclick={() => {
						customizing = false;
						editor.update({ businessPurposeOverride: null });
					}}
				>
					Reset to generated
				</button>
			{/if}
			<button
				class="text-sm text-(--pine) underline"
				type="button"
				aria-expanded={customizing}
				onclick={() => (customizing = !customizing)}
			>
				{customizing ? 'Done' : 'Customize'}
			</button>
		</div>
	</div>

	{#if customizing}
		<textarea
			class="input min-h-36 leading-relaxed"
			aria-label="Business Purpose"
			value={override ?? resolvedText}
			oninput={(event) =>
				editor.update({ businessPurposeOverride: event.currentTarget.value }, { debounce: true })}
		></textarea>
	{:else}
		<p class="max-w-prose text-base leading-relaxed text-(--ink)">{resolvedText}</p>
	{/if}
	{#if missing.length > 0}
		<ul class="flex flex-col gap-1 text-sm text-(--quiet)">
			{#each missing as item (item.fact)}
				<li>{item.label}</li>
			{/each}
		</ul>
	{/if}
</section>
