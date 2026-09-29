import { expect, test, vi } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import {
	assemblePurchase,
	assertReady,
	previousRequestDefaults,
	renderBusinessPurpose,
	userAsPurchaserDetails
} from '../convex/purchaseModel';
import { evaluatePurchaseReadiness } from '../convex/purchaseReadiness';

vi.stubEnv('FILES_BASE_URL', 'https://files.example');
vi.stubEnv('FILES_SIGNING_SECRET', 'test-secret');

const request = {
	_id: 'purchase_1',
	_creationTime: 1,
	owner: 'owner',
	status: 'draft',
	typeOfPurchase: 'personal_reimbursement',
	documentationCategories: [],
	organizationSourceId: null,
	purchaserSource: { kind: 'self' },
	studentOrganization: {
		name: 'Album Listening Club',
		indexNumber: 'OS353i',
		fundLetter: 'I',
		budgetLines: ['Event Expenses']
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
	activity: {
		eventId: null,
		name: 'Weekly listening event',
		dates: ['2026-05-19'],
		time: '18:30',
		location: 'McKenzie 240A',
		attendance: 50,
		openToAllStudents: true
	},
	vendor: 'Amazon',
	itemDescription: 'record',
	totalAmount: 22.98,
	budgetLineItem: 'Event Expenses',
	reimbursementReason: 'Other processes are too slow.',
	businessPurposeOverride: null,
	receiptFileIds: ['file_receipt'],
	secondApprovalFileId: 'file_approval',
	publicityFileId: 'file_publicity',
	cateringWaiverFileId: null,
	printingInvoiceFileId: null,
	brandApprovalFileId: null,
	officeLocation: '',
	buildingManagerApprovalFileId: null,
	computerPriceQuoteFileId: null,
	recipients: [{ name: 'Aidan', uo95: '951951840', reason: 'winning trivia', value: 22.98 }],
	createdAt: 1,
	updatedAt: 1,
	lastFilledAt: null,
	approvedAt: null,
	reviewerNote: null
} as Doc<'purchaseRequests'>;

test('renders the generated Business Purpose from recorded facts', () => {
	expect(renderBusinessPurpose(request, Date.UTC(2026, 5, 1))).toBe(
		'Album Listening Club wishes to reimburse Oliver Boorstein because they purchased record from Amazon for $22.98. The record was given to Aidan (951951840) for winning trivia at Album Listening Club’s weekly listening event on Tuesday 05/19 at 6:30pm in McKenzie 240A, with about 50 students in attendance.'
	);
});

test('a customized Business Purpose replaces the generated text', () => {
	expect(
		renderBusinessPurpose({ ...request, businessPurposeOverride: '  Custom purpose.  ' })
	).toBe('Custom purpose.');
});

test('Ready reports each missing event fact in plain words', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			activity: {
				...request.activity,
				name: '',
				dates: [],
				time: '',
				location: '',
				attendance: null
			}
		} as Doc<'purchaseRequests'>)
	).resolves.toEqual({
		ready: false,
		sections: [
			{
				section: 'Event',
				reasons: [
					'Choose the event.',
					'Add the event date.',
					'Add the event time.',
					'Add where the event was.',
					'Add how many students attended.'
				]
			}
		]
	});
});

test('Ready still checks facts while the Business Purpose is customized', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			businessPurposeOverride: 'Everything is here, trust me.',
			activity: { ...request.activity, attendance: null }
		} as Doc<'purchaseRequests'>)
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Event', reasons: ['Add how many students attended.'] }]
	});
});

test('fill payload carries the generated Business Purpose', async () => {
	const payload = await assemblePurchase(fileCtx(), request);
	expect(payload.businessPurposeText).toContain('because they purchased record from Amazon');
	expect(payload).not.toHaveProperty('activityDate');
});

