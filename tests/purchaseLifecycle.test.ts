import { expect, test, vi } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import { getReadyPurchaseForFill, listReadyPurchases } from '../convex/authed/extension';
import { saveDraftSnapshot } from '../convex/authed/purchaseBuilder';
import { parseBusinessPurposeText } from '../convex/purchaseModel';

vi.stubEnv('FILES_BASE_URL', 'https://files.example');
vi.stubEnv('FILES_SIGNING_SECRET', 'test-secret');

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
	activityDate: '2026-05-22',
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

test('snapshot saves patch only changed fields and reopen Approved requests as Ready', async () => {
	const patches: Partial<Doc<'purchaseRequests'>>[] = [];

	await saveDraftSnapshot._handler(
		saveCtx({ ...readyRequest, status: 'approved' }, patches) as never,
		{
			id: readyRequest._id,
			snapshot: { ...snapshotOf(readyRequest), vendor: '', itemDescription: 'cassette' },
			changedFields: ['itemDescription']
		}
	);

	expect(patches).toEqual([
		{
			itemDescription: 'cassette',
			updatedAt: expect.any(Number),
			fieldSources: { itemDescription: 'user' },
			status: 'ready'
		}
	]);
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
		auth: { getUserIdentity: async () => ({ tokenIdentifier: 'owner' }) },
		db: {
			get: async () => request,
			patch: async (_id: string, patch: Partial<Doc<'purchaseRequests'>>) => {
				patches.push(patch);
			}
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
		r2Key: `owner/${id}`,
		createdAt: 1
	};
}

function snapshotOf(request: Doc<'purchaseRequests'>) {
	return {
		typeOfPurchase: request.typeOfPurchase,
		documentationCategories: request.documentationCategories,
		purchaserSource: request.purchaserSource,
		purchaser: request.purchaser,
		activityDate: request.activityDate,
		activityTime: '',
		activityLocation: '',
		vendor: request.vendor,
		itemDescription: request.itemDescription,
		totalAmount: request.totalAmount,
		budgetLineItem: request.budgetLineItem,
		businessPurposeText: 'Reimburse {Purchaser} for {Item Description}.',
		businessPurposeTouched: request.businessPurposeTouched,
		purpose: '',
		receiptFileIds: request.receiptFileIds,
		secondApprovalFileId: request.secondApprovalFileId,
		publicityFileId: request.publicityFileId,
		cateringWaiverFileId: request.cateringWaiverFileId,
		printingInvoiceFileId: request.printingInvoiceFileId,
		brandApprovalFileId: request.brandApprovalFileId,
		officeLocation: request.officeLocation,
		buildingManagerApprovalFileId: request.buildingManagerApprovalFileId,
		computerPriceQuoteFileId: request.computerPriceQuoteFileId,
		recipients: request.recipients
	};
}
