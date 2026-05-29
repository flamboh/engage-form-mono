<script lang="ts">
	import type { Doc } from '$convex/_generated/dataModel';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Input } from '$lib/components/ui/input';
	import * as NavigationMenu from '$lib/components/ui/navigation-menu';
	import * as Select from '$lib/components/ui/select';
	import { Textarea } from '$lib/components/ui/textarea';
	import { getClerkContext } from '$lib/stores/clerk.svelte';

	type OrganizationForm = {
		name: string;
		indexNumber: string;
		fundLetter: Doc<'organizations'>['fundLetter'];
		budgetLines: string;
		businessPurposeTemplate: string;
	};

	let {
		organizations = [],
		createOpen = $bindable(false),
		form = $bindable<OrganizationForm>(),
		error = '',
		onCreate
	}: {
		organizations?: Doc<'organizations'>[];
		createOpen?: boolean;
		form: OrganizationForm;
		error?: string;
		onCreate: () => void | Promise<void>;
	} = $props();

	const clerkContext = getClerkContext();

	const funds = ['I', 'E', 'G', 'N', 'U', 'D', 'T'] as const;
</script>

<header class="border-b border-border bg-background">
	<div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
		<nav class="flex items-center gap-1">
			<a class="rounded-3xl px-4 py-2 text-sm font-medium hover:bg-muted" href="/app">Home</a>
			<NavigationMenu.Root viewport={false}>
				<NavigationMenu.List>
					<NavigationMenu.Item>
						<NavigationMenu.Trigger>Orgs</NavigationMenu.Trigger>
						<NavigationMenu.Content class="min-w-64">
							<div class="flex flex-col gap-1">
								{#each organizations as org (org._id)}
									<NavigationMenu.Link href={`/app/org/${org._id}`}>{org.name}</NavigationMenu.Link>
								{/each}
								<button
									class="rounded-2xl p-3 text-left text-sm font-medium transition-colors hover:bg-muted"
									type="button"
									onclick={() => (createOpen = true)}
								>
									Create new org
								</button>
							</div>
						</NavigationMenu.Content>
					</NavigationMenu.Item>
				</NavigationMenu.List>
			</NavigationMenu.Root>
		</nav>
		<div
			{@attach (el) => {
				clerkContext.clerk.mountUserButton(el);
			}}
		></div>
	</div>
</header>

<Dialog.Dialog bind:open={createOpen}>
	<Dialog.DialogContent>
		<Dialog.DialogHeader>
			<Dialog.DialogTitle>Create org</Dialog.DialogTitle>
			<Dialog.DialogDescription
				>Add the funding defaults used for new purchase requests.</Dialog.DialogDescription
			>
		</Dialog.DialogHeader>
		<form
			class="flex flex-col gap-4"
			onsubmit={(event) => {
				event.preventDefault();
				void onCreate();
			}}
		>
			<label class="flex flex-col gap-2 text-sm font-medium">
				Name
				<Input required bind:value={form.name} />
			</label>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="flex flex-col gap-2 text-sm font-medium">
					Index number
					<Input required bind:value={form.indexNumber} />
				</label>
				<label class="flex flex-col gap-2 text-sm font-medium">
					Fund
					<Select.Select type="single" bind:value={form.fundLetter}>
						<Select.Trigger class="w-full">{form.fundLetter}</Select.Trigger>
						<Select.Content>
							<Select.Group>
								{#each funds as fund (fund)}
									<Select.Item value={fund}>Fund {fund}</Select.Item>
								{/each}
							</Select.Group>
						</Select.Content>
					</Select.Select>
				</label>
			</div>
			<label class="flex flex-col gap-2 text-sm font-medium">
				Budget lines
				<Input required bind:value={form.budgetLines} placeholder="Programming, Marketing" />
			</label>
			<label class="flex flex-col gap-2 text-sm font-medium">
				Business Purpose Template
				<Textarea required bind:value={form.businessPurposeTemplate} />
			</label>
			{#if error}
				<p class="text-sm text-destructive">{error}</p>
			{/if}
			<Dialog.DialogFooter>
				<Button type="submit">Create org</Button>
			</Dialog.DialogFooter>
		</form>
	</Dialog.DialogContent>
</Dialog.Dialog>
