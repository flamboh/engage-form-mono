<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		multiple = false,
		capture = false,
		class: className = '',
		label,
		onfiles,
		children
	}: {
		multiple?: boolean;
		capture?: boolean;
		class?: string;
		label: string;
		onfiles: (files: File[]) => void;
		children: Snippet;
	} = $props();
</script>

<label
	class="cursor-pointer focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-(--pine) {className}"
>
	<input
		class="sr-only"
		type="file"
		accept="image/*,application/pdf"
		aria-label={label}
		{multiple}
		capture={capture ? 'environment' : undefined}
		onchange={(event) => {
			const files = Array.from(event.currentTarget.files ?? []);
			event.currentTarget.value = '';
			onfiles(files);
		}}
	/>
	{@render children()}
</label>
