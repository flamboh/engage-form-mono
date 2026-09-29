<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { api } from '$convex/_generated/api';
	import AppShell from '$lib/app/AppShell.svelte';
	import ExtensionSteps from '$lib/app/ExtensionSteps.svelte';
	import SettingsOrganization from '$lib/app/settings/SettingsOrganization.svelte';
	import SettingsYou from '$lib/app/settings/SettingsYou.svelte';
	import { errorMessage } from '$lib/errors';
	import { getExtensionConnection } from '$lib/extension/connection.svelte';
	import ExtensionStatus from '$lib/extension/ExtensionStatus.svelte';
	import { getClerkContext } from '$lib/stores/clerk.svelte';
	import Button from '$lib/ui/Button.svelte';
	import FieldRow from '$lib/ui/FieldRow.svelte';
	import InlineError from '$lib/ui/InlineError.svelte';
	import OrganizationForm from '$lib/welcome/OrganizationForm.svelte';
	import { useConvexClient, useQuery } from 'convex-svelte';

	const client = useConvexClient();
	const clerkContext = getClerkContext();
	const connection = getExtensionConnection();
	const savedQuery = useQuery(api.authed.purchaseBuilder.listSaved, { includeArchived: true });
	const userQuery = useQuery(api.authed.purchaseBuilder.getCurrentUser, {});
	const sessionsQuery = useQuery(api.authed.extensionSessions.listExtensionSessions, {});

	const organizations = $derived(
		savedQuery.data?.organizations.filter((org) => !org.archived) ?? []
	);
	const archivedOrganizations = $derived(
		savedQuery.data?.organizations.filter((org) => org.archived) ?? []
	);
	const purchasers = $derived(savedQuery.data?.purchasers ?? []);
	const ready = $derived(savedQuery.data !== undefined && userQuery.data !== undefined);
	const connected = $derived(connection.state(sessionsQuery.data) === 'connected');
	const signInEmail = $derived(clerkContext.currentUser?.primaryEmailAddress?.emailAddress ?? '');
	const nav = $derived([
		{ id: 'you', label: 'You', group: null },
		...organizations.map((org) => ({
			id: `org-${org._id}`,
			label: org.name,
			group: 'Organizations'
		})),
		{ id: 'new-org', label: 'Add an organization', group: 'Organizations' },
		{ id: 'extension', label: 'Extension', group: null },
		{ id: 'account', label: 'Account', group: null }
	]);

	let active = $state('you');
	let addingOrganization = $state(false);
	let error = $state('');

	function spy(container: HTMLElement) {
		void nav.length;
		const sections = [...container.querySelectorAll<HTMLElement>('section[id]')];
		const observer = new IntersectionObserver(
			(entries) => {
				const visible = entries.filter((entry) => entry.isIntersecting);
				if (visible.length > 0) active = visible[0].target.id;
			},
			{ rootMargin: '-15% 0px -70% 0px' }
		);
		for (const section of sections) observer.observe(section);
		return () => observer.disconnect();
	}

	function scrollToHash(container: HTMLElement) {
		const id = page.url.hash.slice(1);
		if (id === '') return;
		container.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView();
		active = id;
	}

	async function restore(id: (typeof archivedOrganizations)[number]['_id']) {
		error = '';
		try {
			await client.mutation(api.authed.purchaseBuilder.setArchived, {
				table: 'organizations',
				id,
				archived: false
			});
		} catch (err) {
			error = errorMessage(err);
		}
	}
</script>

<svelte:head>
	<title>Settings · Engage Form</title>
</svelte:head>

