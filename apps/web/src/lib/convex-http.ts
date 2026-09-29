import { CONVEX_URL } from '$lib/convex-env';
import { ConvexHttpClient } from 'convex/browser';
import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';

export type ClerkSession = {
	getToken(options: { template: string }): Promise<string | null>;
};

export async function convexMutation<Func extends FunctionReference<'mutation'>>(
	session: ClerkSession,
	func: Func,
	args: FunctionArgs<Func>
): Promise<FunctionReturnType<Func>> {
	const token = await session.getToken({ template: 'convex' });
	if (!token) throw new Error('Clerk session token missing.');
	const convex = new ConvexHttpClient(CONVEX_URL);
	convex.setAuth(token);
	return await convex.mutation(func, args);
}
