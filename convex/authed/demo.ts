import { z } from 'zod/v4';
import { authedQuery } from './helpers';

export const authedDemoQuery = authedQuery({
	args: {},
	returns: z.object({ message: z.string() }),
	handler: async (ctx) => {
		const message = `Hello, ${ctx.identity.email}!`;
		return { message };
	}
});
