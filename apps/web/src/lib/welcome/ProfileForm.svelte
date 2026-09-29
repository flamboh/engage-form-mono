<script lang="ts">
	import { untrack } from 'svelte';
	import { api } from '$convex/_generated/api';
	import type { Doc } from '$convex/_generated/dataModel';
	import { errorMessage } from '$lib/errors';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import Button from '$lib/ui/Button.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
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
	let saving = $state(false);
	let error = $state('');

	async function save(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		saving = true;
		try {
			await client.mutation(api.authed.purchaseBuilder.upsertUserProfile, {
				name: name.trim(),
				uo95: uo95.trim(),
				permanentAddress: permanentAddress.trim(),
				studentEmail: studentEmail.trim(),
				phone: phone.trim(),
				idCardFrontFileId: start?.idCardFrontFileId ?? null,
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
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Full name
		<input class="input" required autocomplete="name" bind:value={name} />
	</label>
	<div class="grid gap-5 sm:grid-cols-2">
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			UO email
			<input
				class="input"
				type="email"
				required
				autocomplete="email"
				placeholder="duck@uoregon.edu"
				bind:value={studentEmail}
			/>
		</label>
		<label class="flex flex-col gap-1.5 text-sm font-medium">
			Phone
			<input class="input" type="tel" required autocomplete="tel" bind:value={phone} />
		</label>
	</div>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		UO ID number
		<input class="input" required inputmode="numeric" placeholder="95…" bind:value={uo95} />
	</label>
	<label class="flex flex-col gap-1.5 text-sm font-medium">
		Permanent address
		<input
			class="input"
			required
			autocomplete="street-address"
			placeholder="Where reimbursement checks can reach you"
			bind:value={permanentAddress}
		/>
	</label>
	<p class="text-sm text-quiet">
		We’ll ask for photos of your UO ID card the first time you get paid back.
	</p>
	{#if error}<InlineError message={error} />{/if}
	<div>
		<Button variant="primary" type="submit" busy={saving}>
			{saving ? 'Saving…' : submitLabel}
		</Button>
	</div>
</form>
