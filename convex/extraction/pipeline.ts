import type { DocumentText } from './candidates';
import {
	askJev,
	buildDecisionRequest,
	buildDocumentRequest,
	parseDecisionResponse,
	parseDocumentResponse,
	type DecisionContext
} from './jev';
import { firstPagePdf, pdfText } from './pdf';
import { analyzeExpense, textractDocumentText, type AwsCredentials } from './textract';

export type ExtractionEnv = {
	jevKey: string;
	aws: AwsCredentials;
	fetcher?: typeof fetch;
};

export class UnreadableDocumentError extends Error {}

const textractTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/tiff']);

export async function readDocumentText(
	bytes: Uint8Array,
	contentType: string,
	env: Pick<ExtractionEnv, 'aws' | 'fetcher'>
): Promise<DocumentText> {
	const type = contentType.toLowerCase();
	if (type === 'application/pdf' || isPdf(bytes)) {
		const pdf = await pdfText(bytes);
		if (pdf.text !== null) return pdf.text;
		const single = pdf.pageCount === 1 ? bytes : await firstPagePdf(bytes);
		return textractDocumentText([await analyzeExpense(single, env.aws, env.fetcher)]);
	}
	if (textractTypes.has(type) || isImage(bytes)) {
		return textractDocumentText([await analyzeExpense(bytes, env.aws, env.fetcher)]);
	}
	throw new UnreadableDocumentError(`Unsupported document type ${contentType}.`);
}

export async function extractDocument(
	text: DocumentText,
	env: Pick<ExtractionEnv, 'jevKey' | 'fetcher'>
) {
	const plan = buildDocumentRequest(text);
	const response = await askJev(plan.request, env.jevKey, env.fetcher);
	return parseDocumentResponse(plan, text, response);
}

export async function decideDefaults(
	context: DecisionContext,
	env: Pick<ExtractionEnv, 'jevKey' | 'fetcher'>
) {
	const response = await askJev(buildDecisionRequest(context), env.jevKey, env.fetcher);
	return parseDecisionResponse(context, response);
}

function isPdf(bytes: Uint8Array) {
	return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

function isImage(bytes: Uint8Array) {
	const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
	const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	return jpeg || png;
}
