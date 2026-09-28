import { extractText, getDocumentProxy } from 'unpdf';
import { PDFDocument } from 'pdf-lib';
import type { DocumentText } from './candidates';

export type PdfText = { pageCount: number; text: DocumentText | null };

export async function pdfText(bytes: Uint8Array): Promise<PdfText> {
	const pdf = await getDocumentProxy(bytes.slice());
	const { totalPages, text } = await extractText(pdf, { mergePages: false });
	const lines = text
		.flatMap((page) => page.split('\n'))
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter((line) => line !== '');
	const letters = lines.join('').replace(/[^A-Za-z]/g, '').length;
	if (letters < 40) return { pageCount: totalPages, text: null };
	return {
		pageCount: totalPages,
		text: { source: 'text_layer', lines, hints: { vendorNames: [], itemNames: [] } }
	};
}

export async function firstPagePdf(bytes: Uint8Array) {
	const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
	const output = await PDFDocument.create();
	const [page] = await output.copyPages(source, [0]);
	output.addPage(page);
	return await output.save();
}
