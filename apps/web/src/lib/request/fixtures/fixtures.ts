import type { Doc, Id } from '$convex/_generated/dataModel';
import { businessPurposeFor, missingFactLabel } from '$convex/businessPurpose';
import { evaluatePurchaseReadiness, withBlockingChecks } from '$convex/purchaseReadiness';
import { approvalBasisKey } from '$convex/checks/requestChecks';
import { mockChecks } from './checks';
import type { RequestDocument, RequestReview, RequestView } from '$convex/requestView';
import { requestLifecycle, todayInEugene } from '$convex/lifecycle';
import type { SavedData } from '$lib/purchase/draftDetails';

type Purchase = RequestView['purchase'];

export const mockOrganizationId = 'mock_org' as Id<'organizations'>;
export const mockRequestId = 'mock_request' as Id<'purchaseRequests'>;
export const mockEngageUrl = 'https://engage.uoregon.edu/submitter/form/start/000000';

const file = (name: string) => name as Id<'files'>;
const now = Date.UTC(2026, 8, 28, 17);
const dayMs = 86_400_000;
const inDays = (days: number) => todayInEugene(Date.now() + days * dayMs);

export const mockUser: Doc<'users'> = {
	_id: 'mock_user' as Id<'users'>,
	_creationTime: now,
	owner: 'mock',
	name: 'Jordan Lee',
	uo95: '951000000',
	permanentAddress: '1585 E 13th Ave, Eugene, OR 97403',
	studentEmail: 'jlee@uoregon.edu',
	phone: '541-555-0100',
	idCardFrontFileId: file('mock_id_front'),
	idCardBackFileId: file('mock_id_back'),
	updatedAt: now
};

const organization: Doc<'organizations'> = {
	_id: mockOrganizationId,
	_creationTime: now,
	owner: 'mock',
	name: 'Climbing Club',
	indexNumber: '123456',
	fundLetter: 'I',
	budgetLines: [
		{ name: 'Event Expenses', fund: 'programming', allocations: [] },
		{ name: 'Equipment', fund: 'administrative', allocations: [] },
		{ name: 'Travel', fund: 'programming', allocations: [] }
	],
	archived: false,
	updatedAt: now
};

const event = (
	id: string,
	name: string,
	weekday: number | null,
	time: string,
	location: string,
	attendance: number,
	age: number
): Doc<'events'> => ({
	_id: id as Id<'events'>,
	_creationTime: now,
	owner: 'mock',
	organizationId: mockOrganizationId,
	name,
	weekday,
	time,
	location,
	attendance,
	openToAllStudents: true,
	lastUsedAt: now - age,
	archived: false,
	updatedAt: now - age
});

export const mockEvents: Doc<'events'>[] = [
	event(
		'mock_event_meeting',
		'Weekly climbing meeting',
		4,
		'18:30',
		'EMU Crater Lake Room',
		35,
		1000
	),
	event(
		'mock_event_bouldering',
		'Bouldering night',
		5,
		'19:00',
		'Student Rec Center wall',
		50,
		2000
	),
	event(
		'mock_event_comp',
		'Fall climbing competition',
		null,
		'10:00',
		'Student Rec Center',
		80,
		3000
	)
];

const meeting = mockEvents[0];
const meetingActivity = {
	eventId: meeting._id,
	name: meeting.name,
	dates: [] as string[],
	time: meeting.time,
	location: meeting.location,
	attendance: meeting.attendance,
	openToAllStudents: true
};

export const mockSaved: SavedData = {
	organizations: [organization],
	purchasers: [
		{
			_id: 'mock_purchaser' as Id<'purchasers'>,
			_creationTime: now,
			owner: 'mock',
			organizationId: mockOrganizationId,
			name: 'Sam Rivera',
			uo95: '951000001',
			permanentAddress: '1200 Alder St, Eugene, OR 97401',
			idCardFrontFileId: file('mock_sam_id'),
			idCardBackFileId: file('mock_sam_id_back'),
			email: 'srivera@uoregon.edu',
			archived: false,
			updatedAt: now
		},
		{
			_id: 'mock_purchaser_priya' as Id<'purchasers'>,
			_creationTime: now,
			owner: 'mock',
			organizationId: mockOrganizationId,
			name: 'Priya Natarajan',
			uo95: '',
			permanentAddress: '',
			idCardFrontFileId: null,
			idCardBackFileId: null,
			email: 'priyan@uoregon.edu',
			title: 'Treasurer',
			approverUsedAt: now,
			archived: false,
			updatedAt: now
		}
	]
};

