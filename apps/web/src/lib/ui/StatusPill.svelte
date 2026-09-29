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
</script>

<span
	class="pill is-{stage} inline-flex shrink-0 items-center gap-1.5 border px-2 py-1 text-xs font-medium"
>
	<span class="mark size-2 shrink-0" aria-hidden="true"></span>
	{labels[stage]}
</span>

<style>
	.pill {
		border-color: var(--line);
		background: var(--surface);
		color: var(--ink);
	}

	.mark {
		border: 1px solid var(--ink);
	}

	.is-reading,
	.is-to_finish {
		border-color: var(--marker-deep);
		background: var(--marker-soft);
	}

	.is-reading .mark,
	.is-to_finish .mark {
		border-color: var(--marker-deep);
		background: var(--marker-deep);
	}

	.is-ready,
	.is-filled,
	.is-approved {
		border-color: var(--pine);
	}

	.is-ready {
		background: var(--pine-soft);
	}

	.is-ready .mark,
	.is-approved .mark {
		border-color: var(--pine);
		background: var(--pine);
	}

	.is-filled .mark {
		border-color: var(--pine);
	}

	.is-approved {
		background: var(--pine);
		color: white;
	}

	.is-approved .mark {
		border-color: white;
		background: white;
	}
</style>
