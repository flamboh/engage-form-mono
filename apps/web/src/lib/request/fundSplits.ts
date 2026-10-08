import { sameOption, type BudgetOption, type BudgetSplit } from '../../../../../convex/funds';
import { shareRest } from './shareRest';
import type { ValueSync } from './recipientValues';

const cents = (value: number) => Math.round(value * 100);

export function startFundSync(splits: BudgetSplit[], total: number | null): ValueSync {
	if (splits.length < 2 || splits.every((split) => split.amount === null)) {
		return { on: true, edited: [] };
	}
	const sum = splits.reduce((acc, split) => acc + cents(split.amount ?? 0), 0);
	return { on: total !== null && sum === cents(total), edited: [] };
}

export function toggleOption(
	splits: BudgetSplit[],
	option: BudgetOption,
	total: number | null,
	sync: ValueSync
) {
	const index = splits.findIndex((split) => sameOption(split, option));
	if (index === -1) {
		return settle([...splits, { ...option, amount: null }], sync.edited, total, sync);
	}
	const edited = sync.edited
		.filter((itemIndex) => itemIndex !== index)
		.map((itemIndex) => (itemIndex > index ? itemIndex - 1 : itemIndex));
	return settle(
		splits.filter((_, itemIndex) => itemIndex !== index),
		edited,
		total,
		sync
	);
}

export function editAmount(
	splits: BudgetSplit[],
	index: number,
	amount: number,
	total: number | null,
	sync: ValueSync
) {
	const next = splits.map((split, itemIndex) =>
		itemIndex === index ? { ...split, amount } : split
	);
	if (!sync.on) return { splits: next, sync };
	const edited = sync.edited.includes(index) ? sync.edited : [...sync.edited, index];
	if (edited.length >= next.length) return { splits: next, sync: { on: false, edited } };
	return { splits: fill(next, edited, total), sync: { on: true, edited } };
}

function settle(splits: BudgetSplit[], edited: number[], total: number | null, sync: ValueSync) {
	if (splits.length < 2) {
		return {
			splits: splits.map((split) => ({ ...split, amount: null })),
			sync: { on: true, edited: [] }
		};
	}
	const nextSync = { on: sync.on, edited };
	return { splits: nextSync.on ? fill(splits, edited, total) : splits, sync: nextSync };
}

function fill(splits: BudgetSplit[], edited: number[], total: number | null) {
	if (total === null || total <= 0) return splits;
	const amounts = shareRest(
		splits.map((split) => split.amount ?? 0),
		edited,
		total
	);
	return splits.map((split, index) => ({ ...split, amount: amounts[index] ?? 0 }));
}

export type Overflow = { split: BudgetSplit; left: number; short: number };

export function overflowFor(
	splits: BudgetSplit[],
	total: number | null,
	leftIn: (option: BudgetOption) => number | null
): Overflow | null {
	const split = splits[0];
	if (splits.length !== 1 || split === undefined || total === null || total <= 0) return null;
	const left = leftIn(split);
	if (left === null || cents(left) >= cents(total)) return null;
	const kept = Math.max(0, left);
	return { split, left: kept, short: (cents(total) - cents(kept)) / 100 };
}

export function coverOverflow(overflow: Overflow, from: BudgetOption) {
	if (overflow.left === 0) {
		return { splits: [{ ...from, amount: null }], sync: { on: true, edited: [] } };
	}
	return {
		splits: [
			{ ...overflow.split, amount: overflow.left },
			{ ...from, amount: overflow.short }
		],
		sync: { on: true, edited: [0] }
	};
}
