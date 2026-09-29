<script lang="ts">
	import { stageLabels, type Stage } from '$convex/lifecycle';

	let { stage }: { stage: Stage } = $props();
</script>

<span class="pill {stage}">{stageLabels[stage]}</span>

<style>
	.pill {
		display: inline-flex;
		height: 24px;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 8px;
		font-size: 12.5px;
		font-weight: 550;
		white-space: nowrap;
		color: var(--ink);
	}

	.pill::before {
		content: '';
		width: 7px;
		height: 7px;
		background: currentColor;
	}

	.reading {
		border-color: var(--marker-deep);
		background: var(--marker-soft);
	}

	.reading::before {
		background: var(--marker-deep);
		animation: blink 1.4s ease-in-out infinite;
	}

	.after_event {
		color: var(--quiet);
	}

	.after_event::before,
	.filled::before {
		width: 5px;
		height: 5px;
		border: 1.5px solid currentColor;
		background: transparent;
	}

	.to_finish {
		border-color: var(--marker-deep);
	}

	.to_finish::before {
		background: var(--marker-deep);
	}

	.ready {
		border-color: var(--pine);
		background: var(--pine-soft);
		color: var(--pine-deep);
	}

	.filled {
		border-color: var(--pine);
		color: var(--pine-deep);
	}

	.approved {
		border-color: var(--pine);
		background: var(--pine);
		color: white;
	}

	@keyframes blink {
		50% {
			opacity: 0.25;
		}
	}
</style>
