<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import DocumentPicker from '$lib/app/DocumentPicker.svelte';
	import { errorMessage, inputClass, labelClass, primaryButtonClass } from '$lib/app/styles';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import { useConvexClient } from 'convex-svelte';

	let {
		user,
		submitLabel,
		onSaved
	}: {
		user: Doc<'users'> | null;
		submitLabel: string;
		onSaved: () => void | Promise<void>;
	} = $props();

	const clerkContext = getClerkContext();
	const client = useConvexClient();
	const start = untrack(() => user);
	const clerkUser = untrack(() => clerkContext.currentUser);

	let name = $state(start?.name ?? clerkUser?.fullName ?? '');
	let studentEmail = $state(
		start?.studentEmail ??
			clerkUser?.emailAddresses.find((email) => email.emailAddress.endsWith('@uoregon.edu'))
				?.emailAddress ??
			''
	);
	let phone = $state(start?.phone ?? '');
	let uo95 = $state(start?.uo95 ?? '');
	let permanentAddress = $state(start?.permanentAddress ?? '');
	let idCardFrontFileId = $state<Id<'files'> | null>(start?.idCardFrontFileId ?? null);
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (idCardFrontFileId === null) {
			error = 'Add a photo of your UO ID card to continue.';
			return;
		}
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertUserProfile, {
				name: name.trim(),
				uo95: uo95.trim(),
				permanentAddress: permanentAddress.trim(),
				studentEmail: studentEmail.trim(),
				phone: phone.trim(),
				idCardFrontFileId,
				idCardBackFileId: start?.idCardBackFileId ?? null
			});
			await onSaved();
		} catch (err) {
			error = errorMessage(err);
		} finally {
			saving = false;
		}
	}
</script>

<form class="flex flex-col gap-5" onsubmit={save}>
	<label class={labelClass}>
		Full name
		<input class={inputClass} required autocomplete="name" bind:value={name} />
	</label>
	<div class="grid gap-5 sm:grid-cols-2">
		<label class={labelClass}>
			UO email
			<input
				class={inputClass}
				type="email"
				required
				autocomplete="email"
				placeholder="duck@uoregon.edu"
				bind:value={studentEmail}
			/>
		</label>
		<label class={labelClass}>
			Phone
			<input class={inputClass} type="tel" required autocomplete="tel" bind:value={phone} />
		</label>
	</div>
	<label class={labelClass}>
		UO ID number
		<input class={inputClass} required inputmode="numeric" placeholder="95…" bind:value={uo95} />
	</label>
	<label class={labelClass}>
		Permanent address
		<input
			class={inputClass}
			required
			autocomplete="street-address"
			placeholder="Where reimbursement checks can reach you"
			bind:value={permanentAddress}
		/>
	</label>
	<DocumentPicker
		bind:fileId={idCardFrontFileId}
		kind="id_front"
		label="Photo of your UO ID card"
		hint="Engage asks for it on every reimbursement. We keep it so you only add it once."
	/>
	{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}
	<div>
		<button class={primaryButtonClass} type="submit" disabled={saving}>
			{saving ? 'Saving…' : submitLabel}
		</button>
	</div>
</form>
