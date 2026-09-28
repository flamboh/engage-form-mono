export function withTimeout<T>(promise: Promise<T>, message: string, timeoutMs: number) {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
		promise.then(resolve, reject).finally(() => clearTimeout(timeout));
	});
}
