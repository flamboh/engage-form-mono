export type Stage = 'reading' | 'after_event' | 'to_finish' | 'ready' | 'filled' | 'approved';

export type StoredStatus = 'draft' | 'ready' | 'approved';

export const REIMBURSEMENT_WINDOW_DAYS = 30;
export const LAST_WEEK_DAYS = 7;

const DAY_MS = 86_400_000;
const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/;

const eugeneDate = new Intl.DateTimeFormat('en-US', {
	timeZone: 'America/Los_Angeles',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit'
});

export function todayInEugene(now: number): string {
	const parts = Object.fromEntries(
		eugeneDate.formatToParts(new Date(now)).map((part) => [part.type, part.value])
	);
	return `${parts.year}-${parts.month}-${parts.day}`;
}

function dayNumber(date: string): number | null {
	const match = isoDate.exec(date);
	if (match === null) return null;
	return Date.UTC(+match[1], +match[2] - 1, +match[3]) / DAY_MS;
}

function dateFromDayNumber(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function reimbursementDeadline(receiptDate: string | null): string | null {
	if (receiptDate === null) return null;
	const day = dayNumber(receiptDate);
	return day === null ? null : dateFromDayNumber(day + REIMBURSEMENT_WINDOW_DAYS);
}

export function daysLeft(deadline: string | null, today: string): number | null {
	if (deadline === null) return null;
	const end = dayNumber(deadline);
	const start = dayNumber(today);
	return end === null || start === null ? null : end - start;
}

export function finishAfter(activityDates: string[]): string | null {
	const dates = activityDates.filter((date) => isoDate.test(date)).sort();
	return dates.at(-1) ?? null;
}

export function receiptFactsComplete(input: {
	vendor: string;
	itemDescription: string;
	totalAmount: number;
	receiptCount: number;
}): boolean {
	return (
		input.vendor.trim() !== '' &&
		input.itemDescription.trim() !== '' &&
		input.totalAmount > 0 &&
		input.receiptCount > 0
	);
}

export function effectiveStatus(input: {
	status: StoredStatus;
	readinessReady: boolean;
	sentBack: boolean;
}): StoredStatus {
	if (input.status === 'approved') return 'approved';
	return input.readinessReady && !input.sentBack ? 'ready' : 'draft';
}

export function requestStage(input: {
	status: StoredStatus;
	lastFilledAt: number | null;
	reading: boolean;
	receiptFactsComplete: boolean;
	activityDates: string[];
	daysLeft: number | null;
	today: string;
}): Stage {
	if (input.status === 'approved') return 'approved';
	if (input.status === 'ready') return input.lastFilledAt === null ? 'ready' : 'filled';
	if (input.reading) return 'reading';
	const latest = finishAfter(input.activityDates);
	const eventAhead = latest === null || latest >= input.today;
	const lastWeek = input.daysLeft !== null && input.daysLeft <= LAST_WEEK_DAYS;
	return input.receiptFactsComplete && eventAhead && !lastWeek ? 'after_event' : 'to_finish';
}

export type RequestLifecycle = {
	stage: Stage;
	finishAfter: string | null;
	deadline: string | null;
	daysLeft: number | null;
};

export function requestLifecycle(
	request: {
		status: StoredStatus;
		lastFilledAt: number | null;
		reviewerNote: string | null;
		vendor: string;
		itemDescription: string;
		totalAmount: number;
		receiptFileIds: unknown[];
		receiptDate?: string;
		activity: { dates: string[] };
	},
	context: { reading: boolean; readinessReady: boolean; today: string }
): RequestLifecycle {
	const { today } = context;
	const deadline = reimbursementDeadline(request.receiptDate ?? null);
	const left = daysLeft(deadline, today);
	const sentBack = request.reviewerNote !== null;
	const stage = requestStage({
		status: effectiveStatus({
			status: request.status,
			readinessReady: context.readinessReady && !context.reading,
			sentBack
		}),
		lastFilledAt: request.lastFilledAt,
		reading: context.reading,
		receiptFactsComplete: receiptFactsComplete({
			vendor: request.vendor,
			itemDescription: request.itemDescription,
			totalAmount: request.totalAmount,
			receiptCount: request.receiptFileIds.length
		}),
		activityDates: request.activity.dates,
		daysLeft: left,
		today
	});
	return {
		stage: sentBack && stage === 'after_event' ? 'to_finish' : stage,
		finishAfter: finishAfter(request.activity.dates),
		deadline,
		daysLeft: left
	};
}
