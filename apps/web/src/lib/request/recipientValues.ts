import type { Recipient } from '$lib/purchase/draftDetails';

export type ValueSync = { on: boolean; edited: number[] };

const cents = (value: number) => Math.round(value * 100);

export function startSync(recipients: Recipient[], total: number | null): ValueSync {
	const sum = recipients.reduce((acc, recipient) => acc + cents(recipient.value), 0);
	return { on: untouched(recipients) || (total !== null && sum === cents(total)), edited: [] };
}

const untouched = (recipients: Recipient[]) =>
	recipients.every((recipient) => recipient.value === 0);

export function addRecipient(recipients: Recipient[], total: number | null, sync: ValueSync) {
	const next = [...recipients, { name: '', uo95: '', reason: '', value: 0 }];
	const nextSync = sync.on ? sync : untouched(recipients) ? { on: true, edited: [] } : sync;
	return { recipients: nextSync.on ? fill(next, total, nextSync.edited) : next, sync: nextSync };
}

export function removeRecipient(
	recipients: Recipient[],
	index: number,
	total: number | null,
	sync: ValueSync
) {
	const next = recipients.filter((_, itemIndex) => itemIndex !== index);
	const edited = sync.edited
		.filter((itemIndex) => itemIndex !== index)
		.map((itemIndex) => (itemIndex > index ? itemIndex - 1 : itemIndex));
	const nextSync = next.length === 0 ? { on: true, edited: [] } : { ...sync, edited };
	return { recipients: sync.on ? fill(next, total, edited) : next, sync: nextSync };
}

export function editValue(
	recipients: Recipient[],
	index: number,
	value: number,
	total: number | null,
	sync: ValueSync
) {
	const next = recipients.map((recipient, itemIndex) =>
		itemIndex === index ? { ...recipient, value } : recipient
	);
	if (!sync.on) return { recipients: next, sync };
	const edited = sync.edited.includes(index) ? sync.edited : [...sync.edited, index];
	if (edited.length >= next.length) return { recipients: next, sync: { on: false, edited } };
	return { recipients: fill(next, total, edited), sync: { on: true, edited } };
}

function fill(recipients: Recipient[], total: number | null, edited: number[]) {
	if (total === null) return recipients;
	if (recipients.length === 1 && total >= 50) return recipients;
	const open = recipients.map((_, index) => index).filter((index) => !edited.includes(index));
	if (open.length === 0) return recipients;
	const taken = edited.reduce((acc, index) => acc + cents(recipients[index]?.value ?? 0), 0);
	const left = Math.max(0, cents(total) - taken);
	const share = Math.floor(left / open.length);
	const extra = left - share * open.length;
	return recipients.map((recipient, index) => {
		const slot = open.indexOf(index);
		if (slot === -1) return recipient;
		return { ...recipient, value: (share + (slot < extra ? 1 : 0)) / 100 };
	});
}
