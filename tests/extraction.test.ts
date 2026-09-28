import { expect, test } from 'vitest';
import {
	cleanItem,
	cleanVendor,
	dateCandidates,
	describeItems,
	moneyCandidates,
	parseDate,
	preferredVendor,
	vendorCandidates,
	type DocumentText
} from '../convex/extraction/candidates';
import {
	buildDecisionRequest,
	buildDocumentRequest,
	parseDecisionResponse,
	parseDocumentResponse,
	type JevResponse
} from '../convex/extraction/jev';
import { bytesToBase64, textractDocumentText } from '../convex/extraction/textract';

const warehouseText: DocumentText = {
	source: 'textract',
	lines: [
		'BIGBOX',
		'WHOLESALE',
		'Springfield #42',
		'100 Example Ave',
		'Springfield, OR 97000',
		'5550001 KS TRAIL MIX 18.49',
		'5550002 KS COCOA BITES 9.99',
		'SUBTOTAL 28.48',
		'TAX 0.00',
		'**** TOTAL 28.48',
		'AMOUNT: $28.48',
		'1O/14/202509:12',
		'10/14/2025 09:12 7 55 123'
	],
	hints: { vendorNames: ['BIGBOX WHOLESALE'], itemNames: ['KS TRAIL MIX', 'KS COCOA BITES'] }
};

const onlineOrderText: DocumentText = {
	source: 'text_layer',
	lines: [
		'Your Orders',
		'OrderplacedMarch3,2026 Order # 111-000-222',
		'Sold by: Example.com',
		'Vinyl Record Deluxe Edition',
		'Item(s) Subtotal: $24.00',
		'Grand Total: $26.10',
		'Questions? Email help@mail.examplepost.com',
		'Return window closes 0ctober 3, 2026',
		'Printed 3/9/26, 1:02 PM'
	],
	hints: { vendorNames: [], itemNames: [] }
};

test('money candidates normalize OCR separators and dedupe values', () => {
	const candidates = moneyCandidates([
		'Total 1,204·50',
		'Paid $1,204.50',
		'Tip 3•25',
		'Ref 12/34.56'
	]);
	expect(candidates.map((candidate) => candidate.value)).toEqual(['1204.50', '3.25']);
	expect(candidates[0].lines).toEqual(['Total 1,204·50', 'Paid $1,204.50']);
});

test('date candidates handle glued text, zero-for-O months, and glued times', () => {
	expect(dateCandidates(onlineOrderText.lines).map((candidate) => candidate.iso)).toEqual([
		'2026-03-03',
		'2026-10-03',
		'2026-03-09'
	]);
	expect(dateCandidates(['10/28/202517:53']).map((candidate) => candidate.iso)).toEqual([
		'2025-10-28'
	]);
	expect(dateCandidates(['Date: 14-Oct-2025', '2025-10-14']).map((c) => c.iso)).toEqual([
		'2025-10-14'
	]);
});

test('parseDate rejects impossible dates', () => {
	expect(parseDate('02/30/2025')).toBeNull();
	expect(parseDate('13/01/2025')).toBeNull();
	expect(parseDate('Sept 5, 2025')).toBe('2025-09-05');
	expect(parseDate('Movember 5, 2025')).toBeNull();
});

test('vendor candidates include lines, scanner vendor names, and email or web domains', () => {
	const candidates = vendorCandidates({
		...onlineOrderText,
		hints: { vendorNames: ['EXAMPLE STORE'], itemNames: [] }
	});
	expect(candidates).toContainEqual({ text: 'Sold by: Example.com', note: null });
	expect(candidates).toContainEqual({ text: 'EXAMPLE STORE', note: null });
	expect(candidates).toContainEqual({ text: 'mail.examplepost.com', note: 'email domain' });
});

test('cleanVendor turns receipt headers into human vendor names', () => {
	expect(cleanVendor('Sold by: Amazon.com')).toBe('Amazon');
	expect(cleanVendor('HIRONS DRUG # 1')).toBe('Hirons Drug');
	expect(cleanVendor('BIGBOX WHOLESALE')).toBe('Bigbox Wholesale');
	expect(cleanVendor('sound-merch.com.au')).toBe('Sound Merch');
	expect(cleanVendor('Kahoot! AS')).toBe('Kahoot!');
	expect(cleanVendor('HOUSE OF RECORDS')).toBe('House of Records');
	expect(cleanVendor('Example.com, Inc.')).toBe('Example');
});