test('new drafts copy the previous event facts without its dates', () => {
	const event = {
		_id: 'event_1',
		organizationId: 'org_1',
		archived: false
	} as Doc<'events'>;
	const previous = {
		...request,
		activity: { ...request.activity, eventId: event._id }
	};
	const defaults = previousRequestDefaults(
		previous,
		{ _id: 'org_1' as never, budgetLines: [{ name: 'Event Expenses', allocations: [] }] },
		null,
		event
	);
	expect(defaults.activity).toEqual({ ...request.activity, eventId: 'event_1', dates: [] });
	expect(defaults.fieldSources).toMatchObject({ activity: 'previous' });
	expect(
		previousRequestDefaults(
			previous,
			{ _id: 'org_1' as never, budgetLines: [{ name: 'Event Expenses', allocations: [] }] },
			null,
			{ ...event, archived: true }
		).activity?.eventId
	).toBeNull();
});

test('Requester-as-Purchaser uses Requester details without a Purchaser Profile', () => {
	const user = {
		_id: 'user_1',
		_creationTime: 1,
		owner: 'owner',
		name: 'Oliver Boorstein',
		uo95: '952043159',
		permanentAddress: '11337 Our Rd',
		studentEmail: 'obo@uoregon.edu',
		phone: '9073104429',
		idCardFrontFileId: 'file_front',
		idCardBackFileId: 'file_back',
		updatedAt: 1
	} as Doc<'users'>;

	expect(userAsPurchaserDetails(user)).toEqual({
		id: user._id,
		name: user.name,
		uo95: user.uo95,
		permanentAddress: user.permanentAddress,
		idCardFrontFileId: user.idCardFrontFileId,
		idCardBackFileId: user.idCardBackFileId
	});
});

test('reports a complete Personal Reimbursement purchase request as Ready', async () => {
	await expect(evaluatePurchaseReadiness(request)).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('a self-paid request needs both sides of the requester UO ID', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			purchaser: {
				...request.purchaser,
				idCardFrontFileId: 'file_id_document',
				idCardBackFileId: null as never
			}
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Purchaser', reasons: ['Your UO ID (front and back) missing.'] }]
	});
	await expect(
		evaluatePurchaseReadiness(
			{ ...request, purchaser: { ...request.purchaser, idCardFrontFileId: null as never } },
			{ documentExists: async () => true }
		)
	).resolves.toMatchObject({ ready: false });
	await expect(
		evaluatePurchaseReadiness(request, {
			documentExists: async (id) => id !== 'file_back'
		})
	).resolves.toMatchObject({
		sections: [{ section: 'Purchaser', reasons: ['Your UO ID (front and back) missing.'] }]
	});
});

test('another purchaser needs both sides of their own UO ID', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			purchaserSource: { kind: 'purchaser', purchaserId: 'purchaser_1' as never },
			secondApprovalFileId: null,
			purchaser: { ...request.purchaser, idCardBackFileId: null as never }
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Purchaser', reasons: ['Purchaser UO ID (front and back) missing.'] }]
	});
});

test('requires one to three Receipts for Personal Reimbursement', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: []
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Receipt document missing.'] }]
	});

	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3']
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});

	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3', 'file_receipt_4']
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Receipt documents are limited to three.'] }]
	});
});

test('Someone-else purchaser readiness uses a Purchaser Profile scoped to the selected Student Organization', async () => {
	await expect(
		evaluatePurchaseReadiness(
			{
				...request,
				organizationSourceId: 'org_1',
				purchaserSource: { kind: 'purchaser', purchaserId: 'purchaser_1' },
				purchaser: { ...request.purchaser, id: 'purchaser_1' },
				secondApprovalFileId: null
			},
			{
				purchaserBelongsToOrganization: async () => false
			}
		)
	).resolves.toEqual({
		ready: false,
		sections: [
			{
				section: 'Purchaser',
				reasons: ['Purchaser profile must belong to selected student organization.']
			}
		]
	});
});

