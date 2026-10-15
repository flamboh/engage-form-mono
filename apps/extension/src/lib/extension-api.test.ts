import { fillProtocolHeader, fillProtocolVersion } from '@engage-form/domain';
import { describe, expect, it } from 'vitest';
import { createExtensionApi, ExtensionRequestError } from './extension-api';

describe('extension api', () => {
	it('tells the server which fill protocol it speaks', async () => {
		let headers: Headers | null = null;
		const api = createExtensionApi('https://site.test', async (_url, init) => {
			headers = new Headers(init?.headers);
			return Response.json({ value: [] });
		});
		await api.readyPurchases('token');
		expect(headers!.get(fillProtocolHeader)).toBe(String(fillProtocolVersion));
	});

	it('surfaces the server message when the extension is out of date', async () => {
		const api = createExtensionApi('https://site.test', async () =>
			Response.json({ error: 'Your Engage Form extension is out of date.' }, { status: 426 })
		);
		await expect(api.purchase('token', 'id')).rejects.toEqual(
			new ExtensionRequestError('Your Engage Form extension is out of date.')
		);
	});
});
