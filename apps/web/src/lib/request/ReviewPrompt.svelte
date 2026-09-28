<script lang="ts">
	import Chip from './Chip.svelte';
	import { reviewDisplay } from './labels';
	import type { ReviewField } from './whatsLeft';

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

	const options = $derived(alternatives.filter((option) => option !== value).slice(0, 3));
</script>

<div
	class="mt-2 flex flex-col gap-2"
	id={`review-${field}`}
	role="group"
	aria-label="Is this right?"
>
	<p class="text-sm text-(--ink)">Is this right?</p>
	<div class="flex flex-wrap gap-2">
		<Chip onclick={() => onpick(value)}>Yes, {reviewDisplay(field, value)}</Chip>
		{#each options as option (option)}
			<Chip onclick={() => onpick(option)}>{reviewDisplay(field, option)}</Chip>
		{/each}
		<Chip onclick={onother}>Something else</Chip>
	</div>
</div>
