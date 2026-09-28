<script lang="ts">
	import Chip from './Chip.svelte';
	import { reviewDisplay } from './labels';
	import { reviewProposal, type ReviewField } from './whatsLeft';

	let {
		field,
		value,
		alternatives,
		onpick,
		onother
	}: {
		field: ReviewField;
		value: string;
		alternatives: string[];
		onpick: (value: string) => void;
		onother: () => void;
	} = $props();

	const nouns: Record<ReviewField, string> = {
		vendor: 'store',
		totalAmount: 'total',
		receiptDate: 'receipt date'
	};

	const proposal = $derived(reviewProposal({ value, alternatives }));
	const confirming = $derived(value.trim() !== '');
	const options = $derived(
		alternatives
			.filter((option) => option.trim() !== '' && option !== proposal)
			.filter((option) => reviewDisplay(field, option) !== reviewDisplay(field, proposal))
			.slice(0, 3)
	);
	const question = $derived(
		confirming ? 'Is this right?' : `Is the ${nouns[field]} ${reviewDisplay(field, proposal)}?`
	);
</script>

{#if proposal !== ''}
	<div class="mt-2 flex flex-col gap-2" id={`review-${field}`} role="group" aria-label={question}>
		<p class="text-sm text-(--ink)">{question}</p>
		<div class="flex flex-wrap gap-2">
			<Chip onclick={() => onpick(proposal)}>
				{confirming ? `Yes, ${reviewDisplay(field, proposal)}` : 'Yes'}
			</Chip>
			{#each options as option (option)}
				<Chip onclick={() => onpick(option)}>{reviewDisplay(field, option)}</Chip>
			{/each}
			<Chip onclick={onother}>Something else</Chip>
		</div>
	</div>
{/if}