export function receiptImage(vendor: string, lines: [string, string][], total: string) {
	const rows = lines
		.map(
			([item, price], index) =>
				`<text x="24" y="${150 + index * 26}">${item}</text><text x="276" y="${150 + index * 26}" text-anchor="end">${price}</text>`
		)
		.join('');
	const end = 150 + lines.length * 26;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420" viewBox="0 0 300 420"><rect width="300" height="420" fill="#fffdf6"/><g font-family="Courier New, monospace" font-size="14" fill="#333"><text x="150" y="56" text-anchor="middle" font-size="20" font-weight="bold">${vendor}</text><text x="150" y="80" text-anchor="middle">EUGENE OR</text><text x="150" y="104" text-anchor="middle">09/24/2026 18:42</text>${rows}<line x1="24" x2="276" y1="${end}" y2="${end}" stroke="#999" stroke-dasharray="4 4"/><text x="24" y="${end + 28}" font-weight="bold">TOTAL</text><text x="276" y="${end + 28}" text-anchor="end" font-weight="bold">${total}</text><text x="150" y="${end + 70}" text-anchor="middle">THANK YOU</text></g></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function flyerImage() {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#1d5b40"/><g font-family="Arial, sans-serif" fill="#fee123" text-anchor="middle"><text x="150" y="120" font-size="36" font-weight="bold">BOULDERING</text><text x="150" y="162" font-size="36" font-weight="bold">NIGHT</text><text x="150" y="230" font-size="18" fill="#fff">Fri Oct 2 · 7pm</text><text x="150" y="258" font-size="18" fill="#fff">Student Rec Center</text><text x="150" y="330" font-size="14" fill="#fff">All students welcome</text></g></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const mockReceiptImage = receiptImage(
	'MARKET OF CHOICE',
	[
		['TORTILLA CHIPS', '4.99'],
		['SALSA VERDE', '5.49'],
		['SPARKLING WATER 12PK', '7.99'],
		['CLEMENTINES 3LB', '6.99'],
		['COOKIES', '8.49']
	],
	'$36.18'
);

function document(
	fileId: string,
	kind: RequestDocument['kind'],
	filename: string,
	contentType: string,
	previewUrl: string | null,
	reading = false,
	readFailed = false
): RequestDocument {
	return { fileId: file(fileId), kind, filename, contentType, previewUrl, reading, readFailed };
}

function basePurchase(): Purchase {
	return {
		_id: mockRequestId,
		_creationTime: now,
		owner: 'mock',
		status: 'draft',
		typeOfPurchase: 'personal_reimbursement',
		documentationCategories: ['food'],
		organizationSourceId: mockOrganizationId,
		purchaserSource: { kind: 'self' },
		studentOrganization: {
			name: organization.name,
			indexNumber: organization.indexNumber,
			fundLetter: organization.fundLetter,
			budgetLines: organization.budgetLines.map((line) => ({ name: line.name, fund: line.fund }))
		},
		requester: {
			id: mockUser._id,
			name: mockUser.name,
			email: mockUser.studentEmail,
			phone: mockUser.phone,
			uo95: mockUser.uo95,
			permanentAddress: mockUser.permanentAddress,
			idCardFrontFileId: mockUser.idCardFrontFileId,
			idCardBackFileId: mockUser.idCardBackFileId
		},
		purchaser: {
			id: mockUser._id,
			name: mockUser.name,
			uo95: mockUser.uo95,
			permanentAddress: mockUser.permanentAddress,
			idCardFrontFileId: mockUser.idCardFrontFileId,
			idCardBackFileId: mockUser.idCardBackFileId
		},
		activity: meetingActivity,
		vendor: '',
		itemDescription: '',
		totalAmount: 0,
		budgetSplits: [{ fund: 'programming', line: 'Event Expenses', amount: null }],
		reimbursementReason: 'Other processes are too slow.',
		businessPurposeOverride: null,
		purpose: '',
		receiptFileIds: [],
		secondApprovalFileId: null,
		publicityFileId: null,
		cateringWaiverFileId: null,
		printingInvoiceFileId: null,
		brandApprovalFileId: null,
		officeLocation: '',
		buildingManagerApprovalFileId: null,
		computerPriceQuoteFileId: null,
		recipients: [],
		createdAt: now,
		updatedAt: now,
		lastFilledAt: null,
		approvedAt: null,
		reviewerNote: null,
		fieldSources: {
			purchaserSource: 'previous',
			budgetSplits: 'previous',
			activity: 'previous'
		}
	};
}

