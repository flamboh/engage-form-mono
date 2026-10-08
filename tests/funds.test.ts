import { expect, test } from 'vitest';
import { budgetOptions, fundAmounts, splitProblem, splitsLabel } from '../convex/funds';

const lines = [
	{ name: 'Weekly Musical Discussion Events', fund: 'programming' as const },
	{ name: 'Yearly Kahoot! Subscription', fund: 'administrative' as const }
];

test('custom lines replace the two generic funds', () => {
	expect(budgetOptions([])).toEqual([
		{ fund: 'administrative', line: null },
		{ fund: 'programming', line: null }
	]);
	expect(budgetOptions(lines).map((option) => option.line)).toEqual([
		'Weekly Musical Discussion Events',
		'Yearly Kahoot! Subscription'
	]);
});

test('one split takes the whole total', () => {
	const splits = [{ fund: 'programming' as const, line: null, amount: null }];
	expect(splitProblem(splits, 48.62)).toBeNull();
	expect(fundAmounts(splits, 48.62)).toEqual([{ fund: 'programming', amount: 48.62 }]);
});

test('more than one split needs amounts that add up to the total', () => {
	const open = [
		{ fund: 'administrative' as const, line: null, amount: null },
		{ fund: 'programming' as const, line: null, amount: null }
	];
	expect(splitProblem(open, 86)).toBe('Split amounts missing.');
	const short = [
		{ ...open[0], amount: 50 },
		{ ...open[1], amount: 31 }
	];
	expect(splitProblem(short, 86)).toBe('Split amounts add up to $81.00, not $86.00.');
	expect(splitProblem([{ ...open[0], amount: 55 }, short[1]], 86)).toBeNull();
	expect(splitProblem([], 86)).toBe('Fund missing.');
});

test('custom lines in the same fund add up to one Engage amount', () => {
	const splits = [
		{ fund: 'programming' as const, line: 'Weekly Musical Discussion Events', amount: 20 },
		{ fund: 'administrative' as const, line: 'Yearly Kahoot! Subscription', amount: 55 },
		{ fund: 'programming' as const, line: 'Zine', amount: 11.5 }
	];
	expect(fundAmounts(splits, 86.5)).toEqual([
		{ fund: 'administrative', amount: 55 },
		{ fund: 'programming', amount: 31.5 }
	]);
	expect(splitsLabel(splits)).toBe(
		'Weekly Musical Discussion Events + Yearly Kahoot! Subscription + Zine'
	);
});
