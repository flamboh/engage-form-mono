<script lang="ts">
	import { goto } from '$app/navigation';
	import OrganizationForm from '$lib/welcome/OrganizationForm.svelte';
</script>

<div class="flex flex-col gap-2">
	<h1 class="text-2xl font-semibold tracking-tight">Your student organization</h1>
	<p class="text-sm text-stone-600">
		These come from your organization's budget. You can add more organizations later.
	</p>
</div>

<OrganizationForm
	organization={null}
	submitLabel="Continue"
	onSaved={() => goto('/app/welcome/event')}
/>
