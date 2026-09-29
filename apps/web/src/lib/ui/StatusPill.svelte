<script lang="ts">
	import type { Stage } from '$convex/lifecycle';

	let { stage }: { stage: Stage } = $props();

	const labels: Record<Stage, string> = {
		reading: 'Reading',
		after_event: 'After the event',
		to_finish: 'To finish',
		ready: 'Ready',
		filled: 'Filled',
		approved: 'Approved'
	};

	const tone: Record<Stage, string> = {
		reading: 'border-line text-quiet',
		after_event: 'border-line text-ink',
		to_finish: 'border-marker-deep bg-marker-soft text-ink',
		ready: 'border-pine bg-pine-soft text-pine-deep',
		filled: 'border-pine text-pine-deep',
		approved: 'border-pine bg-pine text-white'
	};

	const mark: Record<Stage, string> = {
		reading: 'border border-current',
		after_event: 'border border-current',
		to_finish: 'bg-marker-deep',
		ready: 'bg-pine',
		filled: 'border border-current',
		approved: 'bg-white'
	};
</script>

<span
	class="inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium whitespace-nowrap {tone[
		stage
	]}"
>
	<span class="h-2 w-2 shrink-0 {mark[stage]}" aria-hidden="true"></span>
	{labels[stage]}
</span>
