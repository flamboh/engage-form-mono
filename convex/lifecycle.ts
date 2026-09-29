export type Stage = 'reading' | 'after_event' | 'to_finish' | 'ready' | 'filled' | 'approved';

export const REIMBURSEMENT_WINDOW_DAYS = 30;
export const LAST_WEEK_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayInEugene(now: number): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(new Date(now));
}

function dayNumber(date: string) {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	return Date.UTC(+match[1], +match[2] - 1, +match[3]) / DAY_MS;
}

export function reimbursementDeadline(receiptDate: string | null): string | null {
	const day = receiptDate === null ? null : dayNumber(receiptDate);
	if (day === null) return null;
	return new Date((day + REIMBURSEMENT_WINDOW_DAYS) * DAY_MS).toISOString().slice(0, 10);
}

export function daysLeft(deadline: string | null, today: string): number | null {
	const end = deadline === null ? null : dayNumber(deadline);
	const start = dayNumber(today);
	if (end === null || start === null) return null;
	return end - start;
}

export function finishAfter(activityDates: string[]): string | null {
	const dates = activityDates.filter((date) => dayNumber(date) !== null).sort();
	return dates.at(-1) ?? null;
}

export function requestStage(input: {
	status: 'draft' | 'ready' | 'approved';
	lastFilledAt: number | null;
	reading: boolean;
	receiptFactsComplete: boolean;
	activityDates: string[];
	daysLeft: number | null;
	today: string;
}): Stage {
	if (input.status === 'approved') return 'approved';
	if (input.status === 'ready') return input.lastFilledAt !== null ? 'filled' : 'ready';
	if (input.reading) return 'reading';
	const latest = finishAfter(input.activityDates);
	if (
		input.receiptFactsComplete &&
		(latest === null || latest >= input.today) &&
		(input.daysLeft === null || input.daysLeft > LAST_WEEK_DAYS)
	) {
		return 'after_event';
	}
	return 'to_finish';
}
