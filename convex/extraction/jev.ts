import {
	dateCandidates,
	itemLineCandidates,
	cleanVendor,
	moneyCandidates,
	preferredVendor,
	vendorKey,
	vendorCandidates,
	type DocumentText
} from './candidates';

export const jevUrl = 'https://api.typesafe.ai/v1/systemone';
export const confidentThreshold = 0.85;
const none = 'none';
const itemThreshold = 0.7;
const categoryThreshold = 0.85;
const alternativeFloor = 0.03;

type Question =
	| { type: 'noul'; instructions: unknown }
	| { type: 'choice'; instructions: unknown; criteria: Record<string, unknown> };

export type JevRequest = { state: unknown; model: string; questions: Record<string, Question> };

type ChoiceAnswer = {
	type: 'choice';
	choice: string;
	probabilities: Record<string, number>;
	confidence: number;
};
type NoulAnswer = { type: 'noul'; noul: number };
export type JevResponse = {
	answers: Record<string, ChoiceAnswer | NoulAnswer>;
	usage?: { input_tokens: number; output_tokens: number };
};

export const documentKinds = {
	receipt:
		'A receipt, invoice, or order confirmation showing what was bought, from whom, and for how much',
	publicity:
		'A flyer, poster, social media post, or calendar listing promoting an event to students',
	second_approval: 'An email or message where someone approves a reimbursement or purchase',
	catering_waiver: 'A catering waiver form for serving food at an event',
	printing_invoice: 'A quote or invoice from a print shop for printing posters, flyers, or banners',
	brand_approval: 'A University of Oregon brand or trademark approval for a merchandise design',
	other: 'Anything else'
} as const;

export type DocumentKind = keyof typeof documentKinds;

export type ParsedField = {
	value: string;
	confident: boolean;
	alternatives: string[];
	confidence: number;
};

export type DocumentExtraction = {
	documentKind: DocumentKind;
	looksLikePurchase: boolean;
	vendor: ParsedField | null;
	totalAmount: ParsedField | null;
	receiptDate: ParsedField | null;
	items: string[];
};

type DocumentPlan = {
	request: JevRequest;
	vendors: string[];
	itemLines: string[];
};

export function buildDocumentRequest(text: DocumentText): DocumentPlan {
	const money = moneyCandidates(text.lines);
	const dates = dateCandidates(text.lines);
	const vendors = vendorCandidates(text);
	const itemLines = [
		...itemLineCandidates(text).map(({ line }) => line),
		...text.hints.itemNames.filter((name) => !text.lines.includes(name))
	].slice(0, 150);

	const questions: Record<string, Question> = {
		document_kind: {
			type: 'choice',
			instructions:
				'What kind of document is `document`? It is text read from a scan, photo, screenshot, or PDF.',
			criteria: documentKinds
		},
		is_purchase: {
			type: 'noul',
			instructions: 'Does `document` show that something was bought or paid for?'
		},
		vendor: {
			type: 'choice',
			instructions:
				'Which option is the name of the business that sold the items (the store or merchant), not the email provider, payment processor, marketplace footer, or the buyer?',
			criteria: {
				...Object.fromEntries(vendors.map((vendor) => [vendor.text, vendor.note])),
				[none]: 'None of these names the seller.'
			}
		}
	};
	if (money.length > 0) {
		questions.total = {
			type: 'choice',
			instructions:
				'Which amount is the final total the buyer paid for this purchase, including tax and shipping? Not a subtotal, a single item price, a balance due of $0.00, or change.',
			criteria: {
				...Object.fromEntries(
					money.map((candidate) => [candidate.value, { appears_on_lines: candidate.lines }])
				),
				[none]: 'None of these amounts is the total paid.'
			}
		};
	}
	if (dates.length > 0) {
		questions.date = {
			type: 'choice',
			instructions:
				'Which date is when the purchase was made or the order was placed? Not a delivery date, return deadline, due date, or the date the document was printed.',
			criteria: {
				...Object.fromEntries(
					dates.map((candidate) => [candidate.written[0], { appears_on_lines: candidate.lines }])
				),
				[none]: 'None of these is the purchase date.'
			}
		};
	}
	itemLines.forEach((line, index) => {
		questions[`item_${index}`] = {
			type: 'noul',
			instructions: {
				line,
				question:
					'Is `line` the name or description of a product or service that was purchased? Not a store name, address, price-only line, payment detail, shipping, tax, total, or boilerplate.'
			}
		};
	});

	return {
		request: { state: { document: text.lines.join('\n') }, model: 'jev-latest', questions },
		vendors: vendors.map((vendor) => vendor.text),
		itemLines
	};
}

