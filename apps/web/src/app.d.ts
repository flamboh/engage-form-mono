// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { ExecutionContext, R2Bucket } from '@cloudflare/workers-types';

declare global {
	namespace App {
		// can customize this to be whatever u want
		interface Error {
			readonly message: string;
			readonly kind: string;
			readonly timestamp: number;
			readonly traceId?: string;
		}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				FILES: R2Bucket;
			};
			ctx: ExecutionContext;
		}
	}
}

export {};
