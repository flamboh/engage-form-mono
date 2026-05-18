export const FIELDS = [
	{ label: 'Full name', value: 'Oliver Boorstein' },
	{ label: 'Email', value: 'obo@uoregon.edu' },
	{ label: 'Student Organization', value: 'Album Listening Club' },
	{ label: 'SOFS Index', value: 'OS123i' },
	{ label: 'Amount', value: '$22.98' },
	{ label: 'Category', value: 'Event Expenses' },
	{
		label: 'Business Purpose',
		value: 'Reimburse Oliver for the vinyl they purchased for the weekly event.'
	},
	{ label: 'Purchase Type', value: 'Personal Reimbursement' },
	{ label: 'Permanent Address', value: '1395 University St, Eugene, OR 97403' },
	{ label: 'Upload UO ID', value: 'Uploading oliver_id.jpg' },
	{ label: 'Upload Receipt', value: 'Uploading amazon_receipt.pdf' },
	{ label: 'Upload Event Post', value: 'Uploading weekly_event_engage.pdf' }
] as const;

export type DemoKind = 'you' | 'agent';

export const YOU_CHARACTER_MS = 55;
export const YOU_UPLOAD_MS = 900;
export const AGENT_FIELD_MS = 123;
export const YOU_FIELD_DURATIONS = FIELDS.map((field) =>
	isUploadField(field.label) ? YOU_UPLOAD_MS : field.value.length * YOU_CHARACTER_MS
);
export const AGENT_FIELD_DURATIONS = FIELDS.map(() => AGENT_FIELD_MS);
export const YOU_TOTAL_MS = sumDurations(YOU_FIELD_DURATIONS);
export const AGENT_TOTAL_MS = sumDurations(AGENT_FIELD_DURATIONS);
export const START_DELAY_MS = 3000;
export const HOLD_MS = 5000;
export const LOOP_MS = START_DELAY_MS + Math.max(YOU_TOTAL_MS, AGENT_TOTAL_MS) + HOLD_MS;
export const TICK_MS = 30;

const LABEL_HEIGHT = 16;
const LABEL_GAP = 4;
const INPUT_HEIGHT = 36;
const ROW_HEIGHT = LABEL_HEIGHT + LABEL_GAP + INPUT_HEIGHT;
const ROW_GAP = 12;
export const ROW_SLOT = ROW_HEIGHT + ROW_GAP;
const VIEW_ROWS = 4;
export const VIEW_HEIGHT = VIEW_ROWS * ROW_HEIGHT + (VIEW_ROWS - 1) * ROW_GAP;
export const SUBMIT_ROW_INDEX = FIELDS.length;
export const MAX_SCROLL_INDEX = Math.max(0, SUBMIT_ROW_INDEX + 1 - VIEW_ROWS);

export const USER_SCROLL_RESET_MS = 1000;
export const PROGRAMMATIC_SCROLL_MS = 250;

export function computeShown({
	value,
	kind,
	active,
	intra,
	fieldMs,
	filled
}: {
	value: string;
	kind: DemoKind;
	active: boolean;
	intra: number;
	fieldMs: number;
	filled: boolean;
}) {
	if (filled) return value;
	if (!active) return '';
	if (kind === 'you') {
		const progress = Math.min(1, intra / fieldMs);
		return value.slice(0, Math.round(value.length * progress));
	}
	return intra > fieldMs * 0.3 ? value : '';
}

export function isUploadField(label: string) {
	return label.startsWith('Upload ');
}

export function sumDurations(durations: number[]) {
	return durations.reduce((total, duration) => total + duration, 0);
}

export function getActiveField(elapsed: number, durations: number[]) {
	let start = 0;

	for (const [index, duration] of durations.entries()) {
		if (elapsed < start + duration) {
			return { index, intra: elapsed - start, duration };
		}
		start += duration;
	}

	return undefined;
}
