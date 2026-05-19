export function readConvexUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_URL ?? import.meta.env.VITE_CONVEX_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_URL for extension.');
	}
	return env;
}

export function readWebAppUrl() {
	const env = import.meta.env.PUBLIC_WEB_APP_URL ?? 'http://localhost:3676';
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_WEB_APP_URL for extension.');
	}
	return env.replace(/\/$/, '');
}

export function readClerkPublishableKey() {
	const env = import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CLERK_PUBLISHABLE_KEY for extension.');
	}
	return env;
}

export function readClerkSyncHost() {
	const env = import.meta.env.PUBLIC_CLERK_SYNC_HOST ?? import.meta.env.PUBLIC_WEB_APP_URL;
	if (typeof env === 'string' && env.trim() !== '') {
		const host = env.replace(/\/$/, '');
		if (new URL(host).hostname === 'localhost') return 'http://localhost';
		return host;
	}
	return 'http://localhost';
}
