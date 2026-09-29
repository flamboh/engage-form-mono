<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import DocumentPicker from '$lib/app/DocumentPicker.svelte';
	import { errorMessage } from '$lib/app/styles';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import { useConvexClient } from 'convex-svelte';

	type Profile = {
		name: string;
		uo95: string;
		permanentAddress: string;
		studentEmail: string;
		phone: string;
		idCardFrontFileId: Id<'files'> | null;
		idCardBackFileId: Id<'files'> | null;
	};

	let { user }: { user: Doc<'users'> } = $props();

	const client = useConvexClient();
	let pending = $state<Profile | null>(null);
	let error = $state('');

	const profile = $derived<Profile>(
		pending ?? {
			name: user.name,
			uo95: user.uo95,
			permanentAddress: user.permanentAddress,
			studentEmail: user.studentEmail,
			phone: user.phone,
			idCardFrontFileId: user.idCardFrontFileId,
			idCardBackFileId: user.idCardBackFileId
		}
	);

	async function save(patch: Partial<Profile>) {
		const next = { ...profile, ...patch };
		pending = next;
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertUserProfile, next);
		} catch (err) {
			error = errorMessage(err);
		} finally {
			if (pending === next) pending = null;
		}
	}
</script>

<dl class="border-t border-line">
	<FieldRow label="Name" value={profile.name} oncommit={(name) => save({ name })} />
	<FieldRow
		label="UO email"
		value={profile.studentEmail}
		oncommit={(studentEmail) => save({ studentEmail })}
	/>
	<FieldRow label="Phone" value={profile.phone} oncommit={(phone) => save({ phone })} />
	<FieldRow label="UO ID" value={profile.uo95} oncommit={(uo95) => save({ uo95 })} />
	<FieldRow
		label="Address"
		value={profile.permanentAddress}
		oncommit={(permanentAddress) => save({ permanentAddress })}
	/>
</dl>
<div class="ids">
	<div class="flex gap-3">
		<DocumentPicker
			fileId={profile.idCardFrontFileId}
			kind="id_front"
			label="Front"
			onchange={(idCardFrontFileId) => save({ idCardFrontFileId })}
		/>
		<DocumentPicker
			fileId={profile.idCardBackFileId}
			kind="id_back"
			label="Back"
			onchange={(idCardBackFileId) => save({ idCardBackFileId })}
		/>
	</div>
	<p class="text-sm text-quiet">
		{profile.idCardFrontFileId && profile.idCardBackFileId
			? 'Your UO ID card. Tap a side to replace it.'
			: 'Engage needs both sides of your UO ID card when you get paid back.'}
	</p>
</div>
{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}

<style>
	.ids {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 12px 20px;
		border-bottom: 1px solid var(--line);
		padding: 14px 0;
	}

	.ids p {
		margin: 0;
		max-width: 24rem;
	}
</style>
