<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { uploadFile } from '$lib/upload';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const currentUserQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, () =>
		clerkContext.currentSession ? {} : 'skip'
	);

	let name = $state('');
	let uo95 = $state('');
	let permanentAddress = $state('');
	let studentEmail = $state('');
	let phone = $state('');
	let idCardFrontFileId = $state<Id<'files'> | null>(null);
	let idCardBackFileId = $state<Id<'files'> | null>(null);
	let idFrontStatus = $state('Required');
	let idBackStatus = $state('Optional');
	let saving = $state(false);
	let error = $state('');

	$effect(() => {
		const user = currentUserQuery.data;
		if (!user) return;
		name = user.name;
		uo95 = user.uo95;
		permanentAddress = user.permanentAddress;
		studentEmail = user.studentEmail;
		phone = user.phone;
		idCardFrontFileId = user.idCardFrontFileId;
		idCardBackFileId = user.idCardBackFileId;
		idFrontStatus = 'Uploaded';
		idBackStatus = user.idCardBackFileId === null ? 'Optional' : 'Uploaded';
	});

	async function handleUpload(kind: 'id_front' | 'id_back', input: HTMLInputElement) {
		const session = clerkContext.currentSession;
		const file = input.files?.[0];
		if (!session || !file) return;
		try {
			if (kind === 'id_back') idBackStatus = 'Uploading...';
			else idFrontStatus = 'Uploading...';
			const fileId = await uploadFile(session, kind, file);
			if (kind === 'id_front') {
				idCardFrontFileId = fileId;
				idFrontStatus = 'Uploaded';
			} else {
				idCardBackFileId = fileId;
				idBackStatus = 'Uploaded';
			}
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
			if (kind === 'id_front') idFrontStatus = 'Failed';
			else idBackStatus = 'Failed';
		}
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (idCardFrontFileId === null) {
			error = 'Upload an ID card document to continue.';
			return;
		}
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertUserProfile, {
				name,
				uo95,
				permanentAddress,
				studentEmail,
				phone,
				idCardFrontFileId,
				idCardBackFileId
			});
			await goto('/app/welcome/org');
		} catch (err) {
			error = err instanceof Error ? err.message : String(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-5" onsubmit={save}>
	<header>
		<h2 class="text-lg font-semibold">Your profile</h2>
		<p class="mt-1 text-sm text-stone-500">
			You're the requester on every form Engage Form fills. Add the details and ID card document
			SOFS needs once.
		</p>
	</header>

	{#if error}
		<p class="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
	{/if}

	<label class="block text-sm">
		<span class="font-medium">Full name</span>
		<input class="field mt-1" required bind:value={name} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">UO 95 number</span>
		<input class="field mt-1" required bind:value={uo95} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Permanent address</span>
		<input
			class="field mt-1"
			required
			autocomplete="street-address"
			bind:value={permanentAddress}
		/>
	</label>

	<label class="block text-sm">
		<span class="font-medium">Student email</span>
		<input class="field mt-1" type="email" required bind:value={studentEmail} />
	</label>

	<label class="block text-sm">
		<span class="font-medium">Phone</span>
		<input class="field mt-1" type="tel" required bind:value={phone} />
	</label>

	<div class="grid gap-3 md:grid-cols-2">
		<label class="block text-sm">
			<span class="font-medium">ID card document</span>
			<input
				class="mt-1 block text-sm"
				type="file"
				accept="image/*,application/pdf"
				onchange={(e) => handleUpload('id_front', e.currentTarget)}
			/>
			<p class="mt-1 text-xs text-stone-500">{idFrontStatus}</p>
		</label>
		<label class="block text-sm">
			<span class="font-medium">Second ID card document</span>
			<input
				class="mt-1 block text-sm"
				type="file"
				accept="image/*,application/pdf"
				onchange={(e) => handleUpload('id_back', e.currentTarget)}
			/>
			<p class="mt-1 text-xs text-stone-500">{idBackStatus}</p>
		</label>
	</div>

	<button class="button" type="submit" disabled={saving}>
		{saving ? 'Saving...' : 'Continue'}
	</button>
</form>

<style>
	.field {
		width: 100%;
		border-radius: 0.375rem;
		border: 1px solid rgb(214 211 209);
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
	}
	.button {
		border-radius: 0.375rem;
		background: rgb(28 25 23);
		padding: 0.5rem 1rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: white;
	}
	.button:disabled {
		opacity: 0.6;
	}
</style>
