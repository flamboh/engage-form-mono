import type { Doc } from './_generated/dataModel';

export const businessPurposeVariables = [
	{ id: 'studentOrganization', label: 'Student Organization' },
	{ id: 'purchaser', label: 'Purchaser' },
	{ id: 'vendor', label: 'Vendor' },
	{ id: 'itemDescription', label: 'Item Description' },
	{ id: 'totalAmount', label: 'Total Amount' },
	{ id: 'recipients', label: 'Recipients' },
	{ id: 'recipientUo95Ids', label: 'Recipient UO 95 IDs' },
	{ id: 'activityDate', label: 'Activity Date' },
	{ id: 'officeLocation', label: 'Office Location' }
] as const;

export type BusinessPurposeVariable = (typeof businessPurposeVariables)[number]['id'];
export type BusinessPurposePart =
	| { kind: 'text'; text: string }
	| { kind: 'variable'; variable: BusinessPurposeVariable };
export type BusinessPurposeSource = { parts: BusinessPurposePart[] };
type BusinessPurposeRequest = Omit<Doc<'purchaseRequests'>, 'businessPurposeSource'> & {
	activityDate?: string;
	eventDate?: string;
};

const variablesByLabel: Map<string, (typeof businessPurposeVariables)[number]> = new Map(
	businessPurposeVariables.map((variable) => [variable.label, variable])
);
const variablesById: Map<string, (typeof businessPurposeVariables)[number]> = new Map(
	businessPurposeVariables.map((variable) => [variable.id, variable])
);

export function parseBusinessPurposeText(text: string): BusinessPurposeSource {
	const parts: BusinessPurposePart[] = [];
	const tokenPattern = /\{([^{}]+)\}/g;
	let lastIndex = 0;
	for (const match of text.matchAll(tokenPattern)) {
		if (match.index > lastIndex) {
			parts.push({ kind: 'text', text: text.slice(lastIndex, match.index) });
		}
		const name = match[1].trim();
		const variable = variablesByLabel.get(name) ?? variablesById.get(name);
		if (variable === undefined) {
			throw new Error(`Unknown Business Purpose variable: ${name}.`);
		}
		parts.push({ kind: 'variable', variable: variable.id });
		lastIndex = match.index + match[0].length;
	}
	if (lastIndex < text.length) parts.push({ kind: 'text', text: text.slice(lastIndex) });
	return { parts };
}

export function formatBusinessPurposeSource(source: BusinessPurposeSource) {
	return source.parts
		.map((part) => {
			if (part.kind === 'text') return part.text;
			return `{${labelForVariable(part.variable)}}`;
		})
		.join('');
}

export function validateBusinessPurposeSource(source: BusinessPurposeSource) {
	for (const part of source.parts) {
		if (part.kind === 'variable' && !variablesById.has(part.variable)) {
			throw new Error(`Unknown Business Purpose variable: ${part.variable}.`);
		}
	}
}

export function resolveBusinessPurpose(
	source: BusinessPurposeSource,
	request: BusinessPurposeRequest
) {
	validateBusinessPurposeSource(source);
	const unresolved = new Set<BusinessPurposeVariable>();
	const text = source.parts
		.map((part) => {
			if (part.kind === 'text') return part.text;
			const value = valueForVariable(part.variable, request);
			if (value === null) {
				unresolved.add(part.variable);
				return `{${labelForVariable(part.variable)}}`;
			}
			return value;
		})
		.join('');
	return { text, unresolved: [...unresolved] };
}

function labelForVariable(variable: BusinessPurposeVariable) {
	const entry = variablesById.get(variable);
	if (entry === undefined) throw new Error(`Unknown Business Purpose variable: ${variable}.`);
	return entry.label;
}

function valueForVariable(variable: BusinessPurposeVariable, request: BusinessPurposeRequest) {
	switch (variable) {
		case 'studentOrganization':
			return textValue(request.studentOrganization.name);
		case 'purchaser':
			return textValue(request.purchaser.name);
		case 'vendor':
			return textValue(request.vendor);
		case 'itemDescription':
			return textValue(request.itemDescription);
		case 'totalAmount':
			return request.totalAmount > 0 ? formatMoney(request.totalAmount) : null;
		case 'recipients':
			return listValue(request.recipients.map((recipient) => recipient.name));
		case 'recipientUo95Ids':
			return listValue(request.recipients.map((recipient) => recipient.uo95));
		case 'activityDate':
			return textValue(activityDateForPurchase(request));
		case 'officeLocation':
			return textValue(request.officeLocation);
	}
}

function listValue(values: string[]) {
	const entered = values.map((value) => value.trim()).filter((value) => value !== '');
	return entered.length === 0 ? null : entered.join(', ');
}

function textValue(value: string) {
	const trimmed = value.trim();
	return trimmed === '' ? null : trimmed;
}

function formatMoney(value: number) {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function activityDateForPurchase(request: BusinessPurposeRequest) {
	return request.activityDate ?? request.eventDate ?? '';
}
