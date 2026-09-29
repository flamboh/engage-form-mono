<script lang="ts">
	import ExtensionConnector from '$lib/extension/ExtensionConnector.svelte';
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
		<ExtensionConnector>
			<OnboardingGate>
				{@render children()}
			</OnboardingGate>
		</ExtensionConnector>
	</ConvexWrapper>
</ClerkWrapper>
