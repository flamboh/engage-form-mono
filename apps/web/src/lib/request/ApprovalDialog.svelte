<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import {
		approvalRequestBody,
		mailtoUrl,
		resolveApprovalEmail,
		type ApprovalEmailField,
		type ApprovalEmailPart,
		type Approver
	} from '$convex/approvalEmail';
	import type { RequestEditor } from './editor.svelte';
	import type { LeftField } from './whatsLeft';

	export type SavedApprover = Approver & { id: Id<'approvers'> };

	let {
		editor,
		approvers,
		requesterName,
		requesterEmail,
		onremember,
		onforget,
		onjump
	}: {
		editor: RequestEditor;
		approvers: SavedApprover[];
		requesterName: string;
		requesterEmail: string;
		onremember: (approver: Approver) => void;
		onforget: (id: Id<'approvers'>) => void;
		onjump: (field: LeftField) => void;
	} = $props();

	const missingCopy: Partial<
		Record<ApprovalEmailField, { blank: string; ask: string; field: LeftField | null }>
	> = {
		itemDescription: { blank: 'items', ask: 'what was bought', field: 'itemDescription' },
		vendor: { blank: 'store', ask: 'the store', field: 'vendor' },
		totalAmount: { blank: 'total', ask: 'the total', field: 'totalAmount' },
		eventName: { blank: 'event', ask: 'which event', field: 'why' },
		dates: { blank: 'date', ask: 'the event date', field: 'why' },
		purchaser: { blank: 'purchaser', ask: 'who paid', field: 'purchaser' },
		studentOrganization: { blank: 'organization', ask: 'your organization’s name', field: null }
	};

	let dialog = $state<HTMLDialogElement | null>(null);
	let edited = $state<Approver | null>(null);
	let copied = $state<'subject' | 'body' | null>(null);
	let copyFailed = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	const approver = $derived(
		edited ??
			(approvers[0] === undefined
				? { name: '', email: '' }
				: { name: approvers[0].name, email: approvers[0].email })
	);
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
	const email = $derived(request === null ? null : resolveApprovalEmail(request, approver));
	const firstName = $derived(approver.name.trim().split(/\s+/)[0] ?? '');
	const address = $derived(approver.email.trim());
	const notUo = $derived(address !== '' && !/@uoregon\.edu$/i.test(address));
	const isSelf = $derived(
		address !== '' && address.toLowerCase() === requesterEmail.trim().toLowerCase()
	);
	const mailto = $derived(
		request === null || email?.subject.text == null || email.body.text === null
			? null
			: mailtoUrl({
					to: address,
					subject: email.subject.text,
					body: approvalRequestBody({
						request,
						approval: email.body.text,
						approverName: approver.name,
						requesterName
					})
				})
	);

	function lines(parts: ApprovalEmailPart[]) {
		const out: ApprovalEmailPart[][] = [[]];
		for (const part of parts) {
			if (part.kind === 'missing') {
				out[out.length - 1].push(part);
				continue;
			}
			part.text.split('\n').forEach((text, index) => {
				if (index > 0) out.push([]);
				if (text !== '') out[out.length - 1].push({ kind: 'text', text });
			});
		}
		return out;
	}

	export function show() {
		copied = null;
		copyFailed = false;
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	function setApprover(patch: Partial<Approver>) {
		edited = { ...approver, ...patch };
	}

	function remember() {
		if (approver.name.trim() === '' && address === '') return;
		onremember({ name: approver.name.trim(), email: address });
	}

	async function copy(which: 'subject' | 'body') {
		const text = which === 'subject' ? email?.subject.text : email?.body.text;
		if (text == null) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			copyFailed = true;
			return;
		}
		copyFailed = false;
		copied = which;
		if (which === 'body') remember();
		if (copiedTimer !== null) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = null), 2000);
	}

	function jump(field: LeftField) {
		close();
		onjump(field);
	}
</script>

