import type { Doc, Id } from './_generated/dataModel';
import { effectiveDocumentationCategories } from './purchaseCategories';
import {
	businessPurposeFactsFrom,
	generateBusinessPurpose,
	missingFactLabel,
	requiresRecipients,
	type MissingFact
} from './businessPurpose';

export type ReadinessSection = {
	section: string;
	reasons: string[];
};

export type PurchaseReadiness = {
	ready: boolean;
	sections: ReadinessSection[];
};

type DocumentExists = (id: Id<'files'>) => Promise<boolean>;
type PurchaserBelongsToOrganization = (
	purchaserId: Id<'purchasers'>,
	organizationId: Id<'organizations'> | null
) => Promise<boolean>;

export async function evaluatePurchaseReadiness(
	request: Doc<'purchaseRequests'>,
	options: {
		documentExists?: DocumentExists;
		purchaserBelongsToOrganization?: PurchaserBelongsToOrganization;
	} = {}
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
	if (await idCardMissing(request, options.documentExists)) {
		add('Purchaser', idCardReason(request));
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
			requireSectionText('Recipients', recipient.reason, 'Recipient reason missing.');
			if (recipient.value <= 0) add('Recipients', 'Recipient value missing.');
		}
	}
	if (request.totalAmount <= 0) {
		add('Purchase details', 'Total amount must be greater than zero.');
	}

	for (const fact of generateBusinessPurpose(businessPurposeFactsFrom(request)).missing) {
		if (eventFacts.includes(fact)) add('Event', `${missingFactLabel(fact)}.`);
	}

	if (request.receiptFileIds.length === 0) add('Files', 'Receipt document missing.');
	if (request.receiptFileIds.length > 3) {
		add('Files', 'Receipt documents are limited to three.');
	}
	const asuoFunds = effectiveDocumentationCategories(request).includes('asuo_funds');
	if (asuoFunds && request.publicityFileId === null) add('Files', 'Publicity proof missing.');
	const printingServices = effectiveDocumentationCategories(request).includes('printing_services');
	if (printingServices && request.printingInvoiceFileId === null) {
		add('Files', 'Printing invoice missing.');
	}
	if (request.purchaserSource.kind === 'self' && request.secondApprovalFileId === null) {
		add('Files', 'Second approval missing.');
	}

	if (
		request.purchaserSource.kind === 'purchaser' &&
		options.purchaserBelongsToOrganization !== undefined &&
		!(await options.purchaserBelongsToOrganization(
			request.purchaserSource.purchaserId,
			request.organizationSourceId
		))
	) {
		add('Purchaser', 'Purchaser profile must belong to selected student organization.');
	}

	if (options.documentExists !== undefined) {
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

export const selfIdCardReason = 'Your UO ID (front and back) missing.';
export const purchaserIdCardReason = 'Purchaser UO ID (front and back) missing.';

function idCardReason(request: Doc<'purchaseRequests'>) {
	return request.purchaserSource.kind === 'self' ? selfIdCardReason : purchaserIdCardReason;
}

async function idCardMissing(request: Doc<'purchaseRequests'>, documentExists?: DocumentExists) {
	for (const id of [request.purchaser.idCardFrontFileId, request.purchaser.idCardBackFileId]) {
		if (id === null || id.trim() === '') return true;
		if (documentExists !== undefined && !(await documentExists(id))) return true;
	}
	return false;
}

const eventFacts: MissingFact[] = ['eventName', 'dates', 'time', 'location', 'attendance'];

const checksSection = 'Document checks';

export function withBlockingChecks(
	readiness: PurchaseReadiness,
	checks: { severity: 'blocking' | 'warning'; title: string }[]
): PurchaseReadiness {
	const reasons = checks
		.filter((check) => check.severity === 'blocking')
		.map((check) => check.title);
	if (reasons.length === 0) return readiness;
	return { ready: false, sections: [...readiness.sections, { section: checksSection, reasons }] };
}

export function formatReadinessBlockers(readiness: PurchaseReadiness) {
	return [
		'Purchase request is not ready.',
		...readiness.sections.map((section) => `${section.section}: ${section.reasons.join(' ')}`)
	].join('\n');
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
