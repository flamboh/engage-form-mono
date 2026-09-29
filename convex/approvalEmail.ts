import type { Doc } from './_generated/dataModel';
import { eventReference, formatMoney, midSentence } from './businessPurpose';
import { eventDatesPhrase } from './events';

export type ApprovalEmailField =
	| 'studentOrganization'
	| 'purchaser'
	| 'vendor'
	| 'itemDescription'
	| 'totalAmount'
	| 'eventName'
	| 'dates';

export type ApprovalEmailRequest = Pick<
	Doc<'purchaseRequests'>,
	'studentOrganization' | 'purchaser' | 'vendor' | 'itemDescription' | 'totalAmount' | 'activity'
> & { purpose?: string };

export type Approver = { name: string; email: string };
export type ApprovalEmailPart =
	| { kind: 'text'; text: string }
	| { kind: 'missing'; variable: ApprovalEmailField };
export type ApprovalEmailText = { parts: ApprovalEmailPart[]; text: string | null };
export type ApprovalEmail = {
	subject: ApprovalEmailText;
	body: ApprovalEmailText;
	missing: ApprovalEmailField[];
};

type Piece = string | ApprovalEmailField;

export function resolveApprovalEmail(
	request: ApprovalEmailRequest,
	approver: Approver
): ApprovalEmail {
	const values = approvalValues(request);
	const signature = [approver.name, approver.email]
		.map((line) => line.trim())
		.filter((line) => line !== '');
	const purpose = midSentence((request.purpose ?? '').trim().replace(/^for\s+/i, ''));
	const subject = resolve(['itemDescription', ' purchase approval'], values, true);
	const body = resolve(
		[
			'Hello,\n\nI approve ',
			'purchaser',
			'’s purchase of ',
			'itemDescription',
			' from ',
			'vendor',
			' on behalf of ',
			'studentOrganization',
			', totaling ',
			'totalAmount',
			purpose === '' ? ', for ' : `, for ${purpose} at `,
			'eventName',
			' ',
			'dates',
			'.\n\nBest,',
			...signature.map((line) => `\n${line}`)
		],
		values,
		false
	);
	const missing = new Set<ApprovalEmailField>();
	for (const part of [...subject.parts, ...body.parts]) {
		if (part.kind === 'missing') missing.add(part.variable);
	}
	return { subject, body, missing: [...missing] };
}

export function approvalRequestBody({
	request,
	approval,
	approverName,
	requesterName
}: {
	request: ApprovalEmailRequest;
	approval: string;
	approverName: string;
	requesterName: string;
}) {
	const firstName = approverName.trim().split(/\s+/)[0] ?? '';
	const ask = resolve(
		[
			'Could you approve a purchase for ',
			'studentOrganization',
			'? Engage needs a written OK from another officer. Please reply with the message below so I can attach it to the request.'
		],
		approvalValues(request),
		false
	);
	return [
		firstName === '' ? 'Hi,' : `Hi ${firstName},`,
		'',
		joinParts(ask.parts),
		'',
		'Thanks,',
		requesterName.trim(),
		'',
		'---',
		'',
		approval
	].join('\n');
}

export function mailtoUrl({ to, subject, body }: { to: string; subject: string; body: string }) {
	const encode = (value: string) => encodeURIComponent(value.replace(/\r?\n/g, '\r\n'));
	const address = encodeURIComponent(to.trim()).replace(/%40/g, '@');
	return `mailto:${address}?subject=${encode(subject)}&body=${encode(body)}`;
}

const fields = new Set<string>([
	'studentOrganization',
	'purchaser',
	'vendor',
	'itemDescription',
	'totalAmount',
	'eventName',
	'dates'
]);

function approvalValues(request: ApprovalEmailRequest): Record<ApprovalEmailField, string> {
	const eventName = request.activity.name.trim();
	return {
		studentOrganization: request.studentOrganization.name.trim(),
		purchaser: request.purchaser.name.trim(),
		vendor: request.vendor.trim(),
		itemDescription: request.itemDescription.trim(),
		totalAmount: request.totalAmount > 0 ? formatMoney(request.totalAmount) : '',
		eventName: eventName === '' ? '' : eventReference(eventName, request.activity.dates.length > 1),
		dates: eventDatesPhrase(request.activity.dates)
	};
}

function resolve(
	pieces: Piece[],
	values: Record<ApprovalEmailField, string>,
	capitalize: boolean
): ApprovalEmailText {
	const parts: ApprovalEmailPart[] = [];
	const pushText = (text: string) => {
		const last = parts.at(-1);
		if (last?.kind === 'text') last.text += text;
		else parts.push({ kind: 'text', text });
	};
	for (const piece of pieces) {
		if (!fields.has(piece)) {
			pushText(piece);
			continue;
		}
		const variable = piece as ApprovalEmailField;
		if (values[variable] === '') parts.push({ kind: 'missing', variable });
		else pushText(values[variable]);
	}
	const first = parts[0];
	if (capitalize && first?.kind === 'text') {
		first.text = first.text.charAt(0).toUpperCase() + first.text.slice(1);
	}
	const complete = parts.every((part) => part.kind === 'text');
	return { parts, text: complete ? joinParts(parts) : null };
}

function joinParts(parts: ApprovalEmailPart[]) {
	return parts.map((part) => (part.kind === 'text' ? part.text : '')).join('');
}