{#snippet written(parts: ApprovalEmailPart[])}
	{#each parts as part, index (index)}
		{#if part.kind === 'text'}{part.text}{:else}<span class="blank"
				>{missingCopy[part.variable]?.blank ?? part.variable}</span
			>{/if}
	{/each}
{/snippet}

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
					You paid, so another officer has to OK it in writing. Send them this email; their reply is
					your Second Approval.
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
			{#if approvers.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each approvers as saved (saved.id)}
						{@const chosen =
							saved.email.toLowerCase() === address.toLowerCase() &&
							saved.name === approver.name.trim()}
						<span class={['chip flex items-stretch border text-sm', chosen && 'is-chosen']}>
							<button
								class="px-2.5 py-1 focus-visible:outline-2 focus-visible:outline-(--pine)"
								type="button"
								aria-pressed={chosen}
								onclick={() => (edited = { name: saved.name, email: saved.email })}
							>
								{saved.name || saved.email}
							</button>
							<button
								class="forget border-l px-1.5 text-(--quiet) hover:text-(--ink) focus-visible:outline-2 focus-visible:outline-(--pine)"
								type="button"
								aria-label={`Forget ${saved.name || saved.email}`}
								onclick={() => {
									if (chosen) edited = { name: '', email: '' };
									onforget(saved.id);
								}}
							>
								×
							</button>
						</span>
					{/each}
				</div>
			{/if}
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="flex flex-col gap-1.5 text-sm text-(--quiet)">
					Their name
					<input
						class="input"
						autocomplete="off"
						placeholder="First and last name"
						value={approver.name}
						oninput={(event) => setApprover({ name: event.currentTarget.value })}
					/>
				</label>
				<label class="flex flex-col gap-1.5 text-sm text-(--quiet)">
					Their UO email
					<input
						class="input"
						type="email"
						autocomplete="off"
						inputmode="email"
						placeholder="name@uoregon.edu"
						value={approver.email}
						oninput={(event) => setApprover({ email: event.currentTarget.value })}
					/>
				</label>
			</div>
			{#if isSelf}
				<p class="text-sm text-(--alert)">This should be another officer, not you.</p>
			{:else if notUo}
				<p class="text-sm text-(--quiet)">Engage looks for a UO email, ending in @uoregon.edu.</p>
			{:else if approver.name.trim() === '' || address === ''}
				<p class="text-sm text-(--quiet)">
					Their name and UO email go in the signature. Engage looks for both.
				</p>
			{/if}
		</fieldset>

		{#if email !== null}
			<article class="sheet border border-(--line) bg-white" aria-label="Approval email">
				<dl class="grid grid-cols-[4.5rem_minmax(0,1fr)] border-b border-(--line) text-sm">
					<dt class="px-4 py-2.5 text-(--quiet)">To</dt>
					<dd class="min-w-0 truncate py-2.5 pr-4 text-(--ink)">
						{#if address === ''}<span class="text-(--quiet)">their UO email</span
							>{:else}{address}{/if}
					</dd>
					<dt class="border-t border-(--line) px-4 py-2.5 text-(--quiet)">Subject</dt>
					<dd
						class="flex min-w-0 items-baseline justify-between gap-3 border-t border-(--line) py-2.5 pr-3"
					>
						<span class="min-w-0 font-medium text-(--ink)"
							>{@render written(email.subject.parts)}</span
						>
						<button
							class="shrink-0 text-sm text-(--pine) underline focus-visible:outline-2 focus-visible:outline-(--pine) disabled:text-(--quiet) disabled:no-underline"
							type="button"
							disabled={email.subject.text === null}
							onclick={() => void copy('subject')}
						>
							{copied === 'subject' ? 'Copied' : 'Copy subject'}
						</button>
					</dd>
				</dl>
				<div class="letter px-4 py-4 text-[0.9375rem] leading-relaxed text-(--ink) sm:px-5">
					{#each lines(email.body.parts) as line, index (index)}
						<p class="min-h-[1.625em]">{@render written(line)}</p>
					{/each}
				</div>
			</article>

			{#if email.missing.length > 0}
				<p class="text-sm text-(--ink)">
					To finish it, add
					{#each email.missing as variable, index (variable)}
						{@const copy = missingCopy[variable]}
						{index === 0 ? '' : index === email.missing.length - 1 ? ' and ' : ', '}
						{#if copy?.field}
							{@const field = copy.field}
							<button
								class="text-(--pine) underline focus-visible:outline-2 focus-visible:outline-(--pine)"
								type="button"
								onclick={() => jump(field)}>{copy.ask}</button
							>
						{:else if copy}
							<a class="text-(--pine) underline" href="/app/saved">{copy.ask}</a>
						{:else}
							{variable}
						{/if}
					{/each}
					to this request.
				</p>
			{/if}

			<div class="flex flex-col gap-2">
				<div class="flex flex-wrap gap-2">
					{#if mailto === null}
						<button
							class="bg-(--pine) px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
							type="button"
							disabled>Email it to {firstName || 'them'}</button
						>
					{:else}
						<a
							class="bg-(--pine) px-4 py-2.5 text-sm font-medium text-white hover:bg-(--pine-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine)"
							href={mailto}
							onclick={remember}>Email it to {firstName || 'them'}</a
						>
					{/if}
					<button
						class="border border-(--ink) bg-white px-4 py-2.5 text-sm font-medium text-(--ink) hover:bg-(--ink) hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--pine) disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-(--ink)"
						type="button"
						disabled={email.body.text === null}
						onclick={() => void copy('body')}
					>
						{copied === 'body' ? 'Copied' : 'Copy message'}
					</button>
				</div>
				<p class="text-sm text-(--quiet)" aria-live="polite">
					{#if copyFailed}
						Couldn’t copy. Select the text above instead.
					{:else}
						Opens your email app with a short ask and this message for {firstName || 'them'} to send back.
						Or copy it and send it any way you like.
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

	.chip {
		border-color: var(--line);
		background: white;
		color: var(--ink);
	}

	.chip .forget {
		border-color: var(--line);
	}

	.chip.is-chosen {
		border-color: var(--pine);
		background: var(--pine-soft);
	}

	.chip.is-chosen .forget {
		border-color: color-mix(in oklab, var(--pine) 40%, var(--line));
	}

	.sheet {
		box-shadow: 4px 4px 0 var(--pine-soft);
	}

	.letter {
		font-family: ui-serif, Georgia, 'Times New Roman', serif;
	}

	.blank {
		padding-inline: 0.15em;
		border-bottom: 1.5px dashed var(--quiet);
		background: color-mix(in oklab, var(--marker) 35%, transparent);
		color: var(--quiet);
		font-family: inherit;
	}

	.next {
		border-color: var(--marker-deep);
	}
</style>
