import { expect, test } from 'vitest';
import { defaultApproverTitle, resolveApprovalMessage } from '../convex/approvalMessage';

type Request = Parameters<typeof resolveApprovalMessage>[0];

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

const approver = {
	name: 'Sam Rivera',
	email: 'srivera@uoregon.edu',
	title: 'Climbing Club leader'
};

test('writes the subject, approval, and signature as one plain text message', () => {
	const message = resolveApprovalMessage(request(), approver);
	expect(message.missing).toEqual([]);
	expect(message.text).toBe(
		"Subject: Chips, salsa, and cookies purchase approval\n\nHello,\n\nI approve Jordan Lee's purchase of chips, salsa, and cookies from Market of Choice on behalf of Climbing Club, totaling $36.18, for snacks at the general meeting on Tuesday 09/22.\n\nBest,\nSam Rivera\nClimbing Club leader\nsrivera@uoregon.edu"
	);
});

test('matches the approval Oliver sends for a weekly discussion prize', () => {
	const message = resolveApprovalMessage(
		request({
			studentOrganization: { name: 'Album Listening Club' },
			purchaser: { name: 'Oliver Boorstein' },
			vendor: 'Magdalena Bay Store',
			itemDescription: 'Imaginal Disk 2x12" Vinyl (Whirlpool)',
			totalAmount: 48.62,
			purpose: 'giving out in our weekly Kahoot! trivia game',
			activity: {
				eventId: null,
				name: 'Weekly discussion',
				dates: ['2026-10-07'],
				time: '18:30',
				location: 'McKenzie 240A',
				attendance: 40,
				openToAllStudents: true
			}
		}),
		{ name: 'Jon Tom', email: 'jtom@uoregon.edu', title: 'Album Listening Club leader' }
	);
	expect(message.text).toBe(
		[
			'Subject: Imaginal Disk 2x12" Vinyl (Whirlpool) purchase approval',
			'',
			'Hello,',
			'',
			'I approve Oliver Boorstein\'s purchase of Imaginal Disk 2x12" Vinyl (Whirlpool) from Magdalena Bay Store on behalf of Album Listening Club, totaling $48.62, for giving out in our weekly Kahoot! trivia game at the weekly discussion event on Wednesday 10/07.',
			'',
			'Best,',
			'Jon Tom',
			'Album Listening Club leader',
			'jtom@uoregon.edu'
		].join('\n')
	);
});

test('leaves out an empty title but waits for the name and UO email', () => {
	expect(resolveApprovalMessage(request(), { ...approver, title: '  ' }).text).toMatch(
		/Best,\nSam Rivera\nsrivera@uoregon\.edu$/
	);
	const unsigned = resolveApprovalMessage(request(), { name: ' ', email: '', title: 'Treasurer' });
	expect(unsigned.text).toBeNull();
	expect(unsigned.missing).toEqual(['approverName', 'approverEmail']);
	expect(unsigned.parts.slice(-3)).toEqual([
		{ kind: 'missing', field: 'approverName' },
		{ kind: 'text', text: '\nTreasurer\n' },
		{ kind: 'missing', field: 'approverEmail' }
	]);
});

test('reports missing request values instead of writing template tokens', () => {
	const message = resolveApprovalMessage(
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
	expect(message.text).toBeNull();
	expect(message.missing).toEqual([
		'itemDescription',
		'vendor',
		'totalAmount',
		'eventName',
		'dates'
	]);
	expect(message.parts.slice(0, 2)).toEqual([
		{ kind: 'text', text: 'Subject: ' },
		{ kind: 'missing', field: 'itemDescription' }
	]);
	const written = message.parts.map((part) => (part.kind === 'text' ? part.text : '')).join('');
	expect(written).not.toMatch(/[{}]/);
	expect(message.parts.filter((part) => part.kind === 'missing')).toHaveLength(6);
});

test('recurring purchases list every event date in the approval', () => {
	const message = resolveApprovalMessage(
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
	expect(message.text).toContain(
		'totaling $36.18, for the weekly listening events on Tuesdays (05/12, 05/19, 05/26).'
	);
});

test('titles the approver as a leader of the organization by default', () => {
	expect(defaultApproverTitle(' Album Listening Club ')).toBe('Album Listening Club leader');
	expect(defaultApproverTitle('')).toBe('');
});
