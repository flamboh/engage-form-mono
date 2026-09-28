import { z } from 'zod/v4';
import { zid } from 'convex-helpers/server/zod4';
import { fileDownloadUrl } from '../files';
import { ownerFromIdentity } from '../purchaseModel';
import { authedQuery } from './helpers';

export const freshPreviewUrl = authedQuery({
	args: { fileId: zid('files'), nonce: z.number() },
	returns: z.string().nullable(),
	handler: async (ctx, args) => {
		const owner = ownerFromIdentity(ctx.identity);
		const file = await ctx.db.get(args.fileId);
		if (file === null || file.owner !== owner) return null;
		try {
			return await fileDownloadUrl(ctx, file);
		} catch {
			return null;
		}
	}
});
