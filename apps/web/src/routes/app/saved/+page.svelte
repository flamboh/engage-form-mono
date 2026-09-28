<script lang="ts">
	import { api } from '$convex/_generated/api';
	import type { Id } from '$convex/_generated/dataModel';
	import AppShell from '$lib/app/AppShell.svelte';
	import PurchaserForm from '$lib/app/PurchaserForm.svelte';
	import TemplateForm from '$lib/app/TemplateForm.svelte';
	import { errorMessage, secondaryButtonClass } from '$lib/app/styles';
	import OrganizationForm from '$lib/welcome/OrganizationForm.svelte';
	import ProfileForm from '$lib/welcome/ProfileForm.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	type Table = 'organizations' | 'purchasers' | 'businessPurposeTemplates';

	const client = useConvexClient();
	let showArchived = $state(false);
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, () => ({
		includeArchived: showArchived
	}));
	const currentUserQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, {});

	const saved = $derived(savedQuery.data);
	const user = $derived(currentUserQuery.data ?? null);
	const activeOrganizations = $derived(saved?.organizations.filter((org) => !org.archived) ?? []);
	const organizationName = $derived(
		new Map(saved?.organizations.map((org) => [org._id as string, org.name]) ?? [])
	);

	let editing = $state<string | null>(null);
	let error = $state('');

	function toggle(key: string) {
		editing = editing === key ? null : key;
		error = '';
	}

	function closeEditor() {
		editing = null;
	}

	async function setArchived(
		table: Table,
		id: Id<'organizations'> | Id<'purchasers'> | Id<'businessPurposeTemplates'>,
		archived: boolean
	) {
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.setArchived, { table, id, archived });
			editing = null;
		} catch (err) {
			error = errorMessage(err);
		}
	}

	function fundDescription(fundLetter: string) {
		return fundLetter === 'I' ? 'ASUO funded' : `Fund ${fundLetter}`;
	}

	function preview(text: string) {
		return text.replace(/\{([^}]+)\}/g, '$1').slice(0, 140);
	}
</script>

<svelte:head>
	<title>Saved info · Engage Form</title>
</svelte:head>

