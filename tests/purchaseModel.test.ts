import { expect, test } from 'vitest';
import type { Doc } from '../convex/_generated/dataModel';
import {
	applyDraftPatch,
	assemblePurchase,
	assertReady,
	businessPurposeTemplateDraftPatch,
	businessPurposeTemplateFields,
	businessPurposeTemplateUpdateFields,
	filterBusinessPurposeTemplates,
	parseBusinessPurposeText,
	renderBusinessPurpose,
	userAsPurchaserDetails
} from '../convex/purchaseModel';
import { evaluatePurchaseReadiness } from '../convex/purchaseReadiness';

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
		budgetLines: ['Event Expenses'],
		businessPurposeTemplate:
			'{org} reimburses {purchaser} for {item} from {vendor} for {amount} at {eventName} on {eventDate} with {attendance} students. Recipient: {recipient} ({recipientUo95}) for {recipientReason}.'
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
	businessPurposeText: '',
	businessPurposeTouched: false,
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
	lastFilledAt: null
} as Doc<'purchaseRequests'>;

test('coerces cleared numeric draft fields to zero', () => {
	expect(
		applyDraftPatch(request, { eventEstimatedAttendance: null, totalAmount: null })
	).toMatchObject({
		eventEstimatedAttendance: 0,
		totalAmount: 0
	});
});

test('records Type of Purchase draft changes', () => {
	expect(applyDraftPatch(request, { typeOfPurchase: 'personal_reimbursement' })).toMatchObject({
		typeOfPurchase: 'personal_reimbursement'
	});
});

test('uses the fixed Personal Reimbursement reason for draft patches', () => {
	expect(
		applyDraftPatch(request, {
			typeOfPurchase: 'personal_reimbursement',
			reimbursementReason: 'Custom reason'
		})
	).toMatchObject({
		reimbursementReason: 'Other processes are too slow.'
	});
});

test('renders business purpose from current recorded facts', () => {
	expect(renderBusinessPurpose(request)).toBe(
		'Album Listening Club reimburses Oliver Boorstein for record from Amazon for $22.98 at Listening party on 2026-05-22 with 50 students. Recipient: Aidan (951951840) for winning trivia.'
	);
});

test('renders optional recipient tokens without unresolved placeholders when absent', () => {
	expect(renderBusinessPurpose({ ...request, recipients: [] })).toBe(
		'Album Listening Club reimburses Oliver Boorstein for record from Amazon for $22.98 at Listening party on 2026-05-22 with 50 students. Recipient: N/A (N/A) for N/A.'
	);
});

test('rejects unknown Business Purpose variables', () => {
	expect(() => parseBusinessPurposeText('Reimburse {Purchaser} for {Bad Variable}.')).toThrow(
		'Unknown Business Purpose variable: Bad Variable.'
	);
});

test('resolves structured Business Purpose source with plural recipient variables', () => {
	const purchase = {
		...request,
		businessPurposeSource: parseBusinessPurposeText(
			'{Student Organization} reimburses {Purchaser} for {Item Description} from {Vendor} for {Total Amount}. Recipients: {Recipients}. UO 95 IDs: {Recipient UO 95 IDs}. Activity: {Activity Date} at {Activity Time} in {Activity Location} for {Estimated Attendance} students.'
		),
		recipients: [
			{ name: 'Aidan', uo95: '951951840', reason: 'winning trivia', value: 12 },
			{ name: 'Maya', uo95: '950000002', reason: 'winning trivia', value: 10.98 }
		]
	} as Doc<'purchaseRequests'>;

	expect(renderBusinessPurpose(purchase)).toBe(
		'Album Listening Club reimburses Oliver Boorstein for record from Amazon for $22.98. Recipients: Aidan, Maya. UO 95 IDs: 951951840, 950000002. Activity: 2026-05-22 at 6:30 PM in EMU for 50 students.'
	);
});

test('Ready blocks unresolved Business Purpose variables from source', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			businessPurposeSource: parseBusinessPurposeText('Move supplies to {Office Location}.'),
			officeLocation: ''
		} as Doc<'purchaseRequests'>)
	).resolves.toEqual({
		ready: false,
		sections: [
			{ section: 'Business purpose', reasons: ['Business purpose has unresolved variables.'] }
		]
	});
});

test('freeform Business Purpose text stays allowed', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			businessPurposeSource: parseBusinessPurposeText('Reimburse Oliver for records.'),
			businessPurposeText: ''
		} as Doc<'purchaseRequests'>)
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('draft patch stores Business Purpose source instead of resolved text', () => {
	expect(
		applyDraftPatch(request, {
			businessPurposeText: 'Reimburse {Purchaser}.',
			businessPurposeTouched: true
		})
	).toMatchObject({
		businessPurposeSource: parseBusinessPurposeText('Reimburse {Purchaser}.'),
		businessPurposeTouched: true
	});
});

