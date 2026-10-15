export const fillProtocolHeader = 'X-Engage-Form-Protocol';
export const fillProtocolVersion = 2;
export const outdatedExtensionMessage =
	'Your Engage Form extension is out of date. Download the latest version from Engage Form, then reload it in chrome://extensions.';

export function isCurrentFillProtocol(header: string | null) {
	return header === String(fillProtocolVersion);
}
