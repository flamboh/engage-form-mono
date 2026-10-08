export const funds = ['administrative', 'programming'] as const;
export type Fund = (typeof funds)[number];

export const fundLabel: Record<Fund, string> = {
	administrative: 'Administrative',
	programming: 'Programming'
};

export type BudgetOption = { fund: Fund; line: string | null };
export type BudgetSplit = BudgetOption & { amount: number | null };

const cents = (value: number) => Math.round(value * 100);

export function budgetOptions(lines: { name: string; fund: Fund }[]): BudgetOption[] {
	if (lines.length === 0) return funds.map((fund) => ({ fund, line: null }));
	return lines.map((line) => ({ fund: line.fund, line: line.name }));
}

export function optionLabel(option: BudgetOption) {
	return option.line ?? fundLabel[option.fund];
}

export function sameOption(a: BudgetOption, b: BudgetOption) {
	return a.fund === b.fund && a.line === b.line;
}

export function optionForLabel(lines: { name: string; fund: Fund }[], label: string) {
	return budgetOptions(lines).find((option) => optionLabel(option) === label) ?? null;
}

export function splitsLabel(splits: BudgetOption[]) {
	return splits.map(optionLabel).join(' + ');
}

export function resolvedSplits(splits: BudgetSplit[], total: number) {
	return splits.map((split) => ({
		fund: split.fund,
		line: split.line,
		amount: splits.length === 1 ? total : (split.amount ?? 0)
	}));
}

export function fundAmounts(splits: BudgetSplit[], total: number) {
	const resolved = resolvedSplits(splits, total);
	return funds
		.filter((fund) => resolved.some((split) => split.fund === fund))
		.map((fund) => ({
			fund,
			amount:
				resolved
					.filter((split) => split.fund === fund)
					.reduce((sum, split) => sum + cents(split.amount), 0) / 100
		}));
}

export function splitProblem(splits: BudgetSplit[], total: number): string | null {
	if (splits.length === 0) return 'Fund missing.';
	if (splits.length === 1) return null;
	if (splits.some((split) => split.amount === null || split.amount <= 0)) {
		return 'Split amounts missing.';
	}
	const sum = splits.reduce((acc, split) => acc + cents(split.amount ?? 0), 0);
	if (sum !== cents(total)) {
		return `Split amounts add up to ${money(sum / 100)}, not ${money(total)}.`;
	}
	return null;
}

function money(amount: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function fundText(splits: BudgetSplit[], total: number) {
	return fundAmounts(splits, total)
		.map((part) => `${money(part.amount)} from ${fundLabel[part.fund]}`)
		.join(', ');
}
