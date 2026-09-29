import type { Doc, Id } from '$convex/_generated/dataModel';
import { checkInputFrom } from '$convex/checks/load';
import { confirmationFor, requestChecks, withConfirmation } from '$convex/checks/requestChecks';
import type { DocumentFacts } from '$convex/extraction/facts';
import type { RequestView } from '$convex/requestView';

type MockExtraction = {
	fileId: Id<'files'>;
	status: 'done';
	vendor: { value: string; confident: boolean; alternatives: string[] } | null;
	totalAmount: { value: string; confident: boolean; alternatives: string[] } | null;
	facts: DocumentFacts;
};

const baseFacts: DocumentFacts = {
	itemized: true,
	cardLast4: '4242',
	fulfillment: 'in_person',
	food: false,
	mentionsFood: false,
	eventDates: [],
	dates: [],
	approverEmail: null,
	text: ''
};

function extraction(
	fileId: string,
	vendor: string,
	total: string,
	facts: Partial<DocumentFacts>
): MockExtraction {
	const field = (value: string) =>
		value === '' ? null : { value, confident: true, alternatives: [] };
	return {
		fileId: fileId as Id<'files'>,
		status: 'done',
		vendor: field(vendor),
		totalAmount: field(total),
		facts: { ...baseFacts, ...facts }
	};
}

export const mockExtractions: MockExtraction[] = [
	extraction('mock_receipt_nocard', 'Market of Choice', '36.18', { food: true, cardLast4: null }),
	extraction('mock_flyer_wrong', '', '', {
		itemized: false,
		cardLast4: null,
		dates: ['--10-02'],
		eventDates: ['--10-02']
	}),
	extraction('mock_amazon', 'Amazon', '32.98', { fulfillment: 'pending', cardLast4: '5036' }),
	extraction('mock_approval_old', '', '18.40', {
		itemized: false,
		cardLast4: null,
		text: 'I approve the purchase of name tags from Staples, totaling $18.40.'
	}),
	extraction('mock_slip', 'Epic Seconds', '19.00', { itemized: false, cardLast4: '5097' }),
	extraction('mock_approval_cd', '', '19.00', {
		itemized: false,
		cardLast4: null,
		dates: ['--09-24'],
		eventDates: ['--09-24'],
		text: 'I approve the purchase of a Yusef Lateef CD from Epic Seconds, totaling $19.00, for the listening event on Thursday 09/24.'
	})
];

export function mockChecks(purchase: RequestView['purchase']) {
	return requestChecks(checkInputFrom(purchase as Doc<'purchaseRequests'>, mockExtractions));
}

export function confirmMockCheck(view: RequestView, checkId: string) {
	const input = checkInputFrom(view.purchase as Doc<'purchaseRequests'>, mockExtractions);
	const confirmation = confirmationFor(input, checkId);
	const confirmations = view.purchase.checkConfirmations ?? [];
	return confirmation === null ? confirmations : withConfirmation(confirmations, confirmation);
}
