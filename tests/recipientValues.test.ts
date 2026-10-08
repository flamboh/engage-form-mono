import { expect, test } from 'vitest';
import {
	addRecipient,
	editValue,
	removeRecipient,
	startSync,
	type ValueSync
} from '../apps/web/src/lib/request/recipientValues';

const values = (result: { recipients: { value: number }[] }) =>
	result.recipients.map((recipient) => recipient.value);

const fresh: ValueSync = { on: true, edited: [] };

test('one recipient gets the whole total when it is under $50', () => {
	expect(values(addRecipient([], 39.95, fresh))).toEqual([39.95]);
	expect(values(addRecipient([], 80, fresh))).toEqual([0]);
	expect(values(addRecipient([], null, fresh))).toEqual([0]);
});

test('more recipients split the total, down to the cent', () => {
	const one = addRecipient([], 100, fresh);
	const two = addRecipient(one.recipients, 100, one.sync);
	expect(values(two)).toEqual([50, 50]);
	const three = addRecipient(two.recipients, 100, two.sync);
	expect(values(three)).toEqual([33.34, 33.33, 33.33]);
});

test('editing one value gives the rest of the total to the other person', () => {
	const two = addRecipient(addRecipient([], 60, fresh).recipients, 60, fresh);
	const editedA = editValue(two.recipients, 0, 40, 60, two.sync);
	expect(values(editedA)).toEqual([40, 20]);
	expect(editedA.sync.on).toBe(true);

	const editedB = editValue(editedA.recipients, 1, 35, 60, editedA.sync);
	expect(values(editedB)).toEqual([40, 35]);
	expect(editedB.sync.on).toBe(false);

	const editedAgain = editValue(editedB.recipients, 0, 10, 60, editedB.sync);
	expect(values(editedAgain)).toEqual([10, 35]);
});

test('editing a value with three people splits the rest between the other two', () => {
	const recipients = [0, 0, 0].map((value) => ({ name: '', uo95: '', reason: '', value }));
	expect(values(editValue(recipients, 1, 30, 90, fresh))).toEqual([30, 30, 30]);
	expect(values(editValue(recipients, 1, 50, 90, fresh))).toEqual([20, 50, 20]);
	expect(values(editValue(recipients, 1, 120, 90, fresh))).toEqual([0, 120, 0]);
});

test('removing a person while syncing hands their share back', () => {
	const recipients = [30, 30, 30].map((value) => ({ name: '', uo95: '', reason: '', value }));
	const removed = removeRecipient(recipients, 2, 90, { on: true, edited: [0] });
	expect(values(removed)).toEqual([30, 60]);
	expect(removed.sync.edited).toEqual([0]);
});

test('saved values that already add up keep syncing; others do not', () => {
	const recipient = (value: number) => ({ name: '', uo95: '', reason: '', value });
	expect(startSync([recipient(20), recipient(40)], 60).on).toBe(true);
	expect(startSync([recipient(0), recipient(0)], 60).on).toBe(true);
	expect(startSync([recipient(20), recipient(30)], 60).on).toBe(false);
});

test('starting over turns syncing back on', () => {
	const recipient = (value: number) => ({ name: '', uo95: '', reason: '', value });
	const off: ValueSync = { on: false, edited: [0, 1] };
	const emptied = removeRecipient([recipient(20)], 0, 60, off);
	expect(emptied.sync).toEqual({ on: true, edited: [] });
	expect(values(addRecipient([recipient(0)], 60, off))).toEqual([30, 30]);
	expect(values(addRecipient([recipient(20)], 60, off))).toEqual([20, 0]);
});
