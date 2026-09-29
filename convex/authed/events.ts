import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { authedMutation, authedQuery } from './helpers';
import { normalizeEventDates } from '../events';
import { ownerFromIdentity, requireOwnedDoc, requireText } from '../purchaseModel';
import { activity, eventDoc, nullReturn } from '../purchaseZod';

const listLimit = 20;

export const listEvents = authedQuery({
	args: { organizationId: zid('organizations') },
	returns: z.array(eventDoc),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const events = await ctx.db
			.query('events')
			.withIndex('by_owner_and_organizationId_and_archived', (q) =>
				q.eq('owner', owner).eq('organizationId', args.organizationId).eq('archived', false)
			)
			.take(100);
		return events
			.sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || b.updatedAt - a.updatedAt)
			.slice(0, listLimit);
	}
});

export const upsertEvent = authedMutation({
	args: {
		id: zid('events').optional(),
		organizationId: zid('organizations'),
		name: z.string(),
		weekday: z.number().nullable(),
		time: z.string(),
		location: z.string(),
		attendance: z.number().nullable(),
		openToAllStudents: z.boolean()
	},
	returns: zid('events'),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'organizations', args.organizationId, owner);
		const name = args.name.trim().slice(0, 120);
		requireText(name, 'Event name missing.');
		if (
			args.weekday !== null &&
			!(Number.isInteger(args.weekday) && args.weekday >= 0 && args.weekday <= 6)
		) {
			throw new Error('Weekday must be 0 to 6.');
		}
		const fields = {
			name,
			weekday: args.weekday,
			time: normalizeTime(args.time),
			location: args.location.trim().slice(0, 200),
			attendance: normalizeAttendance(args.attendance),
			openToAllStudents: args.openToAllStudents,
			updatedAt: Date.now()
		};
		if (args.id === undefined) {
			return await ctx.db.insert('events', {
				...fields,
				owner,
				organizationId: args.organizationId,
				lastUsedAt: null,
				archived: false
			});
		}
		const existing = await requireOwnedDoc(ctx, 'events', args.id, owner);
		if (existing.organizationId !== args.organizationId) {
			throw new Error('Event belongs to another Student Organization.');
		}
		await ctx.db.patch(args.id, fields);
		return args.id;
	}
});

export const archiveEvent = authedMutation({
	args: { id: zid('events') },
	returns: nullReturn,
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		await requireOwnedDoc(ctx, 'events', args.id, owner);
		await ctx.db.patch(args.id, { archived: true, updatedAt: Date.now() });
		return null;
	}
});

export function normalizeActivity(value: z.infer<typeof activity>): z.infer<typeof activity> {
	return {
		eventId: value.eventId,
		name: value.name.trim().slice(0, 120),
		dates: normalizeEventDates(value.dates).slice(0, 20),
		time: normalizeTime(value.time),
		location: value.location.trim().slice(0, 200),
		attendance: normalizeAttendance(value.attendance),
		openToAllStudents: value.openToAllStudents
	};
}

function normalizeTime(value: string) {
	const text = value.trim();
	if (text === '') return '';
	const match = /^(\d{1,2}):(\d{2})$/.exec(text);
	if (match === null || Number(match[1]) > 23 || Number(match[2]) > 59) {
		throw new Error('Time must be HH:MM.');
	}
	return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function normalizeAttendance(value: number | null) {
	if (value === null) return null;
	if (!Number.isFinite(value) || value < 0)
		throw new Error('Attendance must be a positive number.');
	return value === 0 ? null : Math.round(value);
}
