import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import type { Fund } from './funds';

type Raw = Record<string, unknown>;

export const run = internalMutation({
	args: {
		funds: v.record(v.string(), v.union(v.literal('administrative'), v.literal('programming')))
	},
	handler: async (ctx, args) => {
		const fundOf = (name: string): Fund => args.funds[name] ?? 'programming';
		let organizations = 0;
		let requests = 0;
		for (const doc of await ctx.db.query('organizations').take(500)) {
			const raw = doc as unknown as Raw;
			const lines = raw.budgetLines as Raw[];
			if (lines.every((line) => typeof line.fund === 'string')) continue;
			await ctx.db.patch(doc._id, {
				budgetLines: lines.map((line) => ({
					name: line.name as string,
					fund: (line.fund as Fund | undefined) ?? fundOf(line.name as string),
					allocations: line.allocations as { fiscalYear: number; amount: number }[]
				}))
			});
			organizations += 1;
		}
		for (const doc of await ctx.db.query('purchaseRequests').take(2000)) {
			const raw = doc as unknown as Raw;
			if (Array.isArray(raw.budgetSplits)) continue;
			const { budgetLineItem, ...rest } = raw;
			const line = typeof budgetLineItem === 'string' ? budgetLineItem.trim() : '';
			const organization = rest.studentOrganization as Raw;
			const snapshotLines = organization.budgetLines as unknown[];
			const sources = { ...((rest.fieldSources as Record<string, string> | undefined) ?? {}) };
			if ('budgetLineItem' in sources) {
				sources.budgetSplits = sources.budgetLineItem;
				delete sources.budgetLineItem;
			}
			const { _id, _creationTime, ...fields } = rest;
			void _id;
			void _creationTime;
			await ctx.db.replace(doc._id, {
				...(fields as Raw),
				studentOrganization: {
					...organization,
					budgetLines: snapshotLines.map((item) =>
						typeof item === 'string' ? { name: item, fund: fundOf(item) } : item
					)
				},
				budgetSplits: line === '' ? [] : [{ fund: fundOf(line), line, amount: null }],
				...(rest.fieldSources === undefined ? {} : { fieldSources: sources })
			} as never);
			requests += 1;
		}
		return { organizations, requests };
	}
});
