export function errorMessage(err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	return message
		.replace(/^[\s\S]*Uncaught Error:\s*/, '')
		.replace(/^\[CONVEX[^\]]*\]\s*/, '')
		.replace(/\s+at [\s\S]*$/, '')
		.replace(/\s*Called by client$/, '')
		.split('\n')[0];
}
