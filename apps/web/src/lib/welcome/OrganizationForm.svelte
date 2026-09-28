<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import {
		errorMessage,
		hintClass,
		inputClass,
		labelClass,
		primaryButtonClass,
		secondaryButtonClass,
		textareaClass
	} from '$lib/app/styles';
	import { DEFAULT_BUSINESS_PURPOSE, SUGGESTED_BUDGET_LINES } from '$lib/welcome/defaults';
	import { useConvexClient } from 'convex-svelte';

	type FundLetter = Doc<'organizations'>['fundLetter'];

	let {
		organization,
		submitLabel,
		showTemplate = false,
		onSaved,
		onCancel
	}: {
		organization: Doc<'organizations'> | null;
		submitLabel: string;
		showTemplate?: boolean;
		onSaved: (id: Id<'organizations'>) => void | Promise<void>;
		onCancel?: () => void;
	} = $props();

	const client = useConvexClient();
	const uid = $props.id();
	const start = untrack(() => organization);
	const otherFunds: FundLetter[] = ['E', 'G', 'N', 'U', 'D', 'T'];

	let name = $state(start?.name ?? '');
	let indexNumber = $state(start?.indexNumber ?? '');
	let fundLetter = $state<FundLetter>(start?.fundLetter ?? 'I');
	let budgetLines = $state<string[]>(start ? [...start.budgetLines] : []);
	let newLine = $state('');
	let businessPurposeTemplate = $state(start?.businessPurposeTemplate ?? DEFAULT_BUSINESS_PURPOSE);
	let saving = $state(false);
	let error = $state('');

	const suggestions = $derived(
		SUGGESTED_BUDGET_LINES.filter(
			(line) => !budgetLines.some((item) => item.toLowerCase() === line.toLowerCase())
		)
	);

	function addLine(line: string) {
		const value = line.trim();
		if (value === '' || budgetLines.some((item) => item.toLowerCase() === value.toLowerCase()))
			return;
		budgetLines = [...budgetLines, value];
	}

	function removeLine(line: string) {
		budgetLines = budgetLines.filter((item) => item !== line);
	}

	function addTyped() {
		addLine(newLine);
		newLine = '';
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		const lines = newLine.trim() ? [...budgetLines, newLine.trim()] : budgetLines;
		if (lines.length === 0) {
			error = 'Add at least one budget line item.';
			return;
		}
		error = '';
		saving = true;
		try {
			const id = await client.mutation(api.authed.purchaseBuilder.upsertOrganization, {
				id: start?._id ?? null,
				name: name.trim(),
				indexNumber: indexNumber.trim(),
				fundLetter,
				budgetLines: lines,
				businessPurposeTemplate
			});
			newLine = '';
			budgetLines = lines;
			await onSaved(id);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-5" onsubmit={save}>
	<label class={labelClass}>
		Organization name
		<input class={inputClass} required placeholder="Ski & Snowboard Club" bind:value={name} />
	</label>
	<label class={labelClass}>
		Index number
		<span class={hintClass}>The account number printed on your budget.</span>
		<input class={inputClass} required bind:value={indexNumber} />
	</label>

	<fieldset class="flex flex-col gap-2 text-sm">
		<legend class="mb-1.5 font-medium text-stone-800">Is this budget funded by ASUO?</legend>
		<div class="flex flex-wrap gap-2">
			<label
				class="flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 has-[:checked]:border-[#154733] has-[:checked]:bg-[#154733] has-[:checked]:text-white"
			>
				<input
					class="sr-only"
					type="radio"
					name={`asuo-${uid}`}
					checked={fundLetter === 'I'}
					onchange={() => (fundLetter = 'I')}
				/>
				Yes, student fee money
			</label>
			<label
				class="flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 has-[:checked]:border-[#154733] has-[:checked]:bg-[#154733] has-[:checked]:text-white"
			>
				<input
					class="sr-only"
					type="radio"
					name={`asuo-${uid}`}
					checked={fundLetter !== 'I'}
					onchange={() => (fundLetter = 'E')}
				/>
				No, another fund
			</label>
		</div>
		{#if fundLetter !== 'I'}
			<label class="mt-2 {labelClass}">
				Fund letter on your budget
				<select class={inputClass} bind:value={fundLetter}>
					{#each otherFunds as fund (fund)}
						<option value={fund}>{fund}</option>
					{/each}
				</select>
			</label>
		{:else}
			<span class={hintClass}>
				ASUO-funded events need proof they were advertised. We'll ask for it on each request.
			</span>
		{/if}
	</fieldset>

	<div class="flex flex-col gap-2 text-sm">
		<span class="font-medium text-stone-800">Budget line items</span>
		<span class={hintClass}>Use the names from your budget, spelled the way Engage shows them.</span
		>
		{#if budgetLines.length > 0}
			<ul class="flex flex-wrap gap-2">
				{#each budgetLines as line (line)}
					<li
						class="flex h-9 items-center gap-1 rounded-full bg-[#154733]/10 pr-1 pl-3 text-[#154733]"
					>
						{line}
						<button
							class="grid h-7 w-7 place-items-center rounded-full hover:bg-[#154733]/15"
							type="button"
							aria-label={`Remove ${line}`}
							onclick={() => removeLine(line)}
						>
							<svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
								<path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.5" />
							</svg>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<div class="flex gap-2">
			<input
				class={inputClass}
				placeholder="Add a line item"
				bind:value={newLine}
				onkeydown={(event) => {
					if (event.key === 'Enter') {
						event.preventDefault();
						addTyped();
					}
				}}
			/>
			<button class={secondaryButtonClass + ' h-11'} type="button" onclick={addTyped}>Add</button>
		</div>
		{#if suggestions.length > 0}
			<div class="flex flex-wrap items-center gap-2 pt-1">
				<span class="text-xs text-stone-500">Common:</span>
				{#each suggestions as line (line)}
					<button
						class="h-8 rounded-full border border-dashed border-stone-300 px-3 text-xs text-stone-700 hover:border-[#154733] hover:text-[#154733]"
						type="button"
						onclick={() => addLine(line)}
					>
						+ {line}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if showTemplate}
		<label class={labelClass}>
			Default business purpose
			<span class={hintClass}>
				Words in braces, like {'{Vendor}'} or {'{Total Amount}'}, fill in from each request.
			</span>
			<textarea class={textareaClass} required bind:value={businessPurposeTemplate}></textarea>
		</label>
	{/if}

	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<div class="flex items-center gap-3">
		<button class={primaryButtonClass} type="submit" disabled={saving}>
			{saving ? 'Saving…' : submitLabel}
		</button>
		{#if onCancel}
			<button class="text-sm text-stone-600 hover:text-stone-900" type="button" onclick={onCancel}>
				Cancel
			</button>
		{/if}
	</div>
</form>