const receiptDoc = (reading = false, readFailed = false) =>
	document(
		'mock_receipt',
		'receipt',
		'market-of-choice.jpg',
		'image/svg+xml',
		mockReceiptImage,
		reading,
		readFailed
	);
const readSources = {
	documentationCategories: 'suggested',
	purchaserSource: 'previous',
	budgetSplits: 'previous',
	activity: 'previous',
	vendor: 'receipt',
	itemDescription: 'receipt',
	totalAmount: 'receipt'
} as const;
const approvalDoc = () =>
	document('mock_approval', 'second_approval', 'approval-email.pdf', 'application/pdf', null);
const publicityDoc = () =>
	document('mock_publicity', 'publicity', 'bouldering-flyer.png', 'image/svg+xml', flyerImage());
const cateringDoc = () =>
	document('mock_catering', 'catering_waiver', 'catering-waiver.pdf', 'application/pdf', null);

const readReceipt = {
	vendor: 'Market of Choice',
	itemDescription: 'chips, salsa, sparkling water, fruit, and cookies',
	totalAmount: 36.18,
	receiptDate: '2026-09-24'
};

type Scenario = {
	purchase: Partial<Purchase>;
	documents: RequestDocument[];
	reading?: boolean;
	reviews?: RequestReview[];
};

const complete = {
	...readReceipt,
	activity: { ...meetingActivity, dates: ['2026-09-24'] },
	purpose: 'snacks for the general meeting',
	receiptFileIds: [file('mock_receipt')],
	secondApprovalFileId: file('mock_approval'),
	publicityFileId: file('mock_publicity'),
	cateringWaiverFileId: file('mock_catering')
};
const completeDocs = () => [receiptDoc(), publicityDoc(), approvalDoc(), cateringDoc()];
const confirmedSources = {
	documentationCategories: 'user',
	purchaserSource: 'user',
	budgetSplits: 'previous',
	activity: 'user',
	vendor: 'receipt',
	itemDescription: 'receipt',
	totalAmount: 'receipt'
} as const;
const finishing = {
	...complete,
	fieldSources: confirmedSources,
	cateringWaiverFileId: null,
	receiptDate: inDays(-9),
	activity: { ...meetingActivity, dates: [inDays(-2)] }
};

