<script lang="ts">
	import type { Doc, Id } from '$convex/_generated/dataModel';
	import {
		defaultApproverTitle,
		resolveApprovalMessage,
		type ApprovalField,
		type ApprovalPart,
		type Approver
	} from '$convex/approvalMessage';
	import type { StepId } from '$convex/requestView';
	import Chip from '$lib/ui/Chip.svelte';
	import type { RequestBackend, RequestEditor } from './editor.svelte';

	let {
		editor,
		purchasers,
		requesterName,
		requesterEmail,
		onsave,
		onjump
	}: {
		editor: RequestEditor;
		purchasers: Doc<'purchasers'>[];
		requesterName: string;
		requesterEmail: string;
		onsave: RequestBackend['saveApprover'];
		onjump: (step: StepId) => void;
	} = $props();

	const blanks: Record<ApprovalField, string> = {
		itemDescription: 'items',
		vendor: 'store',
		totalAmount: 'total',
		eventName: 'event',
		dates: 'date',
		purchaser: 'purchaser',
		studentOrganization: 'organization',
		approverName: 'their name',
		approverEmail: 'their UO email'
	};

	const asks: Partial<Record<ApprovalField, { ask: string; field: StepId | null }>> = {
		itemDescription: { ask: 'what was bought', field: 'receipt' },
		vendor: { ask: 'the store', field: 'receipt' },
		totalAmount: { ask: 'the total', field: 'receipt' },
		eventName: { ask: 'which event', field: 'event' },
		dates: { ask: 'the event date', field: 'event' },
		purchaser: { ask: 'who paid', field: 'purchaser' },
		studentOrganization: { ask: 'your organization’s name', field: null }
	};

	let dialog = $state<HTMLDialogElement | null>(null);
	let choice = $state<Id<'purchasers'> | 'other' | null>(null);
	let edits = $state<Partial<Approver>>({});
	let copied = $state(false);
	let copyFailed = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	const same = (a: string, b: string) =>
		a.trim() !== '' && a.trim().toLowerCase() === b.trim().toLowerCase();
	const candidates = $derived(
		purchasers
			.filter(
				(purchaser) =>
					!purchaser.archived &&
					!same(purchaser.name, requesterName) &&
					!same(purchaser.email ?? '', requesterEmail)
			)
			.toSorted((a, b) => (b.approverUsedAt ?? 0) - (a.approverUsedAt ?? 0))
	);
	const chosenId = $derived(
		choice ??
			(candidates.length === 0
				? 'other'
				: candidates.length === 1 || candidates[0].approverUsedAt !== undefined
					? candidates[0]._id
					: null)
	);
	const chosen = $derived(candidates.find((purchaser) => purchaser._id === chosenId));
	const request = $derived.by(() => {
		const purchase = editor.purchase;
		const form = editor.form;
		if (purchase === undefined || form === null) return null;
		return {
			...purchase,
			purchaser: form.purchaser,
			vendor: form.vendor,
			itemDescription: form.itemDescription,
			totalAmount: form.totalAmount ?? 0,
			purpose: form.purpose,
			activity: form.activity
		};
	});
	const approver = $derived<Approver>({
		name: chosen?.name ?? edits.name ?? '',
		email: edits.email ?? chosen?.email ?? '',
		title:
			edits.title ?? chosen?.title ?? defaultApproverTitle(request?.studentOrganization.name ?? '')
	});
	const message = $derived(request === null ? null : resolveApprovalMessage(request, approver));
	const requestMissing = $derived(message?.missing.filter((field) => field in asks) ?? []);
	const firstName = $derived(approver.name.trim().split(/\s+/)[0] ?? '');
	const address = $derived(approver.email.trim());
	const notUo = $derived(address !== '' && !/@uoregon\.edu$/i.test(address));
	const isSelf = $derived(same(address, requesterEmail) || same(approver.name, requesterName));

	export function show() {
		copied = false;
		copyFailed = false;
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function pick(next: Id<'purchasers'> | 'other') {
		choice = next;
		edits = {};
		copied = false;
	}

	async function copy() {
		const text = message?.text;
		if (text == null) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			copyFailed = true;
			return;
		}
		copyFailed = false;
		copied = true;
		if (copiedTimer !== null) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 2000);
		const saving = { ...approver, purchaserId: chosen?._id ?? null };
		const id = await onsave(saving).catch(() => null);
		if (id !== null && saving.purchaserId === null && choice === 'other') choice = id;
	}

	function jump(field: StepId) {
		close();
		onjump(field);
	}
</script>

<dialog
	bind:this={dialog}
	class="approval"
	aria-labelledby="approval-title"
	onclick={(event) => {
		if (event.target === event.currentTarget) close();
	}}
