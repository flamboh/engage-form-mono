<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { errorMessage } from '$lib/app/styles';

	let {
		fileId = $bindable(),
		kind,
		label,
		hint = ''
	}: {
		fileId: Id<'files'> | null;
		kind: 'id_front' | 'id_back';
		label: string;
		hint?: string;
	} = $props();

	const clerkContext = getClerkContext();
	let input = $state<HTMLInputElement | null>(null);
	let status = $state<'idle' | 'uploading' | 'failed'>('idle');
	let filename = $state('');
	let error = $state('');

	async function upload(target: HTMLInputElement) {
		const session = clerkContext.currentSession;
		const file = target.files?.[0];
		target.value = '';
		if (!session || !file) return;
		status = 'uploading';
		error = '';
		try {
			fileId = await uploadFile(session, kind, file);
			filename = file.name;
			status = 'idle';
		} catch (err) {
			status = 'failed';
			error = errorMessage(err);
		}
	}
</script>

<div class="flex flex-col gap-1.5 text-sm">
	<span class="font-medium text-stone-800">{label}</span>
	{#if hint}<span class="text-xs text-stone-500">{hint}</span>{/if}
	<div
		class="flex items-center gap-3 rounded-lg border border-dashed px-3 py-3 {fileId
			? 'border-[#154733] bg-[#154733]/5'
			: 'border-stone-300'}"
	>
		<span class="min-w-0 flex-1 truncate text-stone-600">
			{#if status === 'uploading'}
				Uploading…
			{:else if fileId}
				{filename || 'Photo on file'}
			{:else}
				No photo yet
			{/if}
		</span>
		<button
			class="inline-flex h-9 shrink-0 items-center rounded-full border border-stone-300 bg-white px-3 text-sm font-medium hover:border-stone-900"
			type="button"
			disabled={status === 'uploading'}
			onclick={() => input?.click()}
		>
			{fileId ? 'Replace' : 'Add photo'}
		</button>
	</div>
	{#if error}<span class="text-xs text-red-700">{error}</span>{/if}
	<input
		bind:this={input}
		class="hidden"
		type="file"
		accept="image/*,application/pdf"
		onchange={(event) => upload(event.currentTarget)}
	/>
</div>
