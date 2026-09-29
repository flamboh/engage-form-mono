<script lang="ts">
	import {
		businessPurposeFactsFrom,
		customTextOmissions,
		type MissingFact
	} from '$convex/businessPurpose';
	import type { RequestEditor } from './editor.svelte';

	let {
		editor,
		text,
		missing,
		readonly = false
	}: {
		editor: RequestEditor;
		text: string;
		missing: { fact: MissingFact; label: string }[];
		readonly?: boolean;
	} = $props();

	let editing = $state(false);

	const form = $derived(editor.form);
	const override = $derived(form?.businessPurposeOverride ?? null);
	const shown = $derived(override ?? text);
	const omitted = $derived.by(() => {
		const purchase = editor.purchase;
		if (override === null || form === null || purchase === undefined) return [];
		const facts = businessPurposeFactsFrom({
			...purchase,
			...form,
			totalAmount: form.totalAmount ?? 0
		});
		return customTextOmissions(override, facts).filter((fact) => fact in omittedLabels);
	});

	const omittedLabels: Partial<Record<MissingFact, string>> = {
		vendor: 'the store',
		total: 'the total',
		attendance: 'how many students attended',
		dates: 'the event date'
	};

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

<section id="field-businessPurpose" class="flex flex-col gap-3" aria-label="Business Purpose">
	<div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
		<p class="text-sm text-(--quiet)">
			{override === null
				? 'Written from this request. Engage reviewers look for every fact in it.'
				: 'Your wording. Engage reviewers look for every fact in it.'}
		</p>
		{#if !readonly}
			<div class="flex items-baseline gap-4 text-sm">
				{#if override !== null}
					<button
						class="text-(--quiet) underline underline-offset-3 hover:text-(--ink)"
						type="button"
						onclick={reset}
					>
						Reset
					</button>
				{/if}
				<button
					class="text-(--quiet) underline underline-offset-3 hover:text-(--ink)"
					type="button"
					onclick={() => (editing ? (editing = false) : customize())}
				>
					{editing ? 'Done' : 'Customize'}
				</button>
			</div>
		{/if}
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
		<p class="text-sm text-(--quiet)">Written once the receipt and event facts are in.</p>
	{:else}
		<p class="purpose max-w-prose pl-4 text-base leading-relaxed text-(--ink)">{shown}</p>
	{/if}

	{#if omitted.length > 0}
		<p class="text-sm text-(--ink)" role="status">
			<span class="dot" aria-hidden="true"></span>
			Your wording doesn’t seem to mention {list(
				omitted.map((fact) => omittedLabels[fact] ?? fact)
			)}. Engage denies purposes missing these.
		</p>
	{/if}

	{#if missing.length > 0}
		<ul
			class="flex flex-col gap-1 text-sm text-(--quiet)"
			aria-label="Still needed for the Business Purpose"
		>
			{#each missing as item (item.fact)}
				<li>{item.label}</li>
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
		background: var(--marker-deep);
	}
</style>
