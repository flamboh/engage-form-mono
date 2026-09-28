<script lang="ts">
	import type { Recipient } from '$lib/purchase/draftDetails';

	let {
		recipients,
		onchange
	}: {
		recipients: Recipient[];
		onchange: (recipients: Recipient[], debounce: boolean) => void;
	} = $props();

	function patch(index: number, next: Partial<Recipient>) {
		onchange(
			recipients.map((recipient, itemIndex) =>
				itemIndex === index ? { ...recipient, ...next } : recipient
			),
			true
		);
	}
</script>

<div class="flex flex-col gap-3">
	{#each recipients as recipient, index (index)}
		<fieldset
			class="grid grid-cols-2 gap-2 border-l-2 border-(--line) pl-3 sm:grid-cols-[1.4fr_1fr_0.8fr_auto]"
		>
			<legend class="sr-only">Recipient {index + 1}</legend>
			<label class="col-span-2 flex flex-col gap-1 text-xs text-(--quiet) sm:col-span-1">
				Name
				<input
					class="input"
					value={recipient.name}
					autocomplete="off"
					oninput={(event) => patch(index, { name: event.currentTarget.value })}
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-(--quiet)">
				UO ID
				<input
					class="input tabular-nums"
					value={recipient.uo95}
					inputmode="numeric"
					placeholder="95…"
					oninput={(event) => patch(index, { uo95: event.currentTarget.value })}
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-(--quiet)">
				Value
				<input
					class="input tabular-nums"
					value={recipient.value || ''}
					inputmode="decimal"
					placeholder="$"
					oninput={(event) =>
						patch(index, { value: Number(event.currentTarget.value.replace(/[$,]/g, '')) || 0 })}
				/>
			</label>
			<button
				class="col-span-2 self-end px-2 py-2 text-left text-xs text-(--quiet) underline hover:text-(--ink) sm:col-span-1"
				type="button"
				onclick={() =>
					onchange(
						recipients.filter((_, itemIndex) => itemIndex !== index),
						false
					)}
			>
				Remove
			</button>
		</fieldset>
	{/each}
	<button
		class="self-start border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink) hover:bg-(--ink) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
		type="button"
		onclick={() => onchange([...recipients, { name: '', uo95: '', reason: '', value: 0 }], false)}
	>
		Add recipient
	</button>
	<p class="text-xs text-(--quiet)">
		Gifts and prizes must stay under $50 per person per year. No gift cards or cash.
	</p>
</div>
