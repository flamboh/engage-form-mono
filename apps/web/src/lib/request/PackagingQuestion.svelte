<script lang="ts">
	import Chip from '$lib/ui/Chip.svelte';

	let {
		value,
		disabled = false,
		onanswer
	}: {
		value: boolean | null;
		disabled?: boolean;
		onanswer: (packaged: boolean) => void;
	} = $props();
</script>

<div
	class="flex flex-wrap gap-2"
	role="group"
	aria-label="Were all the snacks individually packaged?"
>
	<Chip selected={value === true} {disabled} onclick={() => onanswer(true)}>Yes, all sealed</Chip>
	<Chip selected={value === false} {disabled} onclick={() => onanswer(false)}>
		No, some were shared
	</Chip>
</div>
