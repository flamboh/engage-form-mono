<script lang="ts">
	import OnboardingGate from '$lib/welcome/OnboardingGate.svelte';
	import ClerkWrapper from '$lib/wrappers/ClerkWrapper.svelte';
	import ConvexWrapper from '$lib/wrappers/ConvexWrapper.svelte';

	const { children } = $props();
</script>

<svelte:head>
	<title>Engage Form</title>
</svelte:head>

<ClerkWrapper>
	<ConvexWrapper>
		<OnboardingGate>
			{@render children()}
		</OnboardingGate>
	</ConvexWrapper>
</ClerkWrapper>
