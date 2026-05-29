export function createSingleFlight<TArgs extends unknown[]>(fn: (...args: TArgs) => Promise<void>) {
	let running = false;
	let queued: TArgs | null = null;
	let current: Promise<void> | null = null;

	async function drain(args: TArgs) {
		running = true;
		try {
			let next: TArgs | null = args;
			while (next !== null) {
				await fn(...next);
				next = queued;
				queued = null;
			}
		} finally {
			running = false;
			current = null;
		}
	}

	function run(...args: TArgs) {
		if (running) {
			queued = args;
			return current ?? Promise.resolve();
		}
		current = drain(args);
		return current;
	}

	async function flush() {
		await (current ?? Promise.resolve());
	}

	return { run, flush };
}
