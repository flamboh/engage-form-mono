import { expect, test } from 'vitest';
import {
	commonFactLabels,
	finalBuilderSteps,
	requirementPanelsFor
} from '../apps/web/src/lib/purchase/builderFlow';

test('builder exposes the final Purchase Request flow order', () => {
	expect(finalBuilderSteps).toEqual([
		'Student Organization',
		'Type of Purchase',
		'Documentation Categories',
		'Common Facts',
		'Specific Requirements',
		'Business Purpose',
		'Readiness Review',
		'Ready Confirmation'
	]);
});

test('common facts match the final required fields without event assumptions', () => {
	expect(commonFactLabels).toEqual([
		'Student Organization',
		'Requester',
		'Type of Purchase',
		'Fund Letter',
		'Budget Line Item',
		'Vendor',
		'Item Description',
		'Total Amount',
		'Business Purpose'
	]);
	expect(commonFactLabels).not.toContain('Event name');
	expect(commonFactLabels).not.toContain('Estimated attendance');
});

test('specific requirement panels compose for multiple Documentation Categories', () => {
	expect(
		requirementPanelsFor({
			categories: ['food', 'printing_services', 'merchandise_apparel', 'gifts_prizes'],
			fundLetter: 'I',
			purchaserIsSelf: true
		}).map((panel) => panel.title)
	).toEqual([
		'Receipts',
		'Publicity Proof',
		'Catering Waiver',
		'Printing Invoice',
		'Recipients',
		'Brand Approval',
		'Second Approval'
	]);
});
