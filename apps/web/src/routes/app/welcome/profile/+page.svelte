<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$convex/_generated/api';
	import ProfileForm from '$lib/welcome/ProfileForm.svelte';
	import { useQuery } from 'convex-svelte';

	const currentUserQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, {});
</script>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">About you</h1>
	<p class="text-sm text-quiet">
		Engage asks for these on every reimbursement. Add them once and we’ll fill them in each time.
	</p>
</div>

{#if currentUserQuery.data !== undefined}
	<ProfileForm
		user={currentUserQuery.data}
		submitLabel="Continue"
		onSaved={() => goto('/app/welcome/org')}
	/>
{/if}
