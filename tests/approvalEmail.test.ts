import { expect, test } from 'vitest';
import { approvalRequestBody, mailtoUrl, resolveApprovalEmail } from '../convex/approvalEmail';

type Request = Parameters<typeof resolveApprovalEmail>[0];

function request(overrides: Partial<Record<string, unknown>> = {}) {
	return {
		studentOrganization: { name: 'Climbing Club' },
		purchaser: { name: 'Jordan Lee' },
		vendor: 'Market of Choice',
		itemDescription: 'chips, salsa, and cookies',
		totalAmount: 36.18,
		purpose: 'the general meeting',
		...overrides
	} as unknown as Request;
}

const approver = { name: 'Sam Rivera', email: 'srivera@uoregon.edu' };

test('resolves the subject and body from the request and approver', () => {
	const email = resolveApprovalEmail(request(), approver);
	expect(email.missing).toEqual([]);
	expect(email.subject.text).toBe('Chips, salsa, and cookies purchase approval');
	expect(email.body.text).toBe(
		'Hello,\n\nI approve Jordan Lee’s purchase of chips, salsa, and cookies from Market of Choice on behalf of Climbing Club, totaling $36.18, for the general meeting.\n\nBest,\nSam Rivera\nsrivera@uoregon.edu'
	);
});

test('leaves out signature lines the user has not filled in', () => {
	const email = resolveApprovalEmail(request(), { name: '  ', email: 'srivera@uoregon.edu ' });
	expect(email.body.text?.endsWith('Best,\nsrivera@uoregon.edu')).toBe(true);
	expect(
		resolveApprovalEmail(request(), { name: '', email: '' }).body.text?.endsWith('Best,')
	).toBe(true);
});

test('reports missing values instead of writing template tokens', () => {
	const email = resolveApprovalEmail(
		request({ vendor: ' ', itemDescription: '', totalAmount: 0, purpose: undefined }),
		approver
	);
	expect(email.subject.text).toBeNull();
	expect(email.body.text).toBeNull();
	expect(email.missing).toEqual(['itemDescription', 'vendor', 'totalAmount', 'purpose']);
	expect(email.subject.parts).toEqual([
		{ kind: 'missing', variable: 'itemDescription' },
		{ kind: 'text', text: ' purchase approval' }
	]);
	const written = email.body.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('');
	expect(written).not.toMatch(/[{}]/);
	expect(email.body.parts.filter((part) => part.kind === 'missing')).toHaveLength(4);
});

test('builds the ask with the approval below it', () => {
	const email = resolveApprovalEmail(request(), approver);
	const body = approvalRequestBody({
		request: request(),
		approval: email.body.text ?? '',
		approverName: 'Sam Rivera',
		requesterName: 'Jordan Lee'
	});
	expect(body.startsWith('Hi Sam,\n\nCould you approve a purchase for Climbing Club?')).toBe(true);
	expect(body).toContain('Thanks,\nJordan Lee\n\n---\n\nHello,\n\nI approve Jordan Lee’s');
	expect(
		approvalRequestBody({
			request: request(),
			approval: 'ok',
			approverName: '',
			requesterName: 'Jordan Lee'
		}).startsWith('Hi,\n')
	).toBe(true);
});

test('mailto links encode the subject, body, and line breaks', () => {
	const url = mailtoUrl({
		to: ' srivera@uoregon.edu ',
		subject: 'Chips & salsa purchase approval?',
		body: 'Hello,\n\nI approve $36.18 for 100% of it.\nBest, Sam'
	});
	expect(url).toBe(
		'mailto:srivera@uoregon.edu?subject=Chips%20%26%20salsa%20purchase%20approval%3F&body=Hello%2C%0D%0A%0D%0AI%20approve%20%2436.18%20for%20100%25%20of%20it.%0D%0ABest%2C%20Sam'
	);
	const parsed = new URL(url);
	expect(parsed.protocol).toBe('mailto:');
	expect(parsed.searchParams.get('body')).toBe(
		'Hello,\r\n\r\nI approve $36.18 for 100% of it.\r\nBest, Sam'
	);
});

test('mailto links work without an address and keep typographic characters', () => {
	const url = mailtoUrl({ to: '', subject: 'Jordan’s approval', body: 'a\r\nb' });
	expect(url).toBe('mailto:?subject=Jordan%E2%80%99s%20approval&body=a%0D%0Ab');
});