export function parseDocumentResponse(
	plan: DocumentPlan,
	text: DocumentText,
	response: JevResponse
): DocumentExtraction {
	const answers = response.answers;
	const kind = choiceAnswer(answers.document_kind);
	const dates = new Map(
		dateCandidates(text.lines).flatMap((candidate) =>
			candidate.written.map((written) => [written, candidate.iso] as const)
		)
	);
	const vendorNames = [...plan.vendors, ...text.hints.vendorNames];
	const vendor = vendorField(answers.vendor, vendorNames);
	const items = plan.itemLines.filter((line, index) => {
		const answer = answers[`item_${index}`];
		if (vendor !== null && namesVendor(line, vendor.value)) {
			return false;
		}
		return answer?.type === 'noul' && answer.noul >= itemThreshold;
	});
	const documentKind =
		kind !== null && kind.choice in documentKinds ? (kind.choice as DocumentKind) : 'other';
	const isPurchase = answers.is_purchase;
	return {
		documentKind,
		looksLikePurchase:
			documentKind === 'receipt' || (isPurchase?.type === 'noul' && isPurchase.noul >= 0.5),
		vendor,
		totalAmount: choiceField(answers.total, (choice) => choice),
		receiptDate: choiceField(answers.date, (choice) => dates.get(choice) ?? null),
		items
	};
}

function choiceAnswer(answer: ChoiceAnswer | NoulAnswer | undefined) {
	return answer?.type === 'choice' ? answer : null;
}

function vendorField(
	answer: ChoiceAnswer | NoulAnswer | undefined,
	vendorNames: string[]
): ParsedField | null {
	const choice = choiceAnswer(answer);
	if (choice === null) return null;
	const groups: { key: string; value: string; probability: number }[] = [];
	const ranked = Object.entries(choice.probabilities).sort((left, right) => right[1] - left[1]);
	let noneProbability = 0;
	for (const [option, probability] of ranked) {
		if (option === none) {
			noneProbability = probability;
			continue;
		}
		const value = preferredVendor(option, vendorNames);
		const key = vendorKey(value);
		const group = groups.find((existing) => sameVendor(existing.key, key));
		if (group === undefined) groups.push({ key, value, probability });
		else group.probability += probability;
	}
	groups.sort((left, right) => right.probability - left.probability);
	const optionCount = ranked.length;
	const best = groups[0];
	if (best === undefined) return null;
	if (best.probability <= noneProbability) {
		const alternatives = groups
			.filter((group) => group.probability >= alternativeFloor)
			.slice(0, 3)
			.map((group) => group.value);
		if (alternatives.length === 0) return null;
		return { value: '', confident: false, alternatives, confidence: 0 };
	}
	const alternatives = groups
		.slice(1)
		.filter((group) => group.probability >= alternativeFloor)
		.slice(0, 3)
		.map((group) => group.value);
	const confidence =
		optionCount > 1 ? Math.max(0, (optionCount * best.probability - 1) / (optionCount - 1)) : 1;
	return {
		value: best.value,
		confident: confidence >= confidentThreshold,
		alternatives,
		confidence
	};
}

function namesVendor(line: string, vendor: string) {
	const key = vendorKey(cleanVendor(line));
	return key !== '' && vendorKey(vendor).startsWith(key);
}

function sameVendor(left: string, right: string) {
	if (left === right) return true;
	if (left.length < 4 || right.length < 4) return false;
	return left.startsWith(right) || right.startsWith(left);
}