test('does not require Publicity Proof when ASUO Funds does not apply', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: [],
			studentOrganization: { ...request.studentOrganization, fundLetter: 'E' },
			publicityFileId: null
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('Fund Letter I applies ASUO Funds in the fill payload', async () => {
	await expect(assemblePurchase(fileCtx(), request)).resolves.toMatchObject({
		documentationCategories: ['asuo_funds']
	});
});

test('non-I Fund Letters can select ASUO Funds for the fill payload', async () => {
	await expect(
		assemblePurchase(fileCtx(), {
			...request,
			documentationCategories: ['asuo_funds'],
			studentOrganization: { ...request.studentOrganization, fundLetter: 'E' }
		})
	).resolves.toMatchObject({
		documentationCategories: ['asuo_funds']
	});
});

test('manual ASUO Funds selection requires Publicity Proof', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['asuo_funds'],
			studentOrganization: { ...request.studentOrganization, fundLetter: 'E' },
			publicityFileId: null
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Publicity proof missing.'] }]
	});
});

test('Food leaves the Catering Waiver to document checks', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['food'],
			cateringWaiverFileId: null
		})
	).resolves.toEqual({ ready: true, sections: [] });
});

test('Printing Services requires Printing Invoice', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['printing_services'],
			printingInvoiceFileId: null
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Printing invoice missing.'] }]
	});
});

test('Office Supplies/Goods requires Office Location', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['office_supplies_goods'],
			officeLocation: ''
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Purchase details', reasons: ['Office location missing.'] }]
	});
});

test('Office Supplies/Goods optional documents do not block Ready', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['office_supplies_goods'],
			officeLocation: 'EMU 123',
			buildingManagerApprovalFileId: null,
			computerPriceQuoteFileId: null
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('Merchandise/Apparel and Gifts/Prizes require recipients', async () => {
	for (const category of ['merchandise_apparel', 'gifts_prizes'] as const) {
		await expect(
			evaluatePurchaseReadiness({
				...request,
				documentationCategories: [category],
				recipients: []
			})
		).resolves.toEqual({
			ready: false,
			sections: [{ section: 'Recipients', reasons: ['Recipient missing.'] }]
		});

		await expect(
			evaluatePurchaseReadiness({
				...request,
				documentationCategories: [category],
				recipients: [{ name: '', uo95: '', reason: '', value: 0 }]
			})
		).resolves.toEqual({
			ready: false,
			sections: [
				{
					section: 'Recipients',
					reasons: [
						'Recipient name missing.',
						'Recipient UO 95 missing.',
						'Recipient reason missing.',
						'Recipient value missing.'
					]
				}
			]
		});
	}
});

test('Dollar limits, total matching, and Brand Approval do not block Ready', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['merchandise_apparel'],
			totalAmount: 10,
			recipients: [{ name: 'Aidan', uo95: '951951840', reason: 'winning trivia', value: 75 }]
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('Gift recipients need a reason for the Business Purpose', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['gifts_prizes'],
			recipients: [{ name: 'Aidan', uo95: '951951840', reason: '', value: 22.98 }]
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Recipients', reasons: ['Recipient reason missing.'] }]
	});
});

test('assembled Merchandise/Apparel purchase includes optional Brand Approval', async () => {
	const purchase = await assemblePurchase(fileCtx(), {
		...request,
		documentationCategories: ['merchandise_apparel'],
		brandApprovalFileId: 'file_brand_approval'
	});

	expect(purchase).toMatchObject({ brandApprovalFileId: 'file_brand_approval' });
	expect(purchase.documents.map((document) => document.id)).toContain('file_brand_approval');
});

test('category requirements are additive', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['food', 'printing_services', 'office_supplies_goods'],
			cateringWaiverFileId: null,
			printingInvoiceFileId: null,
			officeLocation: ''
		})
	).resolves.toEqual({
		ready: false,
		sections: [
			{ section: 'Purchase details', reasons: ['Office location missing.'] },
			{
				section: 'Files',
				reasons: ['Printing invoice missing.']
			}
		]
	});
});

