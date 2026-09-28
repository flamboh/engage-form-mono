export const inputClass =
	'h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#154733] focus:ring-2 focus:ring-[#154733]/20 focus:outline-none sm:text-sm';

export const textareaClass =
	'min-h-28 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 focus:border-[#154733] focus:ring-2 focus:ring-[#154733]/20 focus:outline-none sm:text-sm';

export const primaryButtonClass =
	'inline-flex h-11 items-center justify-center rounded-full bg-[#154733] px-5 text-sm font-medium text-white hover:bg-[#0f3526] focus-visible:ring-2 focus-visible:ring-[#154733]/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-60';

export const secondaryButtonClass =
	'inline-flex h-10 items-center justify-center rounded-full border border-stone-300 px-4 text-sm font-medium hover:border-stone-900 focus-visible:ring-2 focus-visible:ring-[#154733]/40 focus-visible:outline-none disabled:opacity-60';

export const labelClass = 'flex flex-col gap-1.5 text-sm font-medium text-stone-800';

export const hintClass = 'text-xs font-normal text-stone-500';

export function errorMessage(err: unknown) {
	const message = err instanceof Error ? err.message : String(err);
	return message
		.replace(/^[\s\S]*Uncaught Error:\s*/, '')
		.replace(/\s+at [\s\S]*$/, '')
		.replace(/\s*Called by client$/, '');
}
