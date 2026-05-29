// "authed" queries/mutations/actions are ones that get called from the client, protected by the clerk auth token

import { zCustomAction, zCustomMutation, zCustomQuery } from 'convex-helpers/server/zod4';
import { action, mutation, query } from '../_generated/server';

export const authedQuery = zCustomQuery(query, {
	args: {},
	input: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throw new Error('Unauthorized');
		}

		return { ctx: { ...ctx, identity }, args: {} };
	}
});

export const authedMutation = zCustomMutation(mutation, {
	args: {},
	input: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throw new Error('Unauthorized');
		}

		return { ctx: { ...ctx, identity }, args: {} };
	}
});

export const authedAction = zCustomAction(action, {
	args: {},
	input: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (identity === null) {
			throw new Error('Unauthorized');
		}

		return { ctx: { ...ctx, identity }, args: {} };
	}
});
