<script lang="ts">
	import { untrack } from 'svelte';
	import type { FieldSource } from '$lib/request/editor.svelte';
	import SourceCue from './SourceCue.svelte';

	let {
		label,
		value,
		display = value,
		cue,
		type = 'text',
		placeholder = '',
		actionLabel = 'Edit',
		readonly = false,
		oncommit,
		onaction
	}: {
		label: string;
		value: string;
		display?: string;
		cue?: FieldSource;
		type?: 'text' | 'money' | 'date' | 'time' | 'number' | 'textarea';
		placeholder?: string;
		actionLabel?: string;
		readonly?: boolean;
		oncommit?: (value: string) => void;
		onaction?: () => void;
	} = $props();

	let editing = $state(false);
	let draft = $state('');
	const actionable = $derived(!readonly && (onaction !== undefined || oncommit !== undefined));

	function act() {
		if (onaction !== undefined) {
			onaction();
			return;
		}
		editing = true;
	}

	function commit() {
		if (!editing) return;
		editing = false;
		if (draft.trim() !== value.trim()) oncommit?.(draft.trim());
	}

	function keydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && type !== 'textarea') commit();
		if (event.key === 'Escape') editing = false;
	}

	function start(node: HTMLInputElement | HTMLTextAreaElement) {
		untrack(() => {
			draft = value;
			node.value = draft;
			node.focus();
			if (type !== 'date' && type !== 'time') node.select();
		});
	}
</script>

<div
	class="row grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-baseline gap-x-4 border-b border-(--line) py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
>
	<span class="text-sm text-(--quiet)">{label}</span>
	{#if editing}
		<span class="relative col-span-2 block">
			{#if type === 'textarea'}
				<textarea
					class="min-h-20 w-full border border-(--pine) bg-(--surface) px-2 py-1 text-(--ink) outline-none"
					aria-label={label}
					bind:value={draft}
					onblur={commit}
					onkeydown={keydown}
					{@attach start}
				></textarea>
			{:else}
				{#if type === 'money'}
					<span class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-(--quiet)"
						>$</span
					>
				{/if}
				<input
					class="w-full border border-(--pine) bg-(--surface) px-2 py-1 text-(--ink) outline-none"
					class:pl-5={type === 'money'}
					type={type === 'date' || type === 'time' ? type : 'text'}
					inputmode={type === 'money' ? 'decimal' : type === 'number' ? 'numeric' : undefined}
					aria-label={label}
					bind:value={draft}
					onblur={commit}
					onkeydown={keydown}
					{@attach start}
				/>
			{/if}
		</span>
	{:else}
		<span class="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
			{#if display}
				<span class="min-w-0 break-words text-(--ink)">{display}</span>
			{:else}
				<span class="text-(--quiet)">{placeholder}</span>
			{/if}
			<SourceCue source={cue} />
		</span>
		{#if actionable}
			<button
				class="text-sm text-(--quiet) underline underline-offset-3 hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
				type="button"
				aria-label={`${actionLabel} ${label.toLowerCase()}`}
				onclick={act}>{actionLabel}</button
			>
		{:else}
			<span></span>
		{/if}
	{/if}
</div>
