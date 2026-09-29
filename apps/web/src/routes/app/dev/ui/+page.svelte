<script lang="ts">
	import type { Stage } from '$convex/lifecycle';
	import Banner from '$lib/ui/Banner.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Chip from '$lib/ui/Chip.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import SectionHeader from '$lib/ui/SectionHeader.svelte';
	import SourceCue from '$lib/ui/SourceCue.svelte';
	import StatusPill from '$lib/ui/StatusPill.svelte';

	const stages: Stage[] = ['reading', 'after_event', 'to_finish', 'ready', 'filled', 'approved'];
	let chosen = $state('Weekly listening event');
	let vendor = $state('Safeway');
	let total = $state('18.20');
	let line = $state('Event Expenses');
</script>

<svelte:head>
	<title>UI specimens · Engage Form</title>
</svelte:head>

<main class="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-8">
	<h1 class="text-2xl font-semibold tracking-tight">UI specimens</h1>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Button" level={3} />
		<div class="flex flex-wrap items-center gap-3">
			<Button variant="primary">Fill on Engage</Button>
			<Button variant="secondary">Finish now</Button>
			<Button variant="quiet">Start empty</Button>
			<Button variant="primary" size="sm">Fill on Engage</Button>
			<Button variant="secondary" size="sm">Mark approved</Button>
			<Button variant="primary" busy>Saving…</Button>
			<Button variant="secondary" href="/app/settings">Settings</Button>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Chip" level={3} />
		<div class="flex flex-wrap gap-2">
			{#each ['Weekly listening event', 'Trivia night'] as name (name)}
				<Chip selected={chosen === name} onclick={() => (chosen = name)}>{name}</Chip>
			{/each}
			<Chip variant="add" onclick={() => {}}>New event</Chip>
			<Chip disabled onclick={() => {}}>Disabled</Chip>
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Status pill" level={3} />
		<div class="flex flex-wrap gap-2">
			{#each stages as stage (stage)}<StatusPill {stage} />{/each}
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Section header" level={3} />
		<SectionHeader title="To finish" count={2} hint="These need you now." />
		<SectionHeader title="Budget lines" level={3}>
			{#snippet action()}<Button variant="quiet" size="sm">Add line</Button>{/snippet}
		</SectionHeader>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Source cue" level={3} />
		<div class="flex flex-wrap gap-4">
			<SourceCue source="receipt" />
			<SourceCue source="previous" />
			<SourceCue source="suggested" />
			<SourceCue source="event" label="from Weekly listening event" />
		</div>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Field row" level={3} />
		<dl class="border-t border-line">
			<FieldRow label="Store" value={vendor} cue="receipt" oncommit={(value) => (vendor = value)} />
			<FieldRow
				label="Total"
				value={total}
				display={`$${total}`}
				type="money"
				oncommit={(value) => (total = value)}
			/>
			<FieldRow
				label="Charged to"
				value={line}
				cue="previous"
				actionLabel="Change"
				onaction={() => (line = line === 'Food' ? 'Event Expenses' : 'Food')}
			/>
			<FieldRow label="Office location" value="" placeholder="Not needed" readonly />
		</dl>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Empty state" level={3} />
		<EmptyState
			title="No requests yet."
			body="Drop a receipt the next time you buy something for the club."
		/>
		<EmptyState title="No budget yet." body="Add what each line was allocated to see what's left.">
			{#snippet action()}<Button variant="secondary" size="sm">Add allocations</Button>{/snippet}
		</EmptyState>
	</section>

	<section class="flex flex-col gap-4">
		<SectionHeader title="Errors" level={3} />
		<InlineError message="Index number missing." />
		<InlineError
			message="The receipt didn’t upload."
			fix={{ label: 'Try again', onclick: () => {} }}
		/>
		<Banner
			message="The extension isn’t connected in this browser."
			fix={{ label: 'Connect', onclick: () => {} }}
		/>
	</section>
</main>
