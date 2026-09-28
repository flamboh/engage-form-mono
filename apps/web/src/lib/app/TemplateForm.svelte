<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import {
		errorMessage,
		hintClass,
		inputClass,
		labelClass,
		primaryButtonClass,
		textareaClass
	} from '$lib/app/styles';
	import { DEFAULT_BUSINESS_PURPOSE } from '$lib/welcome/defaults';
	import { useConvexClient } from 'convex-svelte';

	let {
		template,
		organizations,
		onDone
	}: {
		template: Doc<'businessPurposeTemplates'> | null;
		organizations: Doc<'organizations'>[];
		onDone: () => void;
	} = $props();

	const client = useConvexClient();
	const start = untrack(() => template);

	let organizationId = $state<Id<'organizations'> | ''>(
		start?.organizationId ?? untrack(() => organizations[0]?._id) ?? ''
	);
	let title = $state(start?.title ?? '');
	let text = $state(start?.businessPurposeTemplate ?? DEFAULT_BUSINESS_PURPOSE);
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (organizationId === '') {
			error = 'Choose an organization.';
			return;
		}
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertBusinessPurposeTemplate, {
				id: start?._id ?? null,
				organizationId,
				title: title.trim(),
				businessPurposeTemplate: text
			});
			onDone();
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-4" onsubmit={save}>
	{#if organizations.length > 1}
		<label class={labelClass}>
			Organization
			<select class={inputClass} bind:value={organizationId}>
				{#each organizations as org (org._id)}
					<option value={org._id}>{org.name}</option>
				{/each}
			</select>
		</label>
	{/if}
	<label class={labelClass}>
		Name
		<input class={inputClass} required placeholder="Weekly meeting snacks" bind:value={title} />
	</label>
	<label class={labelClass}>
		Business purpose
		<span class={hintClass}>
			Words in braces, like {'{Vendor}'}, {'{Activity Date}'}, {'{Time}'}, or {'{Location}'}, fill
			in from each request.
		</span>
		<textarea class={textareaClass} required bind:value={text}></textarea>
	</label>
	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<div class="flex items-center gap-3">
		<button class={primaryButtonClass} type="submit" disabled={saving}>
			{saving ? 'Saving…' : start ? 'Save' : 'Add template'}
		</button>
		<button class="text-sm text-stone-600 hover:text-stone-900" type="button" onclick={onDone}>
			Cancel
		</button>
	</div>
</form>
