export type FundLetter = 'I' | 'E' | 'G' | 'N' | 'U' | 'D' | 'T';

export type DocumentationCategory =
	| 'asuo_funds'
	| 'food'
	| 'printing_services'
	| 'office_supplies_goods'
	| 'merchandise_apparel'
	| 'gifts_prizes';

export type RequirementPanel = {
	id:
		| 'receipts'
		| 'publicity'
		| 'catering_waiver'
		| 'printing_invoice'
		| 'office_location'
		| 'building_manager_approval'
		| 'computer_price_quote'
		| 'recipients'
		| 'brand_approval'
		| 'second_approval';
	title: string;
	required: boolean;
};

export const finalBuilderSteps = [
	'Student Organization',
	'Type of Purchase',
	'Documentation Categories',
	'Common Facts',
	'Specific Requirements',
	'Business Purpose',
	'Readiness Review',
	'Ready Confirmation'
] as const;

export const commonFactLabels = [
	'Student Organization',
	'Requester',
	'Type of Purchase',
	'Fund Letter',
	'Budget Line Item',
	'Vendor',
	'Item Description',
	'Total Amount',
	'Business Purpose'
] as const;

export function requirementPanelsFor({
	categories,
	fundLetter,
	purchaserIsSelf
}: {
	categories: DocumentationCategory[];
	fundLetter: FundLetter;
	purchaserIsSelf: boolean;
}): RequirementPanel[] {
	const effectiveCategories = new Set(categories);
	if (fundLetter === 'I') effectiveCategories.add('asuo_funds');

	const panels: RequirementPanel[] = [{ id: 'receipts', title: 'Receipts', required: true }];
	if (effectiveCategories.has('asuo_funds')) {
		panels.push({ id: 'publicity', title: 'Publicity Proof', required: true });
	}
	if (effectiveCategories.has('food')) {
		panels.push({ id: 'catering_waiver', title: 'Catering Waiver', required: true });
	}
	if (effectiveCategories.has('printing_services')) {
		panels.push({ id: 'printing_invoice', title: 'Printing Invoice', required: true });
	}
	if (effectiveCategories.has('office_supplies_goods')) {
		panels.push({ id: 'office_location', title: 'Office Location', required: true });
		panels.push({
			id: 'building_manager_approval',
			title: 'Building Manager Approval',
			required: false
		});
		panels.push({ id: 'computer_price_quote', title: 'Computer Price Quote', required: false });
	}
	if (effectiveCategories.has('merchandise_apparel') || effectiveCategories.has('gifts_prizes')) {
		panels.push({ id: 'recipients', title: 'Recipients', required: true });
	}
	if (effectiveCategories.has('merchandise_apparel')) {
		panels.push({ id: 'brand_approval', title: 'Brand Approval', required: false });
	}
	if (purchaserIsSelf) {
		panels.push({ id: 'second_approval', title: 'Second Approval', required: true });
	}
	return panels;
}
