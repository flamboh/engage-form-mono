<script lang="ts">
	import { untrack } from 'svelte';
	import { dateInputValue } from './labels';

	let {
		value,
		display = value,
		placeholder,
		label,
		type = 'text',
		highlight = false,
		class: className = '',
		editing = $bindable(false),
		oncommit
	}: {
		value: string;
		display?: string;
		placeholder: string;
		label: string;
		type?: 'text' | 'money' | 'date';
		highlight?: boolean;
		class?: string;
		editing?: boolean;
		oncommit: (value: string) => void;
	} = $props();

	let draft = $state('');

	function start() {
		editing = true;
	}

	function commit() {
		if (!editing) return;
		editing = false;
		if (draft.trim() !== value.trim()) oncommit(draft.trim());
	}
</script>

{#if editing}
	<span class="relative block {className}">
		{#if type === 'money'}
			<span class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-(--quiet)"
				>$</span
			>
		{/if}
		<input
			class="w-full border border-(--pine) bg-white px-2 py-1 text-(--ink) outline-none focus-visible:ring-2 focus-visible:ring-(--pine)/30"
			class:pl-5={type === 'money'}
			type={type === 'date' ? 'date' : 'text'}
			inputmode={type === 'money' ? 'decimal' : undefined}
			aria-label={label}
			bind:value={draft}
			onblur={commit}
			onkeydown={(event) => {
				if (event.key === 'Enter') commit();
				if (event.key === 'Escape') editing = false;
			}}
			{@attach (node) =>
				untrack(() => {
					draft = type === 'date' ? dateInputValue(value) : value;
					node.value = draft;
					node.focus();
					if (type !== 'date') node.select();
				})}
		/>
	</span>
{:else}
	<button
		class="editable group -mx-1 inline-flex max-w-full items-baseline gap-2 px-1 text-left focus-visible:outline-2 focus-visible:outline-(--pine) {className}"
		class:marker={highlight}
		type="button"
		aria-label={`${label}: ${display || 'not set'}. Edit`}
		onclick={start}
	>
		{#if display}
			<span class="min-w-0 break-words">{display}</span>
		{:else}
			<span class="text-(--quiet)">{placeholder}</span>
		{/if}
		<span
			class="shrink-0 self-center text-xs font-normal text-(--quiet) opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
			aria-hidden="true">Edit</span
		>
	</button>
{/if}

<style>
	.editable:hover {
		background: var(--pine-soft);
	}

	.marker {
		background: linear-gradient(
			transparent 55%,
			var(--marker) 55%,
			var(--marker) 92%,
			transparent 92%
		);
	}
</style>
