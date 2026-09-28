import { AwsClient } from 'aws4fetch';
import type { DocumentText } from './candidates';

type Detection = { Text?: string; Confidence?: number };
type ExpenseField = { Type?: Detection; ValueDetection?: Detection };
type TextractBlock = { BlockType?: string; Text?: string };

export type AnalyzeExpenseResponse = {
	ExpenseDocuments?: {
		SummaryFields?: ExpenseField[];
		LineItemGroups?: { LineItems?: { LineItemExpenseFields?: ExpenseField[] }[] }[];
		Blocks?: TextractBlock[];
	}[];
};

export type AwsCredentials = {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
};

export const textractMaxBytes = 10 * 1024 * 1024;

export async function analyzeExpense(
	bytes: Uint8Array,
	credentials: AwsCredentials,
	fetcher: typeof fetch = fetch
): Promise<AnalyzeExpenseResponse> {
	if (bytes.byteLength > textractMaxBytes) throw new Error('Document is too large to read.');
	const client = new AwsClient({
		accessKeyId: credentials.accessKeyId,
		secretAccessKey: credentials.secretAccessKey,
		region: credentials.region,
		service: 'textract'
	});
	const request = await client.sign(`https://textract.${credentials.region}.amazonaws.com/`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/x-amz-json-1.1',
			'X-Amz-Target': 'Textract.AnalyzeExpense'
		},
		body: JSON.stringify({ Document: { Bytes: bytesToBase64(bytes) } })
	});
	const response = await fetcher(request);
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Textract failed with ${response.status}: ${body.slice(0, 200)}`);
	}
	return (await response.json()) as AnalyzeExpenseResponse;
}

export function textractDocumentText(responses: AnalyzeExpenseResponse[]): DocumentText {
	const lines: string[] = [];
	const vendorNames: string[] = [];
	const itemNames: string[] = [];
	for (const response of responses) {
		for (const document of response.ExpenseDocuments ?? []) {
			for (const block of document.Blocks ?? []) {
				const text = block.Text?.trim();
				if (block.BlockType === 'LINE' && text) lines.push(text);
			}
			for (const field of document.SummaryFields ?? []) {
				const kind = field.Type?.Text;
				const value = field.ValueDetection?.Text?.replace(/\s+/g, ' ').trim();
				if (!value) continue;
				if ((kind === 'VENDOR_NAME' || kind === 'NAME') && !vendorNames.includes(value)) {
					vendorNames.push(value);
				}
			}
			for (const group of document.LineItemGroups ?? []) {
				for (const item of group.LineItems ?? []) {
					for (const field of item.LineItemExpenseFields ?? []) {
						const value = field.ValueDetection?.Text?.replace(/\s+/g, ' ').trim();
						if (field.Type?.Text === 'ITEM' && value && !itemNames.includes(value)) {
							itemNames.push(value);
						}
					}
				}
			}
		}
	}
	return { source: 'textract', lines, hints: { vendorNames, itemNames } };
}

export function bytesToBase64(bytes: Uint8Array) {
	let binary = '';
	const chunk = 0x8000;
	for (let index = 0; index < bytes.length; index += chunk) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
	}
	return btoa(binary);
}
