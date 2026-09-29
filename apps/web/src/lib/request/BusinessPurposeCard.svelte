<script lang="ts">
	import type { MissingFact } from '$convex/businessPurpose';
	import type { RequestEditor } from './editor.svelte';
	import { omittedFactLabels, omittedFacts } from './purposeCheck';

	let {
		editor,
		text,
		missing,
		onjump
	}: {
		editor: RequestEditor;
		text: string;
		missing: { fact: MissingFact; label: string }[];
		onjump: (fact: MissingFact) => void;
	} = $props();

	let editing = $state(false);

	const form = $derived(editor.form);
	const override = $derived(form?.businessPurposeOverride ?? null);
	const shown = $derived(override ?? text);
	const omitted = $derived(
		override === null || form === null
			? []
			: omittedFacts(override, {
					vendor: form.vendor,
					totalAmount: form.totalAmount,
					attendance: form.activity.attendance,
					dates: form.activity.dates
				})
	);

	function customize() {
		if (override === null) editor.update({ businessPurposeOverride: text });
		editing = true;
	}

	function reset() {
		editing = false;
		editor.update({ businessPurposeOverride: null });
	}

	function list(items: string[]) {
		if (items.length <= 1) return items.join('');
		return `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`;
	}
</script>

<section id="field-businessPurpose" class="flex flex-col gap-3" aria-labelledby="purpose-heading">
	<div class="flex items-baseline justify-between gap-3">
		<h2 id="purpose-heading" class="flex items-baseline gap-2 text-lg font-semibold text-(--ink)">
			Business Purpose
			<span class="text-xs font-normal text-(--quiet)">
				{override === null ? 'written from this request' : 'your wording'}
			</span>
		</h2>
		<div class="flex items-baseline gap-3 text-sm">
			{#if override !== null}
				<button class="text-(--quiet) underline hover:text-(--ink)" type="button" onclick={reset}>
					Reset to generated
				</button>
			{/if}
			{#if editing}
				<button class="text-(--pine) underline" type="button" onclick={() => (editing = false)}>
					Done
				</button>
			{:else}
				<button class="text-(--pine) underline" type="button" onclick={customize}>
					Customize
				</button>
			{/if}
		</div>
	</div>

	{#if editing}
		<textarea
			class="input min-h-36 leading-relaxed"
			aria-label="Business Purpose"
			value={override ?? text}
			oninput={(event) =>
				editor.update({ businessPurposeOverride: event.currentTarget.value }, { debounce: true })}
			{@attach (node) => node.focus()}
		></textarea>
	{:else if shown.trim() === ''}
		<p class="text-sm text-(--quiet)">Pick the event and add the receipt to write this.</p>
	{:else}
		<p class="purpose max-w-prose pl-4 text-base leading-relaxed text-(--ink)">{shown}</p>
	{/if}

	{#if omitted.length > 0}
		<p class="text-sm text-(--ink)" role="status">
			<span class="dot" aria-hidden="true"></span>
			Your wording doesn’t seem to mention {list(omitted.map((fact) => omittedFactLabels[fact]))}.
			Engage denies purposes missing these.
		</p>
	{/if}

	{#if missing.length > 0}
		<ul class="flex flex-col gap-1 text-sm" aria-label="Still needed for the Business Purpose">
			{#each missing as item (item.fact)}
				<li>
					<button
						class="text-(--pine) underline decoration-dotted underline-offset-4 hover:decoration-solid"
						type="button"
						onclick={() => onjump(item.fact)}
					>
						{item.label}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	.purpose {
		border-left: 3px solid var(--marker);
	}

	.dot {
		display: inline-block;
		width: 0.5rem;
		height: 0.5rem;
		margin-right: 0.25rem;
		border-radius: 9999px;
		background: var(--marker-deep);
	}
</style>
