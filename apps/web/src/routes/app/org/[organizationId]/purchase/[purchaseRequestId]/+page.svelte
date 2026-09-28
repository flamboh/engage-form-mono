<script lang="ts">
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import type { Id } from '$convex/_generated/dataModel';
	import LiveRequest from '$lib/request/LiveRequest.svelte';

	const organizationId = $derived(page.params.organizationId as Id<'organizations'>);
	const purchaseRequestId = $derived(page.params.purchaseRequestId as Id<'purchaseRequests'>);
	const mock = $derived(dev ? page.url.searchParams.get('mock') : null);
</script>

{#if mock !== null}
	{#await import('$lib/request/fixtures/MockRequest.svelte') then module}
		<module.default scenario={mock} />
	{/await}
{:else}
	{#key purchaseRequestId}
		<LiveRequest {organizationId} {purchaseRequestId} />
	{/key}
{/if}
