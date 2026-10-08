import { expect, test } from 'vitest';
import { editAmount, startFundSync, toggleOption } from '../apps/web/src/lib/request/fundSplits';

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