const scenarios: Record<string, () => Scenario> = {
	empty: () => ({ purchase: {}, documents: [] }),
	drop: () => ({ purchase: {}, documents: [] }),
	'no-events': () => ({
		purchase: {
			activity: {
				...meetingActivity,
				eventId: null,
				name: '',
				time: '',
				location: '',
				attendance: null
			},
			fieldSources: {}
		},
		documents: []
	}),
	reading: () => ({
		purchase: { receiptFileIds: [file('mock_receipt')] },
		documents: [receiptDoc(true)],
		reading: true
	}),
	uncertain: () => ({
		purchase: {
			vendor: 'Epic Seconds',
			itemDescription: 'yosef lattes',
			receiptFileIds: [file('mock_receipt')],
			fieldSources: readSources
		},
		documents: [receiptDoc()],
		reviews: [{ field: 'totalAmount', value: '', alternatives: ['19.00', '19.80'] }]
	}),
	unreadable: () => ({
		purchase: { receiptFileIds: [file('mock_receipt')] },
		documents: [receiptDoc(false, true)]
	}),
	reviews: () => ({
		purchase: {
			...readReceipt,
			fieldSources: readSources,
			purpose: 'snacks for the general meeting',
			receiptFileIds: [file('mock_receipt')],
			cateringWaiverFileId: file('mock_catering')
		},
		documents: [receiptDoc(), cateringDoc()],
		reviews: [
			{ field: 'totalAmount', value: '36.18', alternatives: ['33.95', '38.40'] },
			{ field: 'vendor', value: 'Market of Choice', alternatives: ['MOC Franklin'] }
		]
	}),
	publicity: () => ({
		purchase: { ...complete, publicityFileId: null },
		documents: [receiptDoc(), approvalDoc(), cateringDoc()]
	}),
	gifts: () => ({
		purchase: {
			...complete,
			vendor: 'REI',
			itemDescription: 'two chalk bags and a guidebook',
			totalAmount: 74.5,
			documentationCategories: ['gifts_prizes'],
			cateringWaiverFileId: null,
			activity: {
				...meetingActivity,
				eventId: mockEvents[2]._id,
				name: mockEvents[2].name,
				dates: ['2026-09-26'],
				time: mockEvents[2].time,
				location: mockEvents[2].location,
				attendance: mockEvents[2].attendance
			},
			recipients: [
				{ name: 'Avery Chen', uo95: '951000002', reason: '', value: 24.5 },
				{ name: 'Riley Park', uo95: '', reason: '', value: 0 }
			]
		},
		documents: [receiptDoc(), publicityDoc(), approvalDoc()]
	}),
	approval: () => ({
		purchase: { ...complete, secondApprovalFileId: null },
		documents: [receiptDoc(), publicityDoc(), cateringDoc()]
	}),
	tracked: () => ({
		purchase: {
			...complete,
			fieldSources: { ...readSources, activity: 'suggested' },
			receiptDate: inDays(0),
			activity: { ...meetingActivity, dates: [inDays(7)] },
			secondApprovalFileId: null,
			publicityFileId: null,
			cateringWaiverFileId: null
		},
		documents: [receiptDoc()]
	}),
	'finish-packaging': () => ({
		purchase: { ...finishing, secondApprovalFileId: null, publicityFileId: null },
		documents: [receiptDoc()]
	}),
	'finish-approval': () => ({
		purchase: { ...finishing, foodIndividuallyPackaged: true, secondApprovalFileId: null },
		documents: [receiptDoc(), publicityDoc()]
	}),
	'all-details': () => ({
		purchase: { ...finishing, publicityFileId: null, secondApprovalFileId: null },
		documents: [receiptDoc()]
	}),
	'sent-back': () => ({
		purchase: {
			...finishing,
			foodIndividuallyPackaged: true,
			reviewerNote: 'Please add the event date and attendance to the Business Purpose.'
		},
		documents: [receiptDoc(), publicityDoc(), approvalDoc()]
	}),
	'id-card': () => ({
		purchase: {
			...finishing,
			foodIndividuallyPackaged: true,
			purchaser: { ...basePurchase().purchaser, idCardBackFileId: null }
		},
		documents: [receiptDoc(), publicityDoc(), approvalDoc()]
	}),
	ready: () => ({
		purchase: { ...complete, fieldSources: confirmedSources },
		documents: completeDocs()
	}),
	custom: () => ({
		purchase: {
			...complete,
			businessPurposeOverride:
				'Climbing Club wishes to reimburse Jordan Lee for snacks from Market of Choice for our weekly meeting.'
		},
		documents: completeDocs()
	}),
	filled: () => ({
		purchase: { ...complete, fieldSources: confirmedSources, status: 'ready', lastFilledAt: now },
		documents: completeDocs()
	}),
	approved: () => ({
		purchase: { ...complete, status: 'approved', lastFilledAt: now, approvedAt: now },
		documents: completeDocs()
	}),
	checks: () => ({
		purchase: {
			...complete,
			fieldSources: readSources,
			receiptFileIds: [file('mock_receipt_nocard')],
			publicityFileId: file('mock_flyer_wrong'),
			cateringWaiverFileId: null
		},
		documents: [
			{ ...receiptDoc(), fileId: file('mock_receipt_nocard') },
			{ ...publicityDoc(), fileId: file('mock_flyer_wrong') },
			approvalDoc()
		]
	}),
	'checks-online': () => ({
		purchase: {
			...complete,
			vendor: 'Amazon',
			itemDescription: 'Live Vol. 1 (180gm 2LP)',
			totalAmount: 32.98,
			documentationCategories: ['gifts_prizes'],
			fieldSources: readSources,
			receiptFileIds: [file('mock_amazon')],
			secondApprovalFileId: file('mock_approval_old'),
			cateringWaiverFileId: null,
			recipients: [
				{ name: 'Avery Chen', uo95: '951000002', reason: 'Trivia winner', value: 32.98 },
				{ name: 'Riley Park', uo95: '95100', reason: 'Trivia runner-up', value: 0 }
			]
		},
		documents: [
			document('mock_amazon', 'receipt', 'amazon-order.png', 'image/svg+xml', amazonImage()),
			publicityDoc(),
			document('mock_approval_old', 'second_approval', 'approval.pdf', 'application/pdf', null)
		]
	}),
	'checks-recheck': () => {
		const purchase = {
			...complete,
			vendor: 'Epic Seconds',
			itemDescription: 'Yusef Lateef CD',
			totalAmount: 19,
			documentationCategories: [],
			fieldSources: readSources,
			receiptFileIds: [file('mock_slip')],
			secondApprovalFileId: file('mock_approval_cd'),
			cateringWaiverFileId: null
		} satisfies Partial<Purchase>;
		return {
			purchase: {
				...purchase,
				checkConfirmations: [
					{
						id: 'approval-recheck',
						key: approvalBasisKey({
							...purchase,
							itemDescription: 'Yusef Lateef CD and sleeve',
							activity: { name: '', dates: ['2026-09-24'] }
						})
					}
				]
			},
			documents: [
				document(
					'mock_slip',
					'receipt',
					'card-slip.jpg',
					'image/svg+xml',
					receiptImage('EPIC SECONDS', [['CREDIT CARD SALE', '19.00']], '$19.00')
				),
				publicityDoc(),
				document('mock_approval_cd', 'second_approval', 'approval.pdf', 'application/pdf', null)
			]
		};
	}
};

