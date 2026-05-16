<script lang="ts">
	import ClerkWrapper from '$lib/wrappers/ClerkWrapper.svelte';
	import ConvexWrapper from '$lib/wrappers/ConvexWrapper.svelte';

	const { children } = $props();
</script>

<svelte:head>
	<title>Conference Tracker</title>
</svelte:head>

<ClerkWrapper>
	<ConvexWrapper>
		{@render children()}
	</ConvexWrapper>
</ClerkWrapper>
