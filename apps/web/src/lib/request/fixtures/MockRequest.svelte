<script lang="ts">
	import type { Id } from '$convex/_generated/dataModel';
	import type { DocumentSlot, RequestView } from '$convex/requestView';
	import { startUploads, uploadsFor, type UploadTransport } from '$lib/uploads.svelte';
	import type { RequestBackend } from '../editor.svelte';
	import { slotField } from '../editor.svelte';
	import RequestPage from '../RequestPage.svelte';
	import type { SavedApprover } from '../ApprovalDialog.svelte';
	import { untrack } from 'svelte';
	import {
		mockApprovers,
		mockEngageUrl,
		mockOrganizationId,
		mockRead,
		mockReceiptImage,
		mockRequestId,
		mockSaved,
		mockUser,
		scenarioNames,
		scenarioView,
		withReadiness
	} from './fixtures';
	import { confirmMockCheck } from './checks';

	let { scenario }: { scenario: string } = $props();

	const initialScenario = untrack(() => scenario);
	const initial = scenarioView(initialScenario);
	let view = $state<RequestView>(initial);
	let approvers = $state<SavedApprover[]>(mockApprovers());
	const pending = $derived(uploadsFor(mockRequestId));
	const session = { getToken: async () => null };
	const files: Record<string, File> = {};
	let counter = 0;

	void refresh();
	if (initialScenario === 'drop') {
		void fetch(mockReceiptImage)
			.then((response) => response.blob())
			.then((blob) => {
				backend.upload([new File([blob], 'IMG_2291.svg', { type: 'image/svg+xml' })], 'auto');
			});
	}

	async function refresh() {
		const next = await withReadiness($state.snapshot(view) as RequestView);
		view.readiness = next.readiness;
		view.businessPurposeText = next.businessPurposeText;
		view.checks = next.checks;
	}

	const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

	const transport: UploadTransport = {
		prepare: async (file) => file,
		put: async (file) => {
			await wait(700);
			const r2Key = `mock_upload_${++counter}`;
			files[r2Key] = file;
			return { r2Key, filename: file.name, contentType: file.type, size: file.size };
		},
		attach: async (_requestId, stored, slot) => {
			await wait(250);
			const fileId = stored.r2Key as Id<'files'>;
			const kind: DocumentSlot = slot === 'auto' ? 'receipt' : slot;
			view.documents.push({
				fileId,
				kind,
				filename: stored.filename,
				contentType: stored.contentType,
				previewUrl: null,
				reading: kind === 'receipt',
				readFailed: false
			});
			if (kind === 'receipt') {
				view.purchase.receiptFileIds = [...view.purchase.receiptFileIds, fileId];
				view.reading = true;
			} else if (kind !== 'recipient_list') {
				Object.assign(view.purchase, { [slotField[kind]]: fileId });
			}
			await refresh();
			if (view.reading) void finishReading();
			return fileId;
		}
	};

	async function finishReading() {
		await wait(2600);
		view.reading = false;
		for (const document of view.documents) document.reading = false;
		if (!view.purchase.vendor) view.purchase.vendor = mockRead.vendor;
		if (!view.purchase.itemDescription) view.purchase.itemDescription = mockRead.itemDescription;
		if (!view.purchase.totalAmount) view.purchase.totalAmount = mockRead.totalAmount;
		view.purchase.receiptDate = mockRead.receiptDate;
		view.reviews = [{ field: 'totalAmount', value: '36.18', alternatives: ['33.95', '38.40'] }];
		await refresh();
	}

	const backend: RequestBackend = {
		saveSnapshot: async (snapshot) => {
			await wait(120);
			const { totalAmount, ...rest } = snapshot;
			Object.assign(view.purchase, rest, { totalAmount: totalAmount ?? 0 });
			await refresh();
		},
		resolveReview: async (field, value) => {
			await wait(150);
			if (field === 'totalAmount') view.purchase.totalAmount = Number(value) || 0;
			else if (field === 'vendor') view.purchase.vendor = value;
			else if (field === 'itemDescription') view.purchase.itemDescription = value;
			else view.purchase.receiptDate = value;
			view.reviews = view.reviews.filter((review) => review.field !== field);
			await refresh();
		},
		retryReading: async (fileId) => {
			await wait(150);
			for (const document of view.documents) {
				if (document.fileId === fileId) {
					document.readFailed = false;
					document.reading = true;
				}
			}
			view.reading = true;
			void finishReading();
		},
		freshPreview: async () => mockReceiptImage,
		removeDocument: async (fileId) => {
			await wait(150);
			view.documents = view.documents.filter((document) => document.fileId !== fileId);
			view.purchase.receiptFileIds = view.purchase.receiptFileIds.filter((id) => id !== fileId);
			for (const field of Object.values(slotField)) {
				if ((view.purchase as Record<string, unknown>)[field] === fileId) {
					Object.assign(view.purchase, { [field]: null });
				}
			}
			await refresh();
		},
		requestFill: async () => {
			await wait(400);
			if (!view.readiness.ready) throw new Error('Purchase request is not ready.');
			view.purchase.status = 'ready';
			setTimeout(() => (view.purchase.lastFilledAt = Date.now()), 5000);
			return { engageUrl: mockEngageUrl };
		},
		markApproved: async () => {
			await wait(150);
			view.purchase.status = 'approved';
		},
		reopen: async () => {
			await wait(150);
			view.purchase.status = 'ready';
		},
		discard: async () => {
			await wait(150);
		},
		rememberApprover: async (approver) => {
			await wait(120);
			const rest = approvers.filter(
				(saved) => saved.email.toLowerCase() !== approver.email.toLowerCase()
			);
			approvers = [{ id: `mock_approver_${++counter}` as Id<'approvers'>, ...approver }, ...rest];
		},
		forgetApprover: async (id) => {
			await wait(120);
			approvers = approvers.filter((saved) => saved.id !== id);
		},
		answerFoodPackaging: async (packaged) => {
			await wait(120);
			view.purchase.foodIndividuallyPackaged = packaged;
			await refresh();
		},
		confirmCheck: async (checkId) => {
			await wait(120);
			view.purchase.checkConfirmations = confirmMockCheck(view, checkId);
			await refresh();
		},
		upload: (files, slot) => {
			startUploads(session, mockRequestId, files, slot, transport);
		}
	};
</script>

<nav
	class="fixed top-2 left-1/2 z-50 flex hidden -translate-x-1/2 flex-wrap gap-1 bg-black/80 p-1 text-xs text-white lg:flex"
	aria-label="Mock scenarios"
>
	{#each scenarioNames as name (name)}
		<a
			class="px-1.5 py-0.5 hover:bg-white/20"
			class:bg-white={name === scenario}
			class:text-black={name === scenario}
			href={`?mock=${name}`}
			data-sveltekit-reload>{name}</a
		>
	{/each}
</nav>

<RequestPage
	{view}
	saved={mockSaved}
	user={mockUser}
	recentPurposes={[
		'snacks for the general meeting',
		'prizes for the bouldering comp',
		'gear swap supplies'
	]}
	{approvers}
	organizationId={mockOrganizationId}
	{pending}
	{backend}
/>