function amazonImage() {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400"><rect width="300" height="400" fill="#fff"/><g font-family="Arial, sans-serif" fill="#111"><text x="20" y="40" font-size="16" font-weight="bold">Order Summary</text><text x="20" y="70" font-size="12">Order placed October 31, 2025</text><text x="20" y="120" font-size="18" fill="#067d62" font-weight="bold">Arriving Monday</text><text x="20" y="160" font-size="13">Live Vol. 1 (180gm 2LP)</text><text x="20" y="200" font-size="12">Grand Total: $32.98</text></g></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const scenarioNames = Object.keys(scenarios);

export function scenarioView(name: string): RequestView {
	const scenario = (scenarios[name] ?? scenarios.reading)();
	const purchase = { ...basePurchase(), ...scenario.purchase };
	const reading = scenario.reading ?? false;
	return {
		purchase,
		documents: scenario.documents,
		reading,
		reviews: scenario.reviews ?? [],
		readiness: { ready: false, sections: [] },
		...businessPurposeView(purchase),
		checks: [],
		...requestLifecycle(purchase, { reading, readinessReady: false, today: inDays(0) })
	};
}

export async function withReadiness(view: RequestView): Promise<RequestView> {
	const readiness = await evaluatePurchaseReadiness(view.purchase as Doc<'purchaseRequests'>);
	const checks = mockChecks(view.purchase);
	const withChecks = withBlockingChecks(readiness, checks);
	return {
		...view,
		readiness: withChecks,
		...businessPurposeView(view.purchase),
		checks,
		...requestLifecycle(view.purchase, {
			reading: view.reading,
			readinessReady: withChecks.ready,
			today: inDays(0)
		})
	};
}

function businessPurposeView(purchase: Purchase) {
	const { text, missing } = businessPurposeFor(purchase);
	return {
		businessPurposeText: text,
		businessPurposeMissing: missing.map((fact) => ({ fact, label: missingFactLabel(fact) }))
	};
}

export const mockRead = readReceipt;
