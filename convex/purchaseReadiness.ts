import type { Doc, Id } from './_generated/dataModel';
import { effectiveDocumentationCategories } from './purchaseCategories';

export type ReadinessSection = {
	section: string;
	reasons: string[];
};

export type PurchaseReadiness = {
	ready: boolean;
	sections: ReadinessSection[];
};

type DocumentExists = (id: Id<'files'>) => Promise<boolean>;

export async function evaluatePurchaseReadiness(
	request: Doc<'purchaseRequests'>,
	options: { documentExists?: DocumentExists } = {}
): Promise<PurchaseReadiness> {
	const sections: ReadinessSection[] = [];
	const add = (section: string, reason: string) => {
		let group = sections.find((item) => item.section === section);
		if (group === undefined) {
			group = { section, reasons: [] };
			sections.push(group);
		}
		group.reasons.push(reason);
	};
	const requireSectionText = (section: string, value: string, message: string) => {
		if (value.trim() === '') add(section, message);
	};

	if (request.typeOfPurchase !== 'personal_reimbursement') {
		add('Type of Purchase', 'Type of Purchase is not supported yet.');
	}

	requireSectionText(
		'Student organization',
		request.studentOrganization.name,
		'Student organization name missing.'
	);
	requireSectionText(
		'Student organization',
		request.studentOrganization.indexNumber,
		'Index number missing.'
	);
	if (request.studentOrganization.budgetLines.length === 0) {
		add('Student organization', 'Budget line missing.');
	}

	requireSectionText('Requester', request.requester.name, 'Requester name missing.');
	requireSectionText('Requester', request.requester.email, 'Requester email missing.');
	requireSectionText('Requester', request.requester.phone, 'Requester phone missing.');

	requireSectionText('Purchaser', request.purchaser.name, 'Purchaser name missing.');
	requireSectionText('Purchaser', request.purchaser.uo95, 'Purchaser UO 95 missing.');
	requireSectionText('Purchaser', request.purchaser.permanentAddress, 'Purchaser address missing.');
	requireSectionText(
		'Purchaser',
		request.purchaser.idCardFrontFileId,
		'ID card front document missing.'
	);
	requireSectionText(
		'Purchaser',
		request.purchaser.idCardBackFileId,
		'ID card back document missing.'
	);

	requireSectionText('Event details', request.eventName, 'Event name missing.');
	requireSectionText('Event details', request.eventDate, 'Event date missing.');
	requireSectionText('Event details', request.eventTime, 'Event time missing.');
	requireSectionText('Event details', request.eventLocation, 'Event location missing.');
	if (request.eventEstimatedAttendance <= 0) {
		add('Event details', 'Estimated attendance missing.');
	}

	requireSectionText('Purchase details', request.vendor, 'Vendor missing.');
	requireSectionText('Purchase details', request.itemDescription, 'Item description missing.');
	requireSectionText('Purchase details', request.budgetLineItem, 'Budget line item missing.');
	requireSectionText(
		'Purchase details',
		request.reimbursementReason,
		'Reimbursement reason missing.'
	);
	const officeSuppliesGoods =
		effectiveDocumentationCategories(request).includes('office_supplies_goods');
	if (officeSuppliesGoods) {
		requireSectionText('Purchase details', request.officeLocation, 'Office location missing.');
	}
	const categories = effectiveDocumentationCategories(request);
	if (requiresRecipients(categories)) {
		if (request.recipients.length === 0) add('Recipients', 'Recipient missing.');
		for (const recipient of request.recipients) {
			requireSectionText('Recipients', recipient.name, 'Recipient name missing.');
			requireSectionText('Recipients', recipient.uo95, 'Recipient UO 95 missing.');
			if (recipient.value <= 0) add('Recipients', 'Recipient value missing.');
		}
	}
	if (request.totalAmount <= 0) {
		add('Purchase details', 'Total amount must be greater than zero.');
	}

	requireSectionText('Business purpose', request.businessPurposeText, 'Business purpose missing.');
	if (unresolvedToken(request.businessPurposeText)) {
		add('Business purpose', 'Business purpose has unresolved variables.');
	}

	if (request.receiptFileIds.length === 0) add('Files', 'Receipt document missing.');
	if (request.receiptFileIds.length > 3) {
		add('Files', 'Receipt documents are limited to three.');
	}
	const asuoFunds = effectiveDocumentationCategories(request).includes('asuo_funds');
	if (asuoFunds && request.publicityFileId === null) add('Files', 'Publicity proof missing.');
	const food = effectiveDocumentationCategories(request).includes('food');
	if (food && request.cateringWaiverFileId === null) add('Files', 'Catering waiver missing.');
	const printingServices = effectiveDocumentationCategories(request).includes('printing_services');
	if (printingServices && request.printingInvoiceFileId === null) {
		add('Files', 'Printing invoice missing.');
	}
	if (request.purchaserSource.kind === 'self' && request.secondApprovalFileId === null) {
		add('Files', 'Second approval missing.');
	}

	if (options.documentExists !== undefined) {
		await requireOwnedDocument(
			add,
			options.documentExists,
			request.purchaser.idCardFrontFileId,
			'Purchaser',
			'ID card front document missing.'
		);
		await requireOwnedDocument(
			add,
			options.documentExists,
			request.purchaser.idCardBackFileId,
			'Purchaser',
			'ID card back document missing.'
		);
		if (request.receiptFileIds.length > 0) {
			for (const id of request.receiptFileIds) {
				await requireOwnedDocument(
					add,
					options.documentExists,
					id,
					'Files',
					'Receipt document missing.'
				);
			}
		}
		if (asuoFunds && request.publicityFileId !== null) {
			await requireOwnedDocument(
				add,
				options.documentExists,
				request.publicityFileId,
				'Files',
				'Publicity proof missing.'
			);
		}
		if (food && request.cateringWaiverFileId !== null) {
			await requireOwnedDocument(
				add,
				options.documentExists,
				request.cateringWaiverFileId,
				'Files',
				'Catering waiver missing.'
			);
		}
		if (printingServices && request.printingInvoiceFileId !== null) {
			await requireOwnedDocument(
				add,
				options.documentExists,
				request.printingInvoiceFileId,
				'Files',
				'Printing invoice missing.'
			);
		}
		if (request.purchaserSource.kind === 'self' && request.secondApprovalFileId !== null) {
			await requireOwnedDocument(
				add,
				options.documentExists,
				request.secondApprovalFileId,
				'Files',
				'Second approval missing.'
			);
		}
	}

	return { ready: sections.length === 0, sections };
}

export function formatReadinessBlockers(readiness: PurchaseReadiness) {
	return [
		'Purchase request is not ready.',
		...readiness.sections.map((section) => `${section.section}: ${section.reasons.join(' ')}`)
	].join('\n');
}

export function unresolvedToken(value: string) {
	return /\{[A-Za-z][A-Za-z0-9]*\}/.test(value);
}

async function requireOwnedDocument(
	add: (section: string, reason: string) => void,
	documentExists: DocumentExists,
	id: Id<'files'>,
	section: string,
	reason: string
) {
	if (id.trim() === '') return;
	if (!(await documentExists(id))) add(section, reason);
}

function requiresRecipients(categories: string[]) {
	return categories.includes('merchandise_apparel') || categories.includes('gifts_prizes');
}
