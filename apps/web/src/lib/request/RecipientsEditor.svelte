<script lang="ts">
	import { untrack } from 'svelte';
	import type { Recipient } from '$lib/purchase/draftDetails';
	import { addRecipient, editValue, removeRecipient, startSync } from './recipientValues';

	let {
		recipients,
		total,
		onchange
	}: {
		recipients: Recipient[];
		total: number | null;
		onchange: (recipients: Recipient[], debounce: boolean) => void;
	} = $props();

	let sync = $state(untrack(() => startSync(recipients, total)));
	let typing = $state<{ index: number; text: string } | null>(null);

	function apply(result: { recipients: Recipient[]; sync: typeof sync }, debounce: boolean) {
		sync = result.sync;
		onchange(result.recipients, debounce);
	}

	function typeValue(index: number, text: string) {
		typing = { index, text };
		const value = Number(text.replace(/[$,]/g, '')) || 0;
		apply(editValue(recipients, index, value, total, sync), true);
	}

	function shown(value: number) {
		return value === 0 ? '' : String(Number(value.toFixed(2)));
	}

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
			class="grid grid-cols-2 gap-2 border-l-2 border-(--line) pl-3 sm:grid-cols-[1.4fr_1fr_0.8fr]"
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
					placeholder="951234567"
					oninput={(event) => patch(index, { uo95: event.currentTarget.value })}
				/>
			</label>
			<label class="flex flex-col gap-1 text-xs text-(--quiet)">
				Value
				<input
					class="input tabular-nums"
					value={typing?.index === index ? typing.text : shown(recipient.value)}
					inputmode="decimal"
					placeholder="$"
					oninput={(event) => typeValue(index, event.currentTarget.value)}
					onblur={() => (typing = null)}
				/>
			</label>
			<label class="col-span-2 flex flex-col gap-1 text-xs text-(--quiet)">
				Why they got it
				<input
					class="input"
					value={recipient.reason}
					autocomplete="off"
					placeholder="Raffle prize, speaker gift"
					oninput={(event) => patch(index, { reason: event.currentTarget.value })}
				/>
			</label>
			<button
				class="col-span-2 self-end justify-self-start px-2 py-2 text-left text-xs text-(--quiet) underline hover:text-(--ink) sm:col-span-1"
				type="button"
				onclick={() => {
					typing = null;
					apply(removeRecipient(recipients, index, total, sync), false);
				}}
			>
				Remove
			</button>
		</fieldset>
	{/each}
	<button
		class="self-start border border-(--ink) px-3 py-1.5 text-sm font-medium text-(--ink) hover:bg-(--ink) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
		type="button"
		onclick={() => apply(addRecipient(recipients, total, sync), false)}
	>
		Add recipient
	</button>
	<p class="text-xs text-(--quiet)">
		Gifts and prizes must stay under $50 per person per year. No gift cards or cash.
	</p>
</div>
