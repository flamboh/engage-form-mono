<script lang="ts">
	import {
		AGENT_FIELD_DURATIONS,
		AGENT_TOTAL_MS,
		computeShown,
		FIELDS,
		getActiveField,
		isUploadField,
		MAX_SCROLL_INDEX,
		PROGRAMMATIC_SCROLL_MS,
		ROW_SLOT,
		START_DELAY_MS,
		SUBMIT_ROW_INDEX,
		USER_SCROLL_RESET_MS,
		VIEW_HEIGHT,
		YOU_FIELD_DURATIONS,
		YOU_TOTAL_MS,
		type DemoKind
	} from './demo';

	let {
		title,
		kind,
		t,
		accent = false
	} = $props<{
		title: string;
		kind: DemoKind;
		t: number;
		accent?: boolean;
	}>();

	let viewport: HTMLDivElement | undefined = $state();
	let userScrolling = $state(false);
	let resetTimer: ReturnType<typeof setTimeout> | undefined;
	let programmaticTimer: ReturnType<typeof setTimeout> | undefined;
	let programmaticScroll = false;
	let lastTargetScrollTop = 0;

	const fieldDurations = $derived(kind === 'you' ? YOU_FIELD_DURATIONS : AGENT_FIELD_DURATIONS);
	const totalMs = $derived(kind === 'you' ? YOU_TOTAL_MS : AGENT_TOTAL_MS);
	const playback = $derived.by(() => {
		const effective = t - START_DELAY_MS;
		const started = effective >= 0;
		const clamped = Math.max(0, Math.min(effective, totalMs));
		const done = started && effective >= totalMs;
		const activeField = started && !done ? getActiveField(clamped, fieldDurations) : undefined;

		return {
			done,
			activeIndex: activeField?.index ?? -1,
			intra: activeField?.intra ?? 0,
			activeDuration: activeField?.duration ?? 0
		};
	});
	const targetScrollTop = $derived.by(() => {
		const followIndex = playback.done ? SUBMIT_ROW_INDEX : Math.max(0, playback.activeIndex);
		const scrollIndex = Math.max(0, Math.min(MAX_SCROLL_INDEX, followIndex - 1));

		return scrollIndex * ROW_SLOT;
	});

	$effect(() => {
		lastTargetScrollTop = targetScrollTop;
		if (userScrolling || !viewport) return;
		scrollToTarget(targetScrollTop);
	});

	$effect(() => {
		return () => {
			clearTimeout(resetTimer);
			clearTimeout(programmaticTimer);
		};
	});

	function handleScroll() {
		if (programmaticScroll) return;

		userScrolling = true;
		clearTimeout(resetTimer);
		resetTimer = setTimeout(() => {
			userScrolling = false;
			scrollToTarget(lastTargetScrollTop);
		}, USER_SCROLL_RESET_MS);
	}

	function scrollToTarget(top: number) {
		if (!viewport) return;

		programmaticScroll = true;
		clearTimeout(programmaticTimer);
		viewport.scrollTo({ top, behavior: 'smooth' });
		programmaticTimer = setTimeout(() => {
			programmaticScroll = false;
		}, PROGRAMMATIC_SCROLL_MS);
	}
</script>

<div
	class={`relative rounded-2xl border bg-card p-5 shadow-sm md:p-6 ${
		accent ? 'border-primary/50 ring-1 ring-primary/10' : 'border-border'
	}`}
>
	<div class="mb-4 border-b border-border pb-3">
		<p class="font-heading text-base font-medium">{title}</p>
	</div>

	<div
		bind:this={viewport}
		class="relative overflow-y-auto pr-2"
		style:height={`${VIEW_HEIGHT}px`}
		aria-label={`${title} demo viewport`}
		onscroll={handleScroll}
	>
		<div class="flex flex-col gap-3">
			{#each FIELDS as field, index (field.label)}
				{@const active = index === playback.activeIndex}
				{@const fieldMs = active ? playback.activeDuration : (fieldDurations[index] ?? 0)}
				{@const filled = playback.done || index < playback.activeIndex}
				{@const upload = isUploadField(field.label)}
				{@const uploadDone = upload && (filled || (active && playback.intra > fieldMs * 0.7))}
				{@const shown = upload
					? uploadDone
						? field.value
						: ''
					: computeShown({
							value: field.value,
							kind,
							active,
							intra: active ? playback.intra : 0,
							fieldMs,
							filled
						})}
				{@const pasted = kind === 'agent' && active && shown.length > 0}
				{@const uploadLoading = upload && active && !uploadDone}

				<div>
					<p class="mb-1 h-4 text-[10px] leading-4 tracking-wider text-muted-foreground uppercase">
						{field.label}
					</p>

					{#if upload}
						<div class="relative flex h-9 items-center">
							<span
								class={`inline-flex h-8 max-w-full items-center justify-start gap-2 truncate rounded-md border bg-background px-3 text-sm font-medium transition-colors ${
									active ? 'border-primary ring-2 ring-primary/25' : 'border-input'
								} ${shown.length === 0 || uploadLoading ? 'text-muted-foreground' : ''} ${
									pasted ? 'bg-primary/10' : ''
								}`}
							>
								{#if uploadLoading}
									<span
										aria-hidden="true"
										class="inline-block size-3 animate-spin rounded-full border-2 border-current/30 border-t-current"
									></span>
								{/if}
								{uploadLoading ? 'Uploading' : shown || 'Choose file'}
							</span>
						</div>
					{:else}
						<div
							class={`relative flex h-9 items-center rounded-md border bg-background px-3 text-sm transition-colors duration-150 ${
								active ? 'border-primary ring-2 ring-primary/25' : 'border-border'
							}`}
						>
							<span class={`truncate ${pasted ? '-mx-0.5 rounded bg-primary/10 px-0.5' : ''}`}>
								{shown}
							</span>
							{#if active && kind === 'you'}
								<span
									aria-hidden="true"
									class="ml-px inline-block h-4 w-px animate-pulse bg-foreground"
								></span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}

			<button
				type="button"
				disabled={!playback.done}
				class={`inline-flex h-8 w-full items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition disabled:pointer-events-none disabled:opacity-50 ${
					playback.done ? 'ring-2 ring-primary/25' : ''
				}`}
			>
				Submit
			</button>
		</div>
	</div>
</div>
