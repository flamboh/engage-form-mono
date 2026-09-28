import { expect, test } from 'vitest';
import { requirementPanelsFor } from '../apps/web/src/lib/purchase/builderFlow';

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
