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
	{ id: 'activityTime', label: 'Time' },
	{ id: 'activityLocation', label: 'Location' },
	{ id: 'officeLocation', label: 'Office Location' },
	{ id: 'purpose', label: 'Purpose' }
] as const;

export type BusinessPurposeVariable = (typeof businessPurposeVariables)[number]['id'];
export type BusinessPurposePart =
	| { kind: 'text'; text: string }
	| { kind: 'variable'; variable: BusinessPurposeVariable };
export type BusinessPurposeSource = { parts: BusinessPurposePart[] };
export type BusinessPurposeRequest = Omit<Doc<'purchaseRequests'>, 'businessPurposeSource'>;

const variablesByLabel: Map<string, (typeof businessPurposeVariables)[number]> = new Map(
	businessPurposeVariables.map((variable) => [variable.label, variable])
);
const variablesById: Map<string, (typeof businessPurposeVariables)[number]> = new Map(
	businessPurposeVariables.map((variable) => [variable.id, variable])
);

const tokenPattern = /\{([^{}]+)\}/g;

export function parseBusinessPurposeText(text: string): BusinessPurposeSource {
	const parts: BusinessPurposePart[] = [];
	const pushText = (value: string) => {
		if (value === '') return;
		const last = parts.at(-1);
		if (last?.kind === 'text') last.text += value;
		else parts.push({ kind: 'text', text: value });
	};
	let lastIndex = 0;
	for (const match of text.matchAll(tokenPattern)) {
		pushText(text.slice(lastIndex, match.index));
		const variable = variableForToken(match[1]);
		if (variable === undefined) pushText(match[0]);
		else parts.push({ kind: 'variable', variable: variable.id });
		lastIndex = match.index + match[0].length;
	}
	pushText(text.slice(lastIndex));
	return { parts };
}

export function validateBusinessPurposeText(text: string) {
	for (const match of text.matchAll(tokenPattern)) {
		if (variableForToken(match[1]) === undefined) {
			throw new Error(`Unknown Business Purpose variable: ${match[1].trim()}.`);
		}
	}
	return parseBusinessPurposeText(text);
}

function variableForToken(token: string) {
	const name = token.trim();
	return variablesByLabel.get(name) ?? variablesById.get(name);
}

export function formatBusinessPurposeSource(source: BusinessPurposeSource) {
	return source.parts
		.map((part) => {
			if (part.kind === 'text') return part.text;
			return `{${labelForVariable(part.variable)}}`;
		})
		.join('');
}

export function mentionsPurpose(text: string) {
	return parseBusinessPurposeText(text).parts.some(
		(part) => part.kind === 'variable' && part.variable === 'purpose'
	);
}

export function withPurpose(text: string) {
	if (mentionsPurpose(text)) return text;
	const trimmed = text.trimEnd();
	if (trimmed === '') return 'For {Purpose}.';
	const ending = /[.!]$/.exec(trimmed)?.[0] ?? '';
	return `${trimmed.slice(0, trimmed.length - ending.length)} for {Purpose}${ending}`;
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

export function valueForVariable(
	variable: BusinessPurposeVariable,
	request: BusinessPurposeRequest
) {
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
			return textValue(formatActivityDate(request.activityDate));
		case 'activityTime':
			return textValue(formatActivityTime(request.activityTime ?? ''));
		case 'activityLocation':
			return textValue(request.activityLocation ?? '');
		case 'officeLocation':
			return textValue(request.officeLocation);
		case 'purpose':
			return textValue(request.purpose ?? '');
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

export function formatActivityTime(value: string) {
	const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
	if (match === null) return value.trim();
	const hours = Number(match[1]);
	if (hours > 23) return value.trim();
	const suffix = hours < 12 ? 'AM' : 'PM';
	return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${suffix}`;
}

function formatActivityDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
	if (match === null) return value;
	const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(date);
}