test('fill payload resolves Business Purpose at read time', async () => {
	await expect(
		assemblePurchase(fileCtx(), {
			...request,
			businessPurposeSource: parseBusinessPurposeText(
				'Reimburse {Purchaser} for {Item Description}.'
			),
			businessPurposeText: ''
		} as Doc<'purchaseRequests'>)
	).resolves.toMatchObject({
		businessPurposeText: 'Reimburse Oliver Boorstein for record.'
	});
});

test('Business Purpose Template creation requires a title and valid template source', () => {
	expect(
		businessPurposeTemplateFields(
			'owner',
			{
				organizationId: 'org_1' as never,
				title: '  Weekly gift prize  ',
				businessPurposeTemplate: 'Reimburse {Purchaser} for {Item Description}.'
			},
			10
		)
	).toMatchObject({
		owner: 'owner',
		organizationId: 'org_1',
		title: 'Weekly gift prize',
		businessPurposeTemplate: 'Reimburse {Purchaser} for {Item Description}.',
		searchText: 'Weekly gift prize Reimburse {Purchaser} for {Item Description}.',
		archived: false,
		updatedAt: 10
	});

	expect(() =>
		businessPurposeTemplateFields(
			'owner',
			{
				organizationId: 'org_1' as never,
				title: ' ',
				businessPurposeTemplate: 'Reimburse {Purchaser}.'
			},
			10
		)
	).toThrow('Business Purpose Template title missing.');

	expect(() =>
		businessPurposeTemplateFields(
			'owner',
			{
				organizationId: 'org_1' as never,
				title: 'Broken',
				businessPurposeTemplate: 'Reimburse {Unknown}.'
			},
			10
		)
	).toThrow('Unknown Business Purpose variable: Unknown.');
});

test('Business Purpose Template updates do not unarchive archived templates', () => {
	expect(
		businessPurposeTemplateUpdateFields(
			{
				title: 'Updated',
				businessPurposeTemplate: 'Updated {Purchaser}.'
			},
			20
		)
	).toEqual({
		title: 'Updated',
		businessPurposeTemplate: 'Updated {Purchaser}.',
		searchText: 'Updated Updated {Purchaser}.',
		updatedAt: 20
	});
});

test('Business Purpose Template search hides archived templates by default', () => {
	const templates = [
		{
			_id: 'template_1',
			title: 'Weekly prizes',
			businessPurposeTemplate: 'Reimburse records.',
			archived: false
		},
		{
			_id: 'template_2',
			title: 'Old prizes',
			businessPurposeTemplate: 'Reimburse shirts.',
			archived: true
		}
	];

	expect(
		filterBusinessPurposeTemplates(templates, 'prizes').map((template) => template._id)
	).toEqual(['template_1']);
	expect(
		filterBusinessPurposeTemplates(templates, 'shirts', { includeArchived: true }).map(
			(template) => template._id
		)
	).toEqual(['template_2']);
});

test('Draft Business Purpose initialization copies template source', () => {
	const template = {
		businessPurposeTemplate: 'Reimburse {Purchaser} for {Item Description}.',
		archived: false
	};
	const initialized = {
		...request,
		...businessPurposeTemplateDraftPatch(template)
	} as Doc<'purchaseRequests'>;

	template.businessPurposeTemplate = 'Changed {Vendor}.';
	template.archived = true;

	expect(renderBusinessPurpose(initialized)).toBe('Reimburse Oliver Boorstein for record.');
	expect(initialized.businessPurposeTouched).toBe(true);
});

test('Ready Purchase Requests keep copied Business Purpose when a template changes', () => {
	const template = {
		businessPurposeTemplate: 'Reimburse {Purchaser} for {Item Description}.',
		archived: false
	};
	const readyRequest = {
		...request,
		...businessPurposeTemplateDraftPatch(template),
		status: 'ready'
	} as Doc<'purchaseRequests'>;

	template.businessPurposeTemplate = 'Changed {Vendor}.';

	expect(renderBusinessPurpose(readyRequest)).toBe('Reimburse Oliver Boorstein for record.');
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
	await expect(
		evaluatePurchaseReadiness({ ...request, businessPurposeText: renderBusinessPurpose(request) })
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('accepts one combined ID Card Document for Personal Reimbursement', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			purchaser: {
				...request.purchaser,
				idCardFrontFileId: 'file_id_card',
				idCardBackFileId: null as never
			},
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('requires one to three Receipts for Personal Reimbursement', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: [],
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Receipt document missing.'] }]
	});

	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3'],
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});

	await expect(
		evaluatePurchaseReadiness({
			...request,
			receiptFileIds: ['file_receipt_1', 'file_receipt_2', 'file_receipt_3', 'file_receipt_4'],
			businessPurposeText: renderBusinessPurpose(request)
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
				secondApprovalFileId: null,
				businessPurposeText: renderBusinessPurpose(request)
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
			publicityFileId: null,
			businessPurposeText: renderBusinessPurpose(request)
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
			publicityFileId: null,
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Publicity proof missing.'] }]
	});
});

