import { CONVEX_URL } from '$lib/convex-env';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';

export type ClerkSession = {
	getToken(options: { template: string }): Promise<string | null>;
};

export async function convexQuery<Func extends FunctionReference<'query'>>(
	session: ClerkSession,
	func: Func,
	args: FunctionArgs<Func>
): Promise<FunctionReturnType<Func>> {
	return await client(session).query(func, args);
}

export async function convexMutation<Func extends FunctionReference<'mutation'>>(
	session: ClerkSession,
	func: Func,
	args: FunctionArgs<Func>
): Promise<FunctionReturnType<Func>> {
	return await client(session).mutation(func, args);
}

function client(session: ClerkSession) {
	return {
		async query<Func extends FunctionReference<'query'>>(
			func: Func,
			args: FunctionArgs<Func>
		): Promise<FunctionReturnType<Func>> {
			const convex = await authedClient(session);
			return await convex.query(func, args);
		},
		async mutation<Func extends FunctionReference<'mutation'>>(
			func: Func,
			args: FunctionArgs<Func>
		): Promise<FunctionReturnType<Func>> {
			const convex = await authedClient(session);
			return await convex.mutation(func, args);
		}
	};
}

async function authedClient(session: ClerkSession) {
	const token = await session.getToken({ template: 'convex' });
	if (!token) throw new Error('Clerk session token missing.');
	const convex = new ConvexHttpClient(CONVEX_URL);
	convex.setAuth(token);
	return convex;
}
