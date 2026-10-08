import { expect, test } from 'vitest';
import {
	coverOverflow,
	editAmount,
	overflowFor,
	startFundSync,
	toggleOption
} from '../apps/web/src/lib/request/fundSplits';

const admin = { fund: 'administrative' as const, line: null };
const programming = { fund: 'programming' as const, line: null };
const amounts = (result: { splits: { amount: number | null }[] }) =>
	result.splits.map((split) => split.amount);

test('one fund needs no amount; a second splits the total evenly', () => {
	const fresh = startFundSync([], 86);
	const one = toggleOption([], admin, 86, fresh);
	expect(amounts(one)).toEqual([null]);
	const two = toggleOption(one.splits, programming, 86, one.sync);
	expect(amounts(two)).toEqual([43, 43]);
});

test('editing one fund gives the rest to the other, and editing both stops syncing', () => {
	const two = toggleOption(
		toggleOption([], admin, 86, startFundSync([], 86)).splits,
		programming,
		86,
		{
			on: true,
			edited: []
		}
	);
	const first = editAmount(two.splits, 0, 55, 86, two.sync);
	expect(amounts(first)).toEqual([55, 31]);
	const second = editAmount(first.splits, 1, 20, 86, first.sync);
	expect(amounts(second)).toEqual([55, 20]);
	expect(second.sync.on).toBe(false);
});

test('dropping back to one fund clears the amounts and syncs again', () => {
	const split = [
		{ ...admin, amount: 55 },
		{ ...programming, amount: 20 }
	];
	const one = toggleOption(split, programming, 86, { on: false, edited: [0, 1] });
	expect(one.splits).toEqual([{ ...admin, amount: null }]);
	expect(one.sync).toEqual({ on: true, edited: [] });
});

test('saved amounts that add up keep syncing', () => {
	expect(
		startFundSync(
			[
				{ ...admin, amount: 55 },
				{ ...programming, amount: 31 }
			],
			86
		).on
	).toBe(true);
	expect(
		startFundSync(
			[
				{ ...admin, amount: 55 },
				{ ...programming, amount: 20 }
			],
			86
		).on
	).toBe(false);
});

const kahoot = { fund: 'administrative' as const, line: 'Yearly Kahoot! Subscription' };
const weekly = { fund: 'programming' as const, line: 'Weekly Musical Discussion Events' };

test('a line with less left than the total offers to cover the rest from another line', () => {
	const left = (option: { line: string | null }) => (option.line === kahoot.line ? 100 : 1200);
	const overflow = overflowFor([{ ...kahoot, amount: null }], 141.28, left);
	expect(overflow).toEqual({ split: { ...kahoot, amount: null }, left: 100, short: 41.28 });
	expect(coverOverflow(overflow!, weekly).splits).toEqual([
		{ ...kahoot, amount: 100 },
		{ ...weekly, amount: 41.28 }
	]);
	expect(overflowFor([{ ...weekly, amount: null }], 141.28, left)).toBeNull();
	expect(overflowFor([{ ...kahoot, amount: null }], 141.28, () => null)).toBeNull();
});

test('a line with nothing left moves the whole purchase', () => {
	const overflow = overflowFor([{ ...kahoot, amount: null }], 30, () => -12);
	expect(overflow).toMatchObject({ left: 0, short: 30 });
	expect(coverOverflow(overflow!, weekly).splits).toEqual([{ ...weekly, amount: null }]);
});
