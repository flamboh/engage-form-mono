<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { errorMessage } from '$lib/app/styles';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { uploadFile } from '$lib/upload';
	import { useQuery } from 'convex-svelte';

	let {
		fileId = $bindable(),
		kind,
		label,
		onchange
	}: {
		fileId: Id<'files'> | null;
		kind: 'id_front' | 'id_back';
		label: string;
		onchange?: (fileId: Id<'files'>) => void | Promise<void>;
	} = $props();

	const clerkContext = getClerkContext();
	const previewQuery = useQuery(api.authed.previews.freshPreviewUrl, () =>
		fileId ? { fileId, nonce: 0 } : 'skip'
	);
	let input = $state<HTMLInputElement | null>(null);
	let uploading = $state(false);
	let broken = $state<string | null>(null);
	let error = $state('');

	const preview = $derived(
		fileId && previewQuery.data && broken !== previewQuery.data ? previewQuery.data : null
	);

	async function upload(target: HTMLInputElement) {
		const session = clerkContext.currentSession;
		const file = target.files?.[0];
		target.value = '';
		if (!session || !file) return;
		uploading = true;
		error = '';
		try {
			const id = await uploadFile(session, kind, file);
			fileId = id;
			await onchange?.(id);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="picker">
	<button
		class="tile"
		class:empty={!fileId}
		type="button"
		disabled={uploading}
		aria-label={fileId
			? `Replace ${label.toLowerCase()} photo`
			: `Add ${label.toLowerCase()} photo`}
		onclick={() => input?.click()}
	>
		{#if preview}
			<img src={preview} alt="" onerror={() => (broken = preview)} />
		{/if}
		<span class="caption">
			{#if uploading}Uploading…{:else if fileId}{label}{:else}+ {label}{/if}
		</span>
	</button>
	{#if error}<InlineError message={error} />{/if}
	<input
		bind:this={input}
		class="hidden"
		type="file"
		accept="image/*,application/pdf"
		onchange={(event) => upload(event.currentTarget)}
	/>
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.tile {
		position: relative;
		display: flex;
		width: 120px;
		height: 76px;
		align-items: flex-end;
		overflow: hidden;
		border: 1px solid var(--line);
		background: linear-gradient(135deg, #e6ece8, #f7f8f5);
		padding: 6px 8px;
		cursor: pointer;
	}

	.tile:hover:not(:disabled) {
		border-color: var(--pine);
	}

	.tile.empty {
		border-style: dashed;
		border-color: var(--faint);
		background: var(--surface);
	}

	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.caption {
		position: relative;
		background: color-mix(in oklab, var(--surface) 85%, transparent);
		padding: 0 4px;
		font-size: 12px;
		color: var(--quiet);
	}

	.empty .caption {
		background: none;
		padding: 0;
		color: var(--pine);
		font-weight: 550;
	}
</style>
