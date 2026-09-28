import { expect, test } from 'vitest';
import { whatsLeft } from '../apps/web/src/lib/request/whatsLeft';

const readiness = {
	sections: [
		{
			section: 'Purchase details',
			reasons: ['Vendor missing.', 'Total amount must be greater than zero.']
		},
		{ section: 'Business purpose', reasons: ['Business purpose missing.'] },
		{ section: 'Files', reasons: ['Publicity proof missing.'] },
		{ section: 'Recipients', reasons: ['Recipient name missing.', 'Recipient UO 95 missing.'] }
	]
};

test('while reading, questions that do not need the receipt come first', () => {
	const items = whatsLeft({ readiness, reviews: [], reading: true });
	expect(items.map((item) => item.key)).toEqual([
		'why',
		'recipient-details',
		'publicity',
		'vendor',
		'totalAmount'
	]);
});

test('after reading, reviews lead and receipt fields follow', () => {
	const items = whatsLeft({
		readiness,
		reviews: [{ field: 'totalAmount', value: '36.18' }],
		reading: false
	});
	expect(items[0]).toMatchObject({ key: 'review-totalAmount', blocking: false });
	expect(items[0].detail).toBe('We read $36.18.');
	expect(items.slice(1, 3).map((item) => item.key)).toEqual(['vendor', 'totalAmount']);
});

test('reasons map to plain language without jargon', () => {
	const labels = whatsLeft({ readiness, reviews: [], reading: false }).map((item) => item.label);
	expect(labels).toContain('Add Publicity Proof');
	expect(labels.join(' ')).not.toMatch(/fund letter|confidence|OCR/i);
});