test('Food requires Catering Waiver', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['food'],
			cateringWaiverFileId: null,
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: false,
		sections: [{ section: 'Files', reasons: ['Catering waiver missing.'] }]
	});
});

test('Printing Services requires Printing Invoice', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['printing_services'],
			printingInvoiceFileId: null,
			businessPurposeText: renderBusinessPurpose(request)
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
			officeLocation: '',
			businessPurposeText: renderBusinessPurpose(request)
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
			computerPriceQuoteFileId: null,
			businessPurposeText: renderBusinessPurpose(request)
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
				recipients: [],
				businessPurposeText: renderBusinessPurpose(request)
			})
		).resolves.toEqual({
			ready: false,
			sections: [{ section: 'Recipients', reasons: ['Recipient missing.'] }]
		});

		await expect(
			evaluatePurchaseReadiness({
				...request,
				documentationCategories: [category],
				recipients: [{ name: '', uo95: '', reason: '', value: 0 }],
				businessPurposeText: renderBusinessPurpose(request)
			})
		).resolves.toEqual({
			ready: false,
			sections: [
				{
					section: 'Recipients',
					reasons: [
						'Recipient name missing.',
						'Recipient UO 95 missing.',
						'Recipient value missing.'
					]
				}
			]
		});
	}
});

test('Recipient reason, dollar limits, total matching, and Brand Approval do not block Ready', async () => {
	await expect(
		evaluatePurchaseReadiness({
			...request,
			documentationCategories: ['merchandise_apparel'],
			totalAmount: 10,
			recipients: [{ name: 'Aidan', uo95: '951951840', reason: '', value: 75 }],
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: true,
		sections: []
	});
});

test('assembled Merchandise/Apparel purchase includes optional Brand Approval', async () => {
	const purchase = await assemblePurchase(fileCtx(), {
		...request,
		documentationCategories: ['merchandise_apparel'],
		brandApprovalFileId: 'file_brand_approval',
		businessPurposeText: renderBusinessPurpose(request)
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
			officeLocation: '',
			businessPurposeText: renderBusinessPurpose(request)
		})
	).resolves.toEqual({
		ready: false,
		sections: [
			{ section: 'Purchase details', reasons: ['Office location missing.'] },
			{
				section: 'Files',
				reasons: ['Catering waiver missing.', 'Printing invoice missing.']
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
				idCardFrontFileId: '' as never,
				idCardBackFileId: '' as never
			},
			eventName: '',
			eventDate: '',
			eventTime: '',
			eventLocation: '',
			eventEstimatedAttendance: 0,
			vendor: '',
			itemDescription: '',
			totalAmount: 0,
			budgetLineItem: '',
			businessPurposeText: 'Reimburse {purchaser}.',
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
					'ID card document missing.'
				]
			},
			{
				section: 'Event details',
				reasons: [
					'Event name missing.',
					'Event date missing.',
					'Event time missing.',
					'Event location missing.',
					'Estimated attendance missing.'
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
				section: 'Business purpose',
				reasons: ['Business purpose has unresolved variables.']
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
			get: async () => ({ owner: request.owner })
		}
	};

	await expect(
		assertReady(ctx as never, {
			...request,
			businessPurposeText: 'Reimburse {purchaser}.',
			receiptFileIds: [],
			publicityFileId: null
		})
	).rejects.toThrow(
		[
			'Purchase request is not ready.',
			'Business purpose: Business purpose has unresolved variables.',
			'Files: Receipt document missing. Publicity proof missing.'
		].join('\n')
	);
});

test('Ready gate rejects document ids that are not owned records', async () => {
	const ctx = {
		db: {
			get: async (id: string) => (id === 'file_receipt' ? null : { owner: request.owner })
		}
	};

	await expect(
		assertReady(ctx as never, {
			...request,
			businessPurposeText: renderBusinessPurpose(request)
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
				storageId: `storage_${id}`,
				createdAt: 1
			})
		},
		storage: {
			getUrl: async (storageId: string) => `https://files.example/${storageId}`
		}
	} as never;
}
