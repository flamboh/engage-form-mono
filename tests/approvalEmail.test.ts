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
		purpose: 'snacks',
		activity: {
			eventId: null,
			name: 'General meeting',
			dates: ['2026-09-22'],
			time: '18:00',
			location: 'EMU 101',
			attendance: 30,
			openToAllStudents: true
		},
		...overrides
	} as unknown as Request;
}

const approver = { name: 'Sam Rivera', email: 'srivera@uoregon.edu' };

test('resolves the subject and body from the request and approver', () => {
	const email = resolveApprovalEmail(request(), approver);
	expect(email.missing).toEqual([]);
	expect(email.subject.text).toBe('Chips, salsa, and cookies purchase approval');
	expect(email.body.text).toBe(
		'Hello,\n\nI approve Jordan Lee’s purchase of chips, salsa, and cookies from Market of Choice on behalf of Climbing Club, totaling $36.18, for snacks at the general meeting on Tuesday 09/22.\n\nBest,\nSam Rivera\nsrivera@uoregon.edu'
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
		request({
			vendor: ' ',
			itemDescription: '',
			totalAmount: 0,
			purpose: undefined,
			activity: {
				eventId: null,
				name: '',
				dates: [],
				time: '',
				location: '',
				attendance: null,
				openToAllStudents: true
			}
		}),
		approver
	);
	expect(email.subject.text).toBeNull();
	expect(email.body.text).toBeNull();
	expect(email.missing).toEqual(['itemDescription', 'vendor', 'totalAmount', 'eventName', 'dates']);
	expect(email.subject.parts).toEqual([
		{ kind: 'missing', variable: 'itemDescription' },
		{ kind: 'text', text: ' purchase approval' }
	]);
	const written = email.body.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('');
	expect(written).not.toMatch(/[{}]/);
	expect(email.body.parts.filter((part) => part.kind === 'missing')).toHaveLength(5);
});

test('recurring purchases list every event date in the approval', () => {
	const email = resolveApprovalEmail(
		request({
			purpose: '',
			activity: {
				eventId: null,
				name: 'Weekly listening event',
				dates: ['2026-05-19', '2026-05-12', '2026-05-26'],
				time: '18:30',
				location: 'McKenzie 240A',
				attendance: 50,
				openToAllStudents: true
			}
		}),
		approver
	);
	expect(email.body.text).toContain(
		'totaling $36.18, for the weekly listening events on Tuesdays (05/12, 05/19, 05/26).'
	);
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
