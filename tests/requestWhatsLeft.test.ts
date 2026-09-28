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

test('after reading, reviews lead and replace the matching missing field', () => {
	const items = whatsLeft({
		readiness,
		reviews: [{ field: 'totalAmount', value: '36.18', alternatives: [] }],
		reading: false
	});
	expect(items[0]).toMatchObject({ key: 'review-totalAmount', blocking: true });
	expect(items[0].detail).toBe('We read $36.18.');
	expect(items.map((item) => item.key)).not.toContain('totalAmount');
	expect(items.slice(1, 3).map((item) => item.key)).toEqual(['vendor', 'why']);
});

test('a review without a confident value asks about the first alternative', () => {
	const items = whatsLeft({
		readiness,
		reviews: [{ field: 'totalAmount', value: '', alternatives: ['19.00', '19.80'] }],
		reading: false
	});
	const review = items.find((item) => item.key === 'review-totalAmount');
	expect(review?.detail).toBe('Is it $19.00?');
	expect(items.map((item) => item.key)).not.toContain('totalAmount');
	expect(items.map((item) => item.detail).join(' ')).not.toMatch(/We read \./);
});

test('a review with nothing to propose is left to the missing-field item', () => {
	const items = whatsLeft({
		readiness,
		reviews: [{ field: 'totalAmount', value: '', alternatives: [] }],
		reading: false
	});
	expect(items.map((item) => item.key)).toContain('totalAmount');
	expect(items.map((item) => item.key)).not.toContain('review-totalAmount');
});

test('a missing purpose asks what it was for instead of the sentence blanks', () => {
	const items = whatsLeft({
		readiness: {
			sections: [
				{ section: 'Business purpose', reasons: ['Business purpose has unresolved variables.'] }
			]
		},
		reviews: [],
		reading: false,
		purposeMissing: true,
		onlyPurposeUnresolved: true
	});
	expect(items.map((item) => item.key)).toEqual(['purpose']);
});

test('reasons map to plain language without jargon', () => {
	const labels = whatsLeft({ readiness, reviews: [], reading: false }).map((item) => item.label);
	expect(labels).toContain('Add Publicity Proof');
	expect(labels.join(' ')).not.toMatch(/fund letter|confidence|OCR/i);
});
