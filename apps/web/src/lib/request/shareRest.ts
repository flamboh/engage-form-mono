const cents = (value: number) => Math.round(value * 100);

export function shareRest(values: number[], edited: number[], total: number): number[] {
	const open = values.map((_, index) => index).filter((index) => !edited.includes(index));
	if (open.length === 0) return values;
	const taken = edited.reduce((acc, index) => acc + cents(values[index] ?? 0), 0);
	const left = Math.max(0, cents(total) - taken);
	const share = Math.floor(left / open.length);
	const extra = left - share * open.length;
	return values.map((value, index) => {
		const slot = open.indexOf(index);
		return slot === -1 ? value : (share + (slot < extra ? 1 : 0)) / 100;
	});
}
