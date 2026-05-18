import { samplePurchase } from '@engage-form/domain';
import { expect, test } from 'vitest';
import { parseReadyPurchaseJson, readyPurchaseSummary } from './storage.ts';

test('parses companion ready purchase payloads', () => {
	expect(parseReadyPurchaseJson(JSON.stringify(samplePurchase))).toEqual(samplePurchase);
});

test('rejects invalid companion purchase payloads', () => {
	expect(parseReadyPurchaseJson('not json')).toBeNull();
	expect(parseReadyPurchaseJson(JSON.stringify({ id: 'purchase_incomplete' }))).toBeNull();
});

test('summarizes ready purchases for the popup', () => {
	expect(readyPurchaseSummary(samplePurchase)).toEqual({
		title: 'Mort Garson music vinyl',
		org: 'Album Listening Club',
		amount: '$22.98',
		event: '04/21, 6:30pm',
		recipient: "Aidan O'Donnell"
	});
});
