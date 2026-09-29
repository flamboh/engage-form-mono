<script lang="ts">
	let {
		value,
		disabled = false,
		onanswer
	}: {
		value: boolean | null;
		disabled?: boolean;
		onanswer: (packaged: boolean) => void;
	} = $props();

	const options = [
		{ packaged: true, label: 'Yes' },
		{ packaged: false, label: 'No' }
	];
</script>

<div
	class="flex shrink-0 gap-1.5"
	role="group"
	aria-label="Were all the snacks individually packaged?"
>
	{#each options as option (option.label)}
		<button
			class={[
				'min-w-12 border px-3 py-1.5 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine) disabled:opacity-60',
				value === option.packaged
					? 'border-(--pine) bg-(--pine) text-white'
					: 'border-(--ink) bg-white text-(--ink) hover:bg-(--ink) hover:text-white'
			]}
			type="button"
			aria-pressed={value === option.packaged}
			{disabled}
			onclick={() => onanswer(option.packaged)}
		>
			{option.label}
		</button>
	{/each}
</div>
