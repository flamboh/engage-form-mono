import type { Doc } from './_generated/dataModel';
import { eventReference, formatMoney, midSentence } from './businessPurpose';
import { eventDatesPhrase } from './events';

export type ApprovalField =
	| 'studentOrganization'
	| 'purchaser'
	| 'vendor'
	| 'itemDescription'
	| 'totalAmount'
	| 'eventName'
	| 'dates'
	| 'approverName'
	| 'approverEmail';

export type ApprovalRequest = Pick<
	Doc<'purchaseRequests'>,
	'studentOrganization' | 'purchaser' | 'vendor' | 'itemDescription' | 'totalAmount' | 'activity'
> & { purpose?: string };

export type Approver = { name: string; email: string; title: string };
export type ApprovalPart =
	| { kind: 'text'; text: string }
	| { kind: 'missing'; field: ApprovalField };
export type ApprovalMessage = {
	parts: ApprovalPart[];
	text: string | null;
	missing: ApprovalField[];
};

type Piece = string | { field: ApprovalField; capitalize?: boolean };

export function defaultApproverTitle(organizationName: string) {
	const name = organizationName.trim();
	return name === '' ? '' : `${name} leader`;
}

export function resolveApprovalMessage(
	request: ApprovalRequest,
	approver: Approver
): ApprovalMessage {
	const values = approvalValues(request, approver);
	const purpose = midSentence((request.purpose ?? '').trim().replace(/^for\s+/i, ''));
	const title = approver.title.trim();
	const pieces: Piece[] = [
		'Subject: ',
		{ field: 'itemDescription', capitalize: true },
		' purchase approval\n\nHello,\n\nI approve ',
		{ field: 'purchaser' },
		"'s purchase of ",
		{ field: 'itemDescription' },
		' from ',
		{ field: 'vendor' },
		' on behalf of ',
		{ field: 'studentOrganization' },
		', totaling ',
		{ field: 'totalAmount' },
		purpose === '' ? ', for ' : `, for ${purpose} at `,
		{ field: 'eventName' },
		' ',
		{ field: 'dates' },
		'.\n\nBest,\n',
		{ field: 'approverName' },
		title === '' ? '\n' : `\n${title}\n`,
		{ field: 'approverEmail' }
	];
	const parts: ApprovalPart[] = [];
	for (const piece of pieces) {
		const text = typeof piece === 'string' ? piece : values[piece.field];
		if (text === '' && typeof piece !== 'string') {
			parts.push({ kind: 'missing', field: piece.field });
			continue;
		}
		const written =
			typeof piece !== 'string' && piece.capitalize
				? text.charAt(0).toUpperCase() + text.slice(1)
				: text;
		const last = parts.at(-1);
		if (last?.kind === 'text') last.text += written;
		else parts.push({ kind: 'text', text: written });
	}
	const missing = [
		...new Set(parts.flatMap((part) => (part.kind === 'missing' ? [part.field] : [])))
	];
	return {
		parts,
		text:
			missing.length === 0
				? parts.map((part) => (part.kind === 'text' ? part.text : '')).join('')
				: null,
		missing
	};
}

function approvalValues(
	request: ApprovalRequest,
	approver: Approver
): Record<ApprovalField, string> {
	const eventName = request.activity.name.trim();
	return {
		studentOrganization: request.studentOrganization.name.trim(),
		purchaser: request.purchaser.name.trim(),
		vendor: request.vendor.trim(),
		itemDescription: request.itemDescription.trim(),
		totalAmount: request.totalAmount > 0 ? formatMoney(request.totalAmount) : '',
		eventName: eventName === '' ? '' : eventReference(eventName, request.activity.dates.length > 1),
		dates: eventDatesPhrase(request.activity.dates),
		approverName: approver.name.trim(),
		approverEmail: approver.email.trim()
	};
}