test('preferredVendor picks the spaced spelling of a glued OCR vendor', () => {
	expect(preferredVendor('HIRONSDRUG#1', ['HIRONSDRUG#1', 'HIRONS DRUG # 1'])).toBe('Hirons Drug');
});

test('item lines become concise human descriptions', () => {
	expect(cleanItem('5550001 KS TRAIL MIX 18.49')).toBe('KS Trail Mix');
	expect(cleanItem('12 CT TEA LIGHTS')).toBe('Tea Lights');
	expect(cleanItem('1 NEW DVD')).toBe('New DVD');
	expect(cleanItem('Band / Enamel Pin X 2')).toBe('Band / Enamel Pin');
	expect(cleanItem('Shipping')).toBeNull();
	expect(describeItems(['KS TRAIL MIX', '5550001 KS TRAIL MIX 18.49', 'KS COCOA BITES'])).toBe(
		'KS Trail Mix, KS Cocoa Bites'
	);
	expect(describeItems(['a1 thing', 'b2 thing', 'c3 thing', 'd4 thing', 'e5 thing'])).toBe(
		'A1 Thing, B2 Thing, C3 Thing, D4 Thing, and 1 more'
	);
});

test('textract responses become lines plus vendor and item hints', () => {
	const text = textractDocumentText([
		{
			ExpenseDocuments: [
				{
					Blocks: [
						{ BlockType: 'LINE', Text: 'BIGBOX' },
						{ BlockType: 'WORD', Text: 'BIGBOX' },
						{ BlockType: 'LINE', Text: 'TOTAL 28.48' }
					],
					SummaryFields: [
						{ Type: { Text: 'VENDOR_NAME' }, ValueDetection: { Text: 'BIGBOX\nWHOLESALE' } },
						{ Type: { Text: 'TOTAL' }, ValueDetection: { Text: '28.48' } }
					],
					LineItemGroups: [
						{
							LineItems: [
								{
									LineItemExpenseFields: [
										{ Type: { Text: 'ITEM' }, ValueDetection: { Text: 'KS TRAIL MIX' } },
										{ Type: { Text: 'PRICE' }, ValueDetection: { Text: '18.49' } }
									]
								}
							]
						}
					]
				}
			]
		}
	]);
	expect(text).toEqual({
		source: 'textract',
		lines: ['BIGBOX', 'TOTAL 28.48'],
		hints: { vendorNames: ['BIGBOX WHOLESALE'], itemNames: ['KS TRAIL MIX'] }
	});
});

test('document request asks one fan-out question set with none escape hatches', () => {
	const plan = buildDocumentRequest(warehouseText);
	const questions = plan.request.questions;
	expect(plan.request.model).toBe('jev-latest');
	expect(Object.keys(questions)).toEqual(
		expect.arrayContaining(['document_kind', 'is_purchase', 'vendor', 'total', 'date', 'item_0'])
	);
	const total = questions.total as { criteria: Record<string, unknown> };
	expect(Object.keys(total.criteria)).toEqual(['18.49', '9.99', '28.48', '0.00', 'none']);
	const vendor = questions.vendor as { criteria: Record<string, unknown> };
	expect(vendor.criteria).toHaveProperty('BIGBOX WHOLESALE');
	expect(Object.keys(vendor.criteria).length).toBeLessThanOrEqual(255);
	const date = questions.date as { criteria: Record<string, unknown> };
	expect(Object.keys(date.criteria)).toEqual(['10/14/2025', 'none']);
});

