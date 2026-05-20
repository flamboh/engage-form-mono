import type { Doc } from './_generated/dataModel';

export function effectiveDocumentationCategories(request: Doc<'purchaseRequests'>) {
	const categories = new Set(request.documentationCategories);
	if (request.studentOrganization.fundLetter === 'I') categories.add('asuo_funds');
	return [...categories];
}