function choiceField(
	answer: ChoiceAnswer | NoulAnswer | undefined,
	convert: (choice: string) => string | null
): ParsedField | null {
	const choice = choiceAnswer(answer);
	if (choice === null) return null;
	const value = choice.choice === none ? null : convert(choice.choice);
	const alternatives: string[] = [];
	const ranked = Object.entries(choice.probabilities).sort((left, right) => right[1] - left[1]);
	for (const [option, probability] of ranked) {
		if (option === none || option === choice.choice || probability < alternativeFloor) continue;
		const converted = convert(option);
		if (converted === null || converted === value || alternatives.includes(converted)) continue;
		alternatives.push(converted);
		if (alternatives.length === 3) break;
	}
	if (value === null && alternatives.length === 0) return null;
	return {
		value: value ?? '',
		confident: value !== null && choice.confidence >= confidentThreshold,
		alternatives,
		confidence: value === null ? 0 : choice.confidence
	};
}

export const categoryDescriptions = {
	food: 'Food or drink that people will eat at an event (snacks, candy, catering, groceries)',
	printing_services:
		'Printing services such as posters, flyers, or banners printed by a print shop',
	office_supplies_goods:
		'Office supplies or durable goods for the organization (stationery, name badges, equipment, decorations)',
	merchandise_apparel:
		'Custom merchandise or apparel with a design (t-shirts, stickers, branded items)',
	gifts_prizes: 'Items given away to individual students as gifts or prizes'
} as const;

export type SuggestedCategory = keyof typeof categoryDescriptions;

export type DecisionContext = {
	vendor: string;
	itemDescription: string;
	businessPurpose: string;
	budgetLines: string[];
	receiptText: string;
};

export type Decisions = {
	budgetLine: { value: string; confident: boolean } | null;
	categories: SuggestedCategory[];
};

export function buildDecisionRequest(context: DecisionContext): JevRequest {
	const questions: Record<string, Question> = {};
	if (context.budgetLines.length > 1) {
		questions.budget_line = {
			type: 'choice',
			instructions:
				'Which student organization budget line item should pay for `purchase`? Pick the line whose name best matches what was bought and why.',
			criteria: Object.fromEntries(context.budgetLines.map((line) => [line, null]))
		};
	}
	for (const [category, description] of Object.entries(categoryDescriptions)) {
		questions[`category_${category}`] = {
			type: 'noul',
			instructions: `Is \`purchase\` in this category: ${description}?`
		};
	}
	return {
		state: {
			purchase: {
				vendor: context.vendor,
				items: context.itemDescription,
				purpose: context.businessPurpose
			},
			...(context.receiptText === '' ? {} : { receipt: context.receiptText.slice(0, 4000) })
		},
		model: 'jev-latest',
		questions
	};
}

export function parseDecisionResponse(context: DecisionContext, response: JevResponse): Decisions {
	const budget = choiceAnswer(response.answers.budget_line);
	const categories = (Object.keys(categoryDescriptions) as SuggestedCategory[]).filter(
		(category) => {
			const answer = response.answers[`category_${category}`];
			return answer?.type === 'noul' && answer.noul >= categoryThreshold;
		}
	);
	return {
		budgetLine:
			budget !== null && context.budgetLines.includes(budget.choice)
				? { value: budget.choice, confident: budget.confidence >= confidentThreshold }
				: null,
		categories
	};
}

const jevTimeoutMs = 10_000;

export async function askJev(
	request: JevRequest,
	apiKey: string,
	fetcher: typeof fetch = fetch
): Promise<JevResponse> {
	for (let attempt = 0; ; attempt += 1) {
		const response = await fetcher(jevUrl, {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(request),
			signal: AbortSignal.timeout(jevTimeoutMs)
		});
		if (response.ok) return (await response.json()) as JevResponse;
		if ((response.status === 429 || response.status === 529) && attempt < 2) {
			await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
			continue;
		}
		const body = await response.text();
		throw new Error(`Jev failed with ${response.status}: ${body.slice(0, 200)}`);
	}
}
