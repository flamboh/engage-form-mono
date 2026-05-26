import { requirementPanelsFor, type DocumentationCategory } from '$lib/purchase/builderFlow';

export type ProtoState = {
	organizationName: string;
	organizationIndex: string;
	fundLetter: 'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T';
	budgetLines: string[];
	purchaserName: string;
	purchaserIsSelf: boolean;
	typeOfPurchase: 'personal_reimbursement';
	documentationCategories: DocumentationCategory[];
	vendor: string;
	itemDescription: string;
	totalAmount: number;
	budgetLineItem: string;
	businessPurposeText: string;
	officeLocation: string;
	recipients: { name: string; uo95: string; reason: string; value: number }[];
	uploads: Record<string, string | null>;
};

export const protoSections = [
	{ id: 'setup', label: 'Organization & purchaser', shortLabel: 'Setup' },
	{ id: 'type', label: 'Type of purchase', shortLabel: 'Type' },
	{ id: 'categories', label: 'Documentation categories', shortLabel: 'Categories' },
	{ id: 'facts', label: 'Purchase details', shortLabel: 'Details' },
	{ id: 'requirements', label: 'Specific requirements', shortLabel: 'Requirements' },
	{ id: 'purpose', label: 'Business purpose', shortLabel: 'Purpose' },
	{ id: 'review', label: 'Review & submit', shortLabel: 'Review' }
] as const;

export type ProtoSectionId = (typeof protoSections)[number]['id'];

export function createProtoState(): ProtoState {
	return {
		organizationName: 'Album Listening Club',
		organizationIndex: '48291',
		fundLetter: 'I',
		budgetLines: ['Programming', 'Marketing', 'Operations'],
		purchaserName: 'Alex Johnson',
		purchaserIsSelf: true,
		typeOfPurchase: 'personal_reimbursement',
		documentationCategories: ['asuo_funds', 'food'],
		vendor: "Powell's Books",
		itemDescription: 'Vinyl records for spring listening event',
		totalAmount: 127.5,
		budgetLineItem: 'Programming',
		businessPurposeText:
			'This purchase supports Album Listening Club programming by providing vinyl records for our spring listening event open to all UO students.',
		officeLocation: '',
		recipients: [],
		uploads: {
			receipts: 'spring-event-receipt.pdf',
			publicity: 'flyer-instagram.png',
			catering_waiver: 'catering-waiver-signed.pdf',
			second_approval: 'advisor-approval.pdf'
		}
	};
}

export function requirementPanelsForState(state: ProtoState) {
	return requirementPanelsFor({
		categories: state.documentationCategories,
		fundLetter: state.fundLetter,
		purchaserIsSelf: state.purchaserIsSelf
	});
}

export function sectionComplete(state: ProtoState, sectionId: ProtoSectionId): boolean {
	switch (sectionId) {
		case 'setup':
			return state.organizationName.length > 0 && state.purchaserName.length > 0;
		case 'type':
			return true;
		case 'categories':
			return state.documentationCategories.length > 0;
		case 'facts':
			return (
				state.vendor.length > 0 &&
				state.itemDescription.length > 0 &&
				state.totalAmount > 0 &&
				state.budgetLineItem.length > 0
			);
		case 'requirements':
			return requirementPanelsForState(state).every((panel) => {
				if (!panel.required) return true;
				if (panel.id === 'office_location') return state.officeLocation.length > 0;
				if (panel.id === 'recipients') return state.recipients.length > 0;
				return Boolean(state.uploads[panel.id]);
			});
		case 'purpose':
			return state.businessPurposeText.trim().length > 20;
		case 'review':
			return protoSections.slice(0, -1).every((s) => sectionComplete(state, s.id));
	}
}

export function completedSectionCount(state: ProtoState): number {
	return protoSections.filter((s) => sectionComplete(state, s.id)).length;
}