<AppShell>
	<div class="settings">
		<nav class="side" aria-label="Settings">
			{#each nav as item, index (item.id)}
				{#if item.group && nav[index - 1]?.group !== item.group}
					<small>{item.group}</small>
				{/if}
				<a
					href={`#${item.id}`}
					class:on={active === item.id}
					class:add={item.id === 'new-org'}
					aria-current={active === item.id ? 'location' : undefined}
					onclick={() => (active = item.id)}
				>
					{item.label}
				</a>
			{/each}
		</nav>

		{#if ready}
			<div class="content" {@attach spy} {@attach scrollToHash}>
				<section id="you">
					<h2>You</h2>
					<p>
						Engage asks for these on every reimbursement. Changes save as you go and apply to new
						requests.
					</p>
					{#if userQuery.data}
						<SettingsYou user={userQuery.data} />
					{:else}
						<Button variant="secondary" href="/app/welcome/profile">Add your details</Button>
					{/if}
				</section>

				{#each organizations as organization (organization._id)}
					<section id={`org-${organization._id}`}>
						<h2>{organization.name}</h2>
						<p>Filled into every request for this organization.</p>
						<SettingsOrganization
							{organization}
							purchasers={purchasers.filter((item) => item.organizationId === organization._id)}
						/>
					</section>
				{/each}

				<section id="new-org">
					<h2>Add an organization</h2>
					<p>These come from the organization’s budget.</p>
					{#if addingOrganization || page.url.hash === '#new-org'}
						<OrganizationForm
							submitLabel="Add organization"
							onSaved={async (id) => {
								addingOrganization = false;
								await goto(`/app/settings#org-${id}`);
							}}
							onCancel={() => {
								addingOrganization = false;
								if (page.url.hash === '#new-org')
									void goto('/app/settings', { replaceState: true });
							}}
						/>
					{:else}
						<Button variant="secondary" onclick={() => (addingOrganization = true)}>
							Add an organization
						</Button>
					{/if}
					{#if archivedOrganizations.length > 0}
						<details class="archived">
							<summary>Archived organizations ({archivedOrganizations.length})</summary>
							<dl>
								{#each archivedOrganizations as organization (organization._id)}
									<FieldRow
										label="Organization"
										value={organization.name}
										actionLabel="Restore"
										onaction={() => restore(organization._id)}
									/>
								{/each}
							</dl>
						</details>
					{/if}
					{#if error}<div class="pt-3"><InlineError message={error} /></div>{/if}
				</section>

				<section id="extension">
					<h2>Extension</h2>
					<p>It types a ready request into Engage.</p>
					{#if connected}
						<ExtensionStatus />
					{:else}
						<ExtensionSteps />
					{/if}
				</section>

				<section id="account">
					<h2>Account</h2>
					<dl class="border-t border-line">
						<FieldRow
							label="Signed in as"
							value={signInEmail}
							actionLabel="Manage sign-in"
							onaction={() => clerkContext.clerk.openUserProfile()}
						/>
					</dl>
					<div class="pt-4">
						<Button variant="secondary" size="sm" onclick={() => clerkContext.clerk.signOut()}>
							Sign out
						</Button>
					</div>
				</section>
			</div>
		{:else if savedQuery.error || userQuery.error}
			<InlineError message={(savedQuery.error ?? userQuery.error)?.message ?? ''} />
		{:else}
			<p class="text-sm text-quiet">Loading…</p>
		{/if}
	</div>
</AppShell>

<style>
	.settings {
		display: grid;
		width: 100%;
		max-width: 980px;
		grid-template-columns: 200px minmax(0, 1fr);
		gap: 48px;
		margin: 0 auto;
		padding: 32px 32px 64px;
	}

	.side {
		position: sticky;
		top: 16px;
		display: flex;
		flex-direction: column;
		align-self: start;
		gap: 2px;
	}

	.side a {
		border-left: 2px solid transparent;
		padding: 8px 10px;
		font-size: 14.5px;
		color: var(--quiet);
		text-decoration: none;
	}

	.side a.on {
		border-left-color: var(--ink);
		font-weight: 550;
		color: var(--ink);
	}

	.side a.add {
		font-size: 13.5px;
	}

	.side small {
		padding: 14px 10px 4px;
		font-size: 12.5px;
		color: var(--faint);
	}

	section {
		margin-bottom: 44px;
		scroll-margin-top: 16px;
	}

	h2 {
		margin: 0 0 4px;
		font-size: 21px;
		font-weight: 620;
		letter-spacing: -0.015em;
	}

	section > p {
		margin: 0 0 14px;
		font-size: 14px;
		color: var(--quiet);
	}

	.archived summary {
		cursor: pointer;
		padding: 16px 0 4px;
		font-size: 13.5px;
		color: var(--quiet);
	}

	@media (max-width: 760px) {
		.settings {
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
			padding: 0 16px 64px;
		}

		.side {
			top: 0;
			z-index: 10;
			flex-direction: row;
			margin: 0 -16px 18px;
			overflow-x: auto;
			border-bottom: 1px solid var(--line);
			background: var(--surface);
			padding: 0 8px;
			scrollbar-width: none;
		}

		.side small,
		.side a.add {
			display: none;
		}

		.side a {
			flex: none;
			border-bottom: 2px solid transparent;
			border-left: 0;
			padding: 12px 8px;
			font-size: 14px;
			white-space: nowrap;
		}

		.side a.on {
			border-bottom-color: var(--ink);
		}

		section {
			scroll-margin-top: 56px;
		}
	}
</style>
