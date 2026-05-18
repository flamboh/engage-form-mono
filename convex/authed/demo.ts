import { v } from 'convex/values';
import { authedQuery } from './helpers';

export const authedDemoQuery = authedQuery({
	args: {},
	returns: v.object({ message: v.string() }),
	handler: async (ctx) => {
		const message = `Hello, ${ctx.identity.email}!`;
		return { message };
	}
});
