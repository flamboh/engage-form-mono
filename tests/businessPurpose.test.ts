import { expect, test } from 'vitest';
import { mentionsPurpose, withPurpose } from '../convex/businessPurpose';

test('withPurpose appends the purpose before the closing period', () => {
	expect(withPurpose('{Student Organization} bought {Item Description} on {Activity Date}.')).toBe(
		'{Student Organization} bought {Item Description} on {Activity Date} for {Purpose}.'
	);
	expect(withPurpose('Snacks for the club  ')).toBe('Snacks for the club for {Purpose}');
	expect(withPurpose('')).toBe('For {Purpose}.');
});

test('withPurpose leaves sentences that already mention the purpose alone', () => {
	expect(withPurpose('Prizes for {Purpose}.')).toBe('Prizes for {Purpose}.');
	expect(withPurpose('Prizes for {purpose}.')).toBe('Prizes for {purpose}.');
	expect(mentionsPurpose('Prizes for {Purposes}.')).toBe(false);
});