{#snippet rowActions(key: string, table: Table, id: Id<Table>, archived: boolean)}
	<div class="flex shrink-0 items-center gap-1">
		{#if !archived}
			<button
				class="rounded-full px-3 py-1.5 text-sm font-medium text-[#154733] hover:bg-[#154733]/10"
				type="button"
				aria-expanded={editing === key}
				onclick={() => toggle(key)}
			>
				{editing === key ? 'Close' : 'Edit'}
			</button>
		{/if}
		<button
			class="rounded-full px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 hover:text-stone-900"
			type="button"
			onclick={() => setArchived(table, id, !archived)}
		>
			{archived ? 'Restore' : 'Archive'}
		</button>
	</div>
{/snippet}

<AppShell>
	<main class="mx-auto flex max-w-2xl flex-col gap-12 px-4 pt-10 pb-16 sm:px-6">
		<div class="flex flex-col gap-2">
			<h1 class="text-2xl font-semibold tracking-tight">Saved info</h1>
			<p class="text-sm text-stone-600">Everything here fills in new requests automatically.</p>
		</div>

		{#if error}<p class="text-sm text-red-700" role="alert">{error}</p>{/if}

		<section class="flex flex-col gap-3">
			<h2 class="text-lg font-semibold">You</h2>
			<div class="border-y border-stone-200 py-4">
				<div class="flex items-center justify-between gap-4">
					<div class="min-w-0">
						<p class="truncate font-medium">{user?.name ?? ' '}</p>
						<p class="truncate text-sm text-stone-500">
							{user ? `${user.studentEmail} · ${user.phone}` : ''}
						</p>
					</div>
					<button
						class="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[#154733] hover:bg-[#154733]/10"
						type="button"
						aria-expanded={editing === 'profile'}
						onclick={() => toggle('profile')}
					>
						{editing === 'profile' ? 'Close' : 'Edit'}
					</button>
				</div>
				{#if editing === 'profile' && currentUserQuery.data !== undefined}
					<div class="pt-5">
						<ProfileForm {user} submitLabel="Save" onSaved={closeEditor} />
					</div>
				{/if}
			</div>
		</section>

		<section id="organizations" class="flex scroll-mt-20 flex-col gap-3">
			<div class="flex items-center justify-between gap-4">
				<h2 class="text-lg font-semibold">Organizations</h2>
				<button class={secondaryButtonClass} type="button" onclick={() => toggle('org:new')}>
					Add organization
				</button>
			</div>
			<ul class="divide-y divide-stone-200 border-y border-stone-200">
				{#if editing === 'org:new'}
					<li class="py-5">
						<OrganizationForm
							organization={null}
							submitLabel="Add organization"
							showTemplate
							onSaved={closeEditor}
							onCancel={closeEditor}
						/>
					</li>
				{/if}
				{#each saved?.organizations ?? [] as org (org._id)}
					{@const key = `org:${org._id}`}
					<li class="py-4" class:opacity-60={org.archived}>
						<div class="flex items-center justify-between gap-4">
							<div class="min-w-0">
								<p class="truncate font-medium">{org.name}</p>
								<p class="text-sm text-stone-500">
									{fundDescription(org.fundLetter)} · {org.budgetLines.length}
									{org.budgetLines.length === 1 ? 'budget line' : 'budget lines'}
								</p>
							</div>
							{@render rowActions(key, 'organizations', org._id, org.archived)}
						</div>
						{#if editing === key}
							<div class="pt-5">
								<OrganizationForm
									organization={org}
									submitLabel="Save"
									showTemplate
									onSaved={closeEditor}
									onCancel={closeEditor}
								/>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-semibold">Purchasers</h2>
					<p class="text-sm text-stone-500">Other people who pay for things and get paid back.</p>
				</div>
				<button
					class={secondaryButtonClass}
					type="button"
					disabled={activeOrganizations.length === 0}
					onclick={() => toggle('purchaser:new')}
				>
					Add purchaser
				</button>
			</div>
			<ul class="divide-y divide-stone-200 border-y border-stone-200">
				{#if editing === 'purchaser:new'}
					<li class="py-5">
						<PurchaserForm
							purchaser={null}
							organizations={activeOrganizations}
							onDone={closeEditor}
						/>
					</li>
				{/if}
				{#each saved?.purchasers ?? [] as purchaser (purchaser._id)}
					{@const key = `purchaser:${purchaser._id}`}
					<li class="py-4" class:opacity-60={purchaser.archived}>
						<div class="flex items-center justify-between gap-4">
							<div class="min-w-0">
								<p class="truncate font-medium">{purchaser.name}</p>
								<p class="truncate text-sm text-stone-500">
									{organizationName.get(purchaser.organizationId) ?? ''}
								</p>
							</div>
							{@render rowActions(key, 'purchasers', purchaser._id, purchaser.archived)}
						</div>
						{#if editing === key}
							<div class="pt-5">
								<PurchaserForm
									{purchaser}
									organizations={activeOrganizations}
									onDone={closeEditor}
								/>
							</div>
						{/if}
					</li>
				{:else}
					{#if editing !== 'purchaser:new'}
						<li class="py-4 text-sm text-stone-500">
							When someone else pays, add them here so their details fill in.
						</li>
					{/if}
				{/each}
			</ul>
		</section>

		<section class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-4">
				<div>
					<h2 class="text-lg font-semibold">Business purpose templates</h2>
					<p class="text-sm text-stone-500">Reasons you use again and again.</p>
				</div>
				<button
					class={secondaryButtonClass}
					type="button"
					disabled={activeOrganizations.length === 0}
					onclick={() => toggle('template:new')}
				>
					Add template
				</button>
			</div>
			<ul class="divide-y divide-stone-200 border-y border-stone-200">
				{#if editing === 'template:new'}
					<li class="py-5">
						<TemplateForm
							template={null}
							organizations={activeOrganizations}
							onDone={closeEditor}
						/>
					</li>
				{/if}
				{#each saved?.businessPurposeTemplates ?? [] as template (template._id)}
					{@const key = `template:${template._id}`}
					<li class="py-4" class:opacity-60={template.archived}>
						<div class="flex items-center justify-between gap-4">
							<div class="min-w-0">
								<p class="truncate font-medium">{template.title}</p>
								<p class="line-clamp-2 text-sm text-stone-500">
									{preview(template.businessPurposeTemplate)}
								</p>
							</div>
							{@render rowActions(key, 'businessPurposeTemplates', template._id, template.archived)}
						</div>
						{#if editing === key}
							<div class="pt-5">
								<TemplateForm
									{template}
									organizations={activeOrganizations}
									onDone={closeEditor}
								/>
							</div>
						{/if}
					</li>
				{:else}
					{#if editing !== 'template:new'}
						<li class="py-4 text-sm text-stone-500">
							Save a reason once, like weekly meeting snacks, and pick it on any request.
						</li>
					{/if}
				{/each}
			</ul>
		</section>

		<label class="flex items-center gap-2 self-start text-sm text-stone-600">
			<input class="h-4 w-4 accent-[#154733]" type="checkbox" bind:checked={showArchived} />
			Show archived
		</label>
	</main>
</AppShell>
