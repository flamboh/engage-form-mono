<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import SourceCue from './SourceCue.svelte';
	import type { FieldSource } from './types';

	let {
		label,
		value,
		display,
		cue,
		type = 'text',
		placeholder = 'Not set',
		actionLabel = 'Edit',
		readonly = false,
		oncommit,
		onaction,
		children
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
		children?: Snippet;
	} = $props();

	let editing = $state(false);
	let draft = $state('');

	const shown = $derived(display ?? value);
	const hasAction = $derived(!readonly && (onaction !== undefined || oncommit !== undefined));

	function act() {
		if (onaction) {
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

	function cancel() {
		editing = false;
	}

	function focusField(node: HTMLInputElement | HTMLTextAreaElement) {
		untrack(() => {
			draft = value;
			node.value = draft;
			node.focus();
			if (type !== 'date' && type !== 'time') node.select();
		});
	}
</script>

<div class="field-row">
	<dt>{label}</dt>
	<dd>
		<div class="content">
			{#if editing}
				{#if type === 'textarea'}
					<textarea
						rows="3"
						aria-label={label}
						bind:value={draft}
						onblur={commit}
						onkeydown={(event) => {
							if (event.key === 'Escape') cancel();
							if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commit();
						}}
						{@attach focusField}
					></textarea>
				{:else}
					<span class="input-wrap" class:money={type === 'money'}>
						<input
							type={type === 'date' || type === 'time' ? type : 'text'}
							inputmode={type === 'money' ? 'decimal' : type === 'number' ? 'numeric' : undefined}
							aria-label={label}
							bind:value={draft}
							onblur={commit}
							onkeydown={(event) => {
								if (event.key === 'Enter') commit();
								if (event.key === 'Escape') cancel();
							}}
							{@attach focusField}
						/>
					</span>
				{/if}
			{:else}
				{#if shown}
					<span class="value">{shown}</span>
				{:else}
					<span class="placeholder">{placeholder}</span>
				{/if}
				{#if cue}<SourceCue source={cue} />{/if}
				{#if children}{@render children()}{/if}
			{/if}
		</div>
		{#if hasAction && !editing}
			<button
				class="action"
				type="button"
				aria-label={`${actionLabel} ${label.toLowerCase()}`}
				onclick={act}
			>
				{actionLabel}
			</button>
		{/if}
	</dd>
</div>

<style>
	.field-row {
		display: grid;
		grid-template-columns: 130px minmax(0, 1fr);
		align-items: baseline;
		gap: 16px;
		border-bottom: 1px solid var(--line);
		padding: 12px 0;
	}

	dt {
		font-size: 13.5px;
		color: var(--quiet);
	}

	dd {
		display: flex;
		align-items: baseline;
		gap: 16px;
		margin: 0;
		min-width: 0;
		font-size: 15px;
	}

	.content {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	dd :global(.cue) {
		margin-left: 8px;
	}

	.placeholder {
		color: var(--faint);
	}

	.action {
		flex: none;
		border: 0;
		background: none;
		padding: 0;
		font-size: 13.5px;
		color: var(--quiet);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}

	.action:hover {
		color: var(--ink);
	}

	.input-wrap {
		position: relative;
		display: block;
	}

	.input-wrap.money::before {
		content: '$';
		position: absolute;
		top: 50%;
		left: 8px;
		transform: translateY(-50%);
		color: var(--quiet);
		pointer-events: none;
	}

	input,
	textarea {
		width: 100%;
		border: 1px solid var(--pine);
		background: var(--surface);
		padding: 4px 8px;
		font: inherit;
		color: var(--ink);
		outline: none;
	}

	.money input {
		padding-left: 20px;
	}

	input:focus-visible,
	textarea:focus-visible {
		box-shadow: 0 0 0 3px color-mix(in oklab, var(--pine) 25%, transparent);
	}

	@media (max-width: 640px) {
		.field-row {
			grid-template-columns: 96px minmax(0, 1fr);
			gap: 10px;
		}

		dd :global(.cue) {
			display: block;
			margin: 2px 0 0;
		}
	}
</style>