test('assembled purchase includes category requirement documents and office details', async () => {
	const purchase = await assemblePurchase(fileCtx(), {
		...request,
		documentationCategories: ['food', 'printing_services', 'office_supplies_goods'],
		cateringWaiverFileId: 'file_catering_waiver',
		printingInvoiceFileId: 'file_printing_invoice',
		officeLocation: 'EMU 123',
		buildingManagerApprovalFileId: 'file_building_manager',
		computerPriceQuoteFileId: 'file_computer_quote'
	});

	expect(purchase).toMatchObject({
		cateringWaiverFileId: 'file_catering_waiver',
		printingInvoiceFileId: 'file_printing_invoice',
		officeLocation: 'EMU 123',
		buildingManagerApprovalFileId: 'file_building_manager',
		computerPriceQuoteFileId: 'file_computer_quote'
	});
	expect(purchase.documents.map((document) => document.id)).toEqual(
		expect.arrayContaining([
			'file_catering_waiver',
			'file_printing_invoice',
			'file_building_manager',
			'file_computer_quote'
		])
	);
});

test('reports blocked Draft reasons grouped by section', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			studentOrganization: {
				...request.studentOrganization,
				name: '',
				indexNumber: '',
				budgetLines: []
			},
			requester: { ...request.requester, name: '', email: '', phone: '' },
			purchaser: {
				...request.purchaser,
				name: '',
				uo95: '',
				permanentAddress: '',
				idCardFrontFileId: null,
				idCardBackFileId: '' as never
			},
			activity: { ...request.activity, dates: [] },
			vendor: '',
			itemDescription: '',
			totalAmount: 0,
			budgetLineItem: '',
			receiptFileIds: [],
			secondApprovalFileId: null,
			publicityFileId: null
		})
	).resolves.toEqual({
		ready: false,
		sections: [
			{
				section: 'Student organization',
				reasons: [
					'Student organization name missing.',
					'Index number missing.',
					'Budget line missing.'
				]
			},
			{
				section: 'Requester',
				reasons: ['Requester name missing.', 'Requester email missing.', 'Requester phone missing.']
			},
			{
				section: 'Purchaser',
				reasons: [
					'Purchaser name missing.',
					'Purchaser UO 95 missing.',
					'Purchaser address missing.',
					'Your UO ID (front and back) missing.'
				]
			},
			{
				section: 'Purchase details',
				reasons: [
					'Vendor missing.',
					'Item description missing.',
					'Budget line item missing.',
					'Total amount must be greater than zero.'
				]
			},
			{
				section: 'Event',
				reasons: ['Add the event date.']
			},
			{
				section: 'Files',
				reasons: [
					'Receipt document missing.',
					'Publicity proof missing.',
					'Second approval missing.'
				]
			}
		]
	});
});

test('Ready gate rejects blocked Drafts with sectioned reasons', async () => {
	const ctx = {
		db: {
			query: () => ({ withIndex: () => ({ take: async () => [] }) }),
			get: async () => ({ owner: request.owner })
		}
	};

	await expect(
		assertReady(ctx as never, {
			...request,
			activity: { ...request.activity, attendance: null },
			receiptFileIds: [],
			publicityFileId: null
		})
	).rejects.toThrow(
		[
			'Purchase request is not ready.',
			'Event: Add how many students attended.',
			'Files: Receipt document missing. Publicity proof missing.'
		].join('\n')
	);
});

test('Ready gate rejects document ids that are not owned records', async () => {
	const ctx = {
		db: {
			query: () => ({ withIndex: () => ({ take: async () => [] }) }),
			get: async (id: string) => (id === 'file_receipt' ? null : { owner: request.owner })
		}
	};

	await expect(
		assertReady(ctx as never, {
			...request
		})
	).rejects.toThrow(
		['Purchase request is not ready.', 'Files: Receipt document missing.'].join('\n')
	);
});

function fileCtx() {
	return {
		db: {
			get: async (id: string) => ({
				_id: id,
				owner: request.owner,
				kind: 'receipt',
				filename: `${id}.pdf`,
				contentType: 'application/pdf',
				size: 1,
				r2Key: `owner/${id}`,
				createdAt: 1
			})
		}
	} as never;
}