>
	<div class="flex flex-col gap-5 p-5 sm:p-7">
		<header class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-1">
				<h2 id="approval-title" class="text-xl font-semibold tracking-tight text-(--ink)">
					Get it approved
				</h2>
				<p class="max-w-md text-sm text-(--quiet)">
					You paid, so another officer has to OK it in writing. Text them this to email back to you.
				</p>
			</div>
			<button
				class="shrink-0 px-1 text-sm text-(--quiet) underline hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
				type="button"
				onclick={close}
			>
				Close
			</button>
		</header>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-3 text-sm font-medium text-(--ink)">Who’s approving?</legend>
			<div class="flex flex-wrap gap-2">
				{#each candidates as purchaser (purchaser._id)}
					<Chip selected={purchaser._id === chosenId} onclick={() => pick(purchaser._id)}>
						{purchaser.name}
					</Chip>
				{/each}
				<Chip
					variant={chosenId === 'other' ? 'choice' : 'add'}
					selected={chosenId === 'other'}
					onclick={() => pick('other')}
				>
					Someone else
				</Chip>
			</div>
			{#if chosenId !== null}
				<div class={['grid gap-3', chosenId === 'other' ? 'sm:grid-cols-3' : 'sm:grid-cols-2']}>
					{#if chosenId === 'other'}
						<label class="flex flex-col gap-1.5 text-sm text-(--quiet)">
							Their name
							<input
								class="input"
								autocomplete="off"
								placeholder="First and last name"
								value={approver.name}
								oninput={(event) => (edits.name = event.currentTarget.value)}
							/>
						</label>
					{/if}
					<label class="flex flex-col gap-1.5 text-sm text-(--quiet)">
						Their UO email
						<input
							class="input"
							type="email"
							autocomplete="off"
							inputmode="email"
							placeholder="name@uoregon.edu"
							value={approver.email}
							oninput={(event) => (edits.email = event.currentTarget.value)}
						/>
					</label>
					<label class="flex flex-col gap-1.5 text-sm text-(--quiet)">
						Their title
						<input
							class="input"
							autocomplete="off"
							value={approver.title}
							oninput={(event) => (edits.title = event.currentTarget.value)}
						/>
					</label>
				</div>
			{/if}
			{#if isSelf}
				<p class="text-sm text-(--alert)">This should be another officer, not you.</p>
			{:else if notUo}
				<p class="text-sm text-(--quiet)">Engage looks for a UO email, ending in @uoregon.edu.</p>
			{:else if chosenId !== null && (approver.name.trim() === '' || address === '')}
				<p class="text-sm text-(--quiet)">
					Their name and UO email go in the signature. Engage looks for both.
				</p>
			{/if}
		</fieldset>

		{#if message !== null}
			<div
				class="message border border-(--line) bg-white px-4 py-4 text-[0.9375rem] leading-relaxed whitespace-pre-wrap text-(--ink) sm:px-5"
				aria-label="Message to copy"
			>
				{#each message.parts as part, index (index)}{#if part.kind === 'text'}{part.text}{:else}<span
							class="blank">{blanks[part.field]}</span
						>{/if}{/each}
			</div>

			{#if requestMissing.length > 0}
				<p class="text-sm text-(--ink)">
					To finish it, add
					{#each requestMissing as field, index (field)}
						{@const ask = asks[field]}
						{index === 0 ? '' : index === requestMissing.length - 1 ? ' and ' : ', '}
						{#if ask?.field}
							{@const step = ask.field}
							<button
								class="text-(--pine) underline focus-visible:outline-2 focus-visible:outline-(--pine)"
								type="button"
								onclick={() => jump(step)}>{ask.ask}</button
							>
						{:else if ask}
							<a
								class="text-(--pine) underline"
								href={`/app/settings#org-${editor.view?.purchase.organizationSourceId ?? ''}`}
								>{ask.ask}</a
							>
						{/if}
					{/each}
					to this request.
				</p>
			{/if}

			<div class="flex flex-wrap items-center gap-3">
				<button
					class="bg-(--pine) px-4 py-2.5 text-sm font-medium text-white hover:bg-(--pine-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine) disabled:opacity-40 disabled:hover:bg-(--pine)"
					type="button"
					disabled={message.text === null}
					onclick={() => void copy()}
				>
					{copied ? 'Copied' : 'Copy message'}
				</button>
				<p class="text-sm text-(--quiet)" aria-live="polite">
					{#if copyFailed}
						Couldn’t copy. Select the text above instead.
					{:else if copied}
						Text it to {firstName || 'them'}.
					{/if}
				</p>
			</div>

			<p class="next border-l-2 py-1 pl-3 text-sm text-(--ink)">
				When {firstName === '' ? 'they reply' : `${firstName} replies`}, screenshot the email or
				print it to PDF, then drop it on this request. We’ll file it as the Second Approval.
			</p>
		{/if}
	</div>
</dialog>

<style>
	.approval {
		margin: auto;
		width: min(40rem, calc(100% - 2rem));
		max-height: calc(100dvh - 2rem);
		overflow-y: auto;
		border: 1px solid var(--line);
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 24px 60px -24px color-mix(in oklab, var(--ink) 45%, transparent);
	}

	.approval::backdrop {
		background: color-mix(in oklab, var(--ink) 40%, transparent);
	}

	.approval[open] {
		animation: rise 180ms ease-out;
	}

	@media (width < 40rem) {
		.approval {
			margin: auto 0 0;
			width: 100%;
			max-width: 100%;
			max-height: 92dvh;
			border-inline: 0;
			border-bottom: 0;
		}
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.approval[open] {
			animation: none;
		}
	}

	.message {
		box-shadow: 4px 4px 0 var(--pine-soft);
		overflow-wrap: anywhere;
	}

	.blank {
		padding-inline: 0.15em;
		border-bottom: 1.5px dashed var(--quiet);
		background: color-mix(in oklab, var(--marker) 35%, transparent);
		color: var(--quiet);
	}

	.next {
		border-color: var(--marker-deep);
	}
</style>
