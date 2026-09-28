import {
	parseBusinessPurposeText,
	valueForVariable,
	type BusinessPurposeRequest,
	type BusinessPurposeVariable
} from './businessPurpose';

export const approvalEmailTemplate = {
	subject: '{Item Description} purchase approval',
	body: 'Hello,\n\nI approve {Purchaser}’s purchase of {Item Description} from {Vendor} on behalf of {Student Organization}, totaling {Total Amount}, for {Purpose}.\n\nBest,',
	ask: 'Could you approve a purchase for {Student Organization}? Engage needs a written OK from another officer. Please reply with the message below so I can attach it to the request.'
};

export type Approver = { name: string; email: string };
export type ApprovalEmailPart =
	| { kind: 'text'; text: string }
	| { kind: 'missing'; variable: BusinessPurposeVariable };
export type ApprovalEmailText = { parts: ApprovalEmailPart[]; text: string | null };
export type ApprovalEmail = {
	subject: ApprovalEmailText;
	body: ApprovalEmailText;
	missing: BusinessPurposeVariable[];
};

export function resolveApprovalEmail(
	request: BusinessPurposeRequest,
	approver: Approver
): ApprovalEmail {
	const signature = [approver.name, approver.email]
		.map((line) => line.trim())
		.filter((line) => line !== '');
	const subject = resolveTemplate(approvalEmailTemplate.subject, request, true);
	const body = resolveTemplate(
		[approvalEmailTemplate.body, ...signature].join('\n'),
		request,
		false
	);
	const missing = new Set<BusinessPurposeVariable>();
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
	request: BusinessPurposeRequest;
	approval: string;
	approverName: string;
	requesterName: string;
}) {
	const firstName = approverName.trim().split(/\s+/)[0] ?? '';
	return [
		firstName === '' ? 'Hi,' : `Hi ${firstName},`,
		'',
		joinParts(resolveTemplate(approvalEmailTemplate.ask, request, false).parts),
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

function resolveTemplate(
	template: string,
	request: BusinessPurposeRequest,
	capitalize: boolean
): ApprovalEmailText {
	const parts: ApprovalEmailPart[] = [];
	const pushText = (text: string) => {
		const last = parts.at(-1);
		if (last?.kind === 'text') last.text += text;
		else parts.push({ kind: 'text', text });
	};
	for (const part of parseBusinessPurposeText(template).parts) {
		if (part.kind === 'text') {
			pushText(part.text);
			continue;
		}
		const value = valueForVariable(part.variable, request);
		if (value === null) parts.push({ kind: 'missing', variable: part.variable });
		else pushText(value);
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
