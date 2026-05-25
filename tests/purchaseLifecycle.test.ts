import { expect, test } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import { getReadyPurchaseForFill, listReadyPurchases } from '../convex/authed/extension';
import { getDraft } from '../convex/authed/purchaseBuilder';
import { saveDraftPatch } from '../convex/internal/purchaseAutosave';
import { parseBusinessPurposeText } from '../convex/purchaseModel';

const readyRequest = {
	_id: 'purchase_1',
	_creationTime: 1,
	owner: 'owner',
	status: 'ready',
	typeOfPurchase: 'personal_reimbursement',
	documentationCategories: [],
	organizationSourceId: null,
	purchaserSource: { kind: 'self' },
	studentOrganization: {
		name: 'Album Listening Club',
		indexNumber: 'OS353i',
		fundLetter: 'I',
		budgetLines: ['Event Expenses'],
		businessPurposeTemplate: ''
	},
	requester: {
		id: 'user_1',
		name: 'Oliver Boorstein',
		email: 'obo@uoregon.edu',
		phone: '9073104429',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	purchaser: {
		id: 'user_1',
		name: 'Oliver Boorstein',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back'
	},
	eventName: 'Listening party',
	eventDate: '2026-05-22',
	eventTime: '6:30 PM',
	eventLocation: 'EMU',
	eventEstimatedAttendance: 50,
	vendor: 'Amazon',
	itemDescription: 'record',
	totalAmount: 22.98,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: 'Other processes are too slow.',
	businessPurposeSource: parseBusinessPurposeText('Reimburse {Purchaser} for {Item Description}.'),
	businessPurposeTouched: true,
	receiptFileIds: ['file_receipt'],
	secondApprovalFileId: 'file_approval',
	publicityFileId: 'file_publicity',
	cateringWaiverFileId: null,
	printingInvoiceFileId: null,
	brandApprovalFileId: null,
	officeLocation: '',
	buildingManagerApprovalFileId: null,
	computerPriceQuoteFileId: null,
	recipients: [],
	createdAt: 1,
	updatedAt: 1,
	lastFilledAt: null
} as Doc<'purchaseRequests'>;

test('Ready Purchase Requests can be opened in the editor', async () => {
	await expect(
		getDraft._handler(editorCtx(readyRequest) as never, {
			id: readyRequest._id
		})
	).resolves.toMatchObject({
		_id: readyRequest._id,
		status: 'ready'
	});
});

test('fact edits return Ready Purchase Requests to Draft', async () => {
	const patches: Partial<Doc<'purchaseRequests'>>[] = [];

	await saveDraftPatch._handler(saveCtx(readyRequest, patches) as never, {
		id: readyRequest._id,
		owner: readyRequest.owner,
		patch: { itemDescription: 'cassette' }
	});

	expect(patches).toHaveLength(1);
	expect(patches[0]).toMatchObject({ status: 'draft', itemDescription: 'cassette' });
});

test('document edits return Ready Purchase Requests to Draft', async () => {
	const patches: Partial<Doc<'purchaseRequests'>>[] = [];

	await saveDraftPatch._handler(saveCtx(readyRequest, patches) as never, {
		id: readyRequest._id,
		owner: readyRequest.owner,
		patch: { receiptFileIds: ['file_receipt_2' as never] }
	});

	expect(patches).toHaveLength(1);
	expect(patches[0]).toMatchObject({
		status: 'draft',
		receiptFileIds: ['file_receipt_2']
	});
});

test('extension lists only Ready Purchase Requests', async () => {
	const rows = [
		readyRequest,
		{ ...readyRequest, _id: 'purchase_2', status: 'draft', itemDescription: 'draft' }
	] as Doc<'purchaseRequests'>[];

	await expect(listReadyPurchases._handler(extensionListCtx(rows) as never, {})).resolves.toEqual([
		{
			id: 'purchase_1',
			status: 'ready',
			organization: 'Album Listening Club',
			purchaser: 'Oliver Boorstein',
			itemDescription: 'record',
			totalAmount: 22.98,
			updatedAt: 1,
			lastFilledAt: null
		}
	]);
});

test('extension refuses Draft fill payloads', async () => {
	await expect(
		getReadyPurchaseForFill._handler(
			extensionGetCtx({ ...readyRequest, status: 'draft' }) as never,
			{
				id: readyRequest._id
			}
		)
	).rejects.toThrow('Purchase request is not ready.');
});

test('extension fill payload includes resolved Business Purpose plain text', async () => {
	await expect(
		getReadyPurchaseForFill._handler(extensionGetCtx(readyRequest) as never, {
			id: readyRequest._id
		})
	).resolves.toMatchObject({
		status: 'ready',
		businessPurposeText: 'Reimburse Oliver Boorstein for record.'
	});
});

function saveCtx(request: Doc<'purchaseRequests'>, patches: Partial<Doc<'purchaseRequests'>>[]) {
	return {
		db: {
			get: async () => request,
			patch: async (_id: string, patch: Partial<Doc<'purchaseRequests'>>) => {
				patches.push(patch);
			}
		}
	};
}

function editorCtx(request: Doc<'purchaseRequests'>) {
	return {
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async () => request
		}
	};
}

function extensionListCtx(rows: Doc<'purchaseRequests'>[]) {
	return {
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			query: () => ({
				withIndex: (_name: string, select: (q: ReadyQuery) => ReadyQuery) => {
					const query = readyQuery();
					select(query);
					return {
						order: () => ({
							take: async () =>
								rows.filter((row) => row.owner === query.owner && row.status === query.status)
						})
					};
				}
			})
		}
	};
}

function extensionGetCtx(request: Doc<'purchaseRequests'>) {
	return {
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async (id: string) => {
				if (id === request._id) return request;
				if (id.startsWith('file_')) return file(id);
				return null;
			}
		},
		storage: {
			getUrl: async (storageId: string) => `https://files.example/${storageId}`
		}
	};
}

type ReadyQuery = {
	owner: string;
	status: Doc<'purchaseRequests'>['status'] | '';
	eq(field: 'owner' | 'status', value: string): ReadyQuery;
};

function readyQuery(): ReadyQuery {
	return {
		owner: '',
		status: '',
		eq(field, value) {
			if (field === 'owner') this.owner = value;
			if (field === 'status') this.status = value as Doc<'purchaseRequests'>['status'];
			return this;
		}
	};
}

function file(id: string) {
	return {
		_id: id,
		owner: 'owner',
		kind: 'receipt',
		filename: `${id}.pdf`,
		contentType: 'application/pdf',
		size: 1,
		storageId: `storage_${id}`,
		createdAt: 1
	};
}
