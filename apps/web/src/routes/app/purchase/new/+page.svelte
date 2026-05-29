<script lang="ts">
	import { goto } from '$app/navigation';

	$effect(() => {
		void goto('/app', { replaceState: true });
	});
</script>

<main class="grid min-h-screen place-items-center bg-background px-6 text-sm text-muted-foreground">
	Choose an org first.
</main>
