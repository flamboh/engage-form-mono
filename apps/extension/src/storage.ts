import type { PurchaseRequest } from '@engage-form/domain';

export function readyPurchaseRequestSummary(purchaseRequest: PurchaseRequest) {
	const [recipient] = purchaseRequest.recipients;
	return {
		title: purchaseRequest.itemDescription,
		org: purchaseRequest.organization.name,
		amount: `$${purchaseRequest.totalAmount.toFixed(2)}`,
		event: `${purchaseRequest.eventDetails.date}, ${purchaseRequest.eventDetails.time}`,
		recipient: recipient?.name ?? 'No recipient'
	};
}
