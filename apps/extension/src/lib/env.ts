export function readConvexSiteUrl() {
	const env = import.meta.env.PUBLIC_CONVEX_SITE_URL;
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_CONVEX_SITE_URL for extension.');
	}
	return env.trim().replace(/\/$/, '');
}

export function readWebAppUrl() {
	const env = import.meta.env.PUBLIC_WEB_APP_URL ?? 'http://localhost:3676';
	if (typeof env !== 'string' || env.trim() === '') {
		throw new Error('Missing PUBLIC_WEB_APP_URL for extension.');
	}
	return env.replace(/\/$/, '');
}
