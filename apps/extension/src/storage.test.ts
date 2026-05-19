import { samplePurchaseRequest } from '@engage-form/domain';
import { expect, test } from 'vitest';
import { readyPurchaseRequestSummary } from './storage.ts';

test('summarizes ready purchase requests for the popup', () => {
	expect(readyPurchaseRequestSummary(samplePurchaseRequest)).toEqual({
		title: 'Mort Garson music vinyl',
		org: 'Album Listening Club',
		amount: '$22.98',
		event: '04/21, 6:30pm',
		recipient: "Aidan O'Donnell"
	});
});
