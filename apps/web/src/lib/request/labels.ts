import type { DocumentSlot } from '$convex/requestView';
import type { DocumentationCategory } from '$lib/purchase/draftDetails';

export const slotLabels: Record<DocumentSlot, string> = {
	receipt: 'Receipt',
	second_approval: 'Second Approval',
	publicity: 'Publicity Proof',
	catering_waiver: 'Catering Waiver',
	printing_invoice: 'Printing Invoice',
	building_manager_approval: 'Building Manager Approval',
	computer_price_quote: 'Computer Price Quote',
	brand_approval: 'Brand Approval',
	recipient_list: 'Recipient List'
};

export const kindLabels: Record<string, string> = {
	...slotLabels,
	id_front: 'ID Card',
	id_back: 'ID Card (back)'
};

export const slotHints: Partial<Record<DocumentSlot, string>> = {
	receipt: 'Photo or PDF of what you bought',
	second_approval: 'Another officer’s written OK',
	publicity: 'Post or flyer from a week before',
	catering_waiver: 'Signed catering waiver',
	printing_invoice: 'Invoice from the printer',
	building_manager_approval: 'Only for furniture or equipment',
	computer_price_quote: 'Only for computers',
	brand_approval: 'Only for non-verified vendors'
};

export const categoryOptions: {
	value: DocumentationCategory;
	label: string;
	hint: string;
}[] = [
	{ value: 'asuo_funds', label: 'ASUO event', hint: 'Needs Publicity Proof' },
	{ value: 'food', label: 'Food', hint: 'Needs a catering waiver' },
	{ value: 'printing_services', label: 'Printing', hint: 'Needs the printing invoice' },
	{ value: 'office_supplies_goods', label: 'Office supplies', hint: 'Needs where they’re kept' },
	{ value: 'merchandise_apparel', label: 'Merch or apparel', hint: 'Needs recipients' },
	{ value: 'gifts_prizes', label: 'Gifts or prizes', hint: 'Needs recipients' }
];

export function formatMoney(value: number | null | undefined) {
	if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return '';
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function formatDate(value: string) {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const [year, month, day] = value.split('-').map(Number);
	const date = new Date(year, month - 1, day);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}).format(date);
}

export function reviewDisplay(
	field: 'vendor' | 'totalAmount' | 'receiptDate' | 'itemDescription',
	value: string
) {
	if (field === 'totalAmount') return formatMoney(Number(value.replace(/[$,\s]/g, ''))) || value;
	if (field === 'receiptDate') return formatDate(value);
	return value;
}

export function dateInputValue(value: string | null | undefined) {
	return value !== null && value !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}