test('document responses become cleaned, confidence-gated fields', () => {
	const plan = buildDocumentRequest(warehouseText);
	const itemIndex = (line: string) => plan.itemLines.indexOf(line);
	const response: JevResponse = {
		answers: {
			document_kind: {
				type: 'choice',
				choice: 'receipt',
				probabilities: { receipt: 1 },
				confidence: 1
			},
			is_purchase: { type: 'noul', noul: 0.99 },
			vendor: {
				type: 'choice',
				choice: 'BIGBOX WHOLESALE',
				probabilities: { 'BIGBOX WHOLESALE': 0.6, BIGBOX: 0.35, 'Springfield #42': 0.05 },
				confidence: 0.5
			},
			total: {
				type: 'choice',
				choice: '28.48',
				probabilities: { '28.48': 0.55, '18.49': 0.4, none: 0.05 },
				confidence: 0.4
			},
			date: {
				type: 'choice',
				choice: '10/14/2025',
				probabilities: { '10/14/2025': 1 },
				confidence: 1
			},
			...Object.fromEntries(
				plan.itemLines.map((line, index) => [
					`item_${index}`,
					{
						type: 'noul' as const,
						noul: [itemIndex('5550001 KS TRAIL MIX 18.49'), itemIndex('KS COCOA BITES')].includes(
							index
						)
							? 0.95
							: line === 'BIGBOX'
								? 0.8
								: 0.1
					}
				])
			)
		}
	};
	const result = parseDocumentResponse(plan, warehouseText, response);
	expect(result.documentKind).toBe('receipt');
	expect(result.vendor).toMatchObject({ value: 'Bigbox Wholesale', confident: true });
	expect(result.totalAmount).toMatchObject({
		value: '28.48',
		confident: false,
		alternatives: ['18.49']
	});
	expect(result.receiptDate).toMatchObject({ value: '2025-10-14', confident: true });
	expect(result.items).toEqual(['5550001 KS TRAIL MIX 18.49', 'KS COCOA BITES']);
});

test('a none answer keeps alternatives as a review instead of a guess', () => {
	const text: DocumentText = {
		source: 'textract',
		lines: ['CORNER RECORDS', 'CD 19.00', 'thank you'],
		hints: { vendorNames: [], itemNames: [] }
	};
	const plan = buildDocumentRequest(text);
	const result = parseDocumentResponse(plan, text, {
		answers: {
			document_kind: { type: 'choice', choice: 'receipt', probabilities: {}, confidence: 1 },
			vendor: {
				type: 'choice',
				choice: 'CORNER RECORDS',
				probabilities: { 'CORNER RECORDS': 1 },
				confidence: 1
			},
			total: {
				type: 'choice',
				choice: 'none',
				probabilities: { none: 0.9, '19.00': 0.1 },
				confidence: 0.8
			}
		}
	});
	expect(result.totalAmount).toEqual({
		value: '',
		confident: false,
		alternatives: ['19.00'],
		confidence: 0
	});
	expect(result.receiptDate).toBeNull();
});

test('decision requests choose among budget lines and gate categories on confidence', () => {
	const context = {
		vendor: 'Bigbox Wholesale',
		itemDescription: 'KS Trail Mix, KS Cocoa Bites',
		businessPurpose: 'Snacks for the fall kickoff',
		budgetLines: ['Event Expenses', 'Food'],
		receiptText: ''
	};
	const request = buildDecisionRequest(context);
	expect(request.questions.budget_line).toMatchObject({
		type: 'choice',
		criteria: { 'Event Expenses': null, Food: null }
	});
	expect(request.state).toEqual({
		purchase: {
			vendor: 'Bigbox Wholesale',
			items: 'KS Trail Mix, KS Cocoa Bites',
			purpose: 'Snacks for the fall kickoff'
		}
	});
	const decisions = parseDecisionResponse(context, {
		answers: {
			budget_line: {
				type: 'choice',
				choice: 'Food',
				probabilities: { Food: 0.97, 'Event Expenses': 0.03 },
				confidence: 0.94
			},
			category_food: { type: 'noul', noul: 0.93 },
			category_gifts_prizes: { type: 'noul', noul: 0.6 }
		}
	});
	expect(decisions).toEqual({
		budgetLine: { value: 'Food', confident: true },
		categories: ['food']
	});
});

test('base64 encoding handles large binary buffers', () => {
	const bytes = new Uint8Array(100_000).map((_, index) => index % 256);
	expect(Buffer.from(bytesToBase64(bytes), 'base64').equals(Buffer.from(bytes))).toBe(true);
});
