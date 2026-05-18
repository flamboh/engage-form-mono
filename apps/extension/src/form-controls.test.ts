import { expect, test } from 'vitest';
import { setFiles } from './form-controls.ts';

test('uploads through hidden file inputs and tagged drop targets', async () => {
	const dom = installFakeDom();
	const uploadButton = fakeElement('button', 'Upload File', 2, { visible: true });
	const fileInput = fakeElement('input', '', 3, { visible: false });
	const dropTarget = fakeElement('div', '', 4, { visible: true });
	const label = fakeElement('div', 'UO ID CARD', 1, { visible: true });

	fileInput.closestElement = dropTarget;
	dom.elements = [label, uploadButton, fileInput, dropTarget];

	const result = await setFiles(
		'UO ID CARD',
		[{ filename: 'id.jpg', contentType: 'image/jpeg', storageKey: 'sample/id.jpg' }],
		async (selector, _files, dropSelector) => {
			expect(selector).toContain('data-engage-form-upload');
			expect(dropSelector).toContain('data-engage-form-drop');
			expect(fileInput.dataset.engageFormUpload).toBeTruthy();
			expect(dropTarget.dataset.engageFormDrop).toBeTruthy();
			fileInput.files = { length: 1 };
			return { ok: true };
		}
	);

	expect(result).toEqual({ ok: true });
	expect(uploadButton.clicked).toBe(true);
});

test('returns a clear upload message when Engage exposes no file input', async () => {
	const dom = installFakeDom();
	dom.elements = [
		fakeElement('div', 'UO ID CARD', 1, { visible: true }),
		fakeElement('button', 'Upload File', 2, { visible: true })
	];

	const result = await setFiles(
		'UO ID CARD',
		[{ filename: 'id.jpg', contentType: 'image/jpeg', storageKey: 'sample/id.jpg' }],
		async () => ({ ok: true })
	);

	expect(result).toEqual({ ok: false, message: 'File input missing for "UO ID CARD".' });
});

test('distinguishes the optional second ID upload label', async () => {
	const dom = installFakeDom();
	const firstUploadButton = fakeElement('button', 'Upload File', 2, { visible: true });
	const optionalLabel = fakeElement('div', 'UO ID CARD: Optional second upload if needed.', 3, {
		visible: true
	});
	const secondUploadButton = fakeElement('button', 'Upload File', 4, { visible: true });
	const fileInput = fakeElement('input', '', 5, { visible: false });

	dom.elements = [
		fakeElement('div', 'UO ID CARD', 1, { visible: true }),
		firstUploadButton,
		optionalLabel,
		secondUploadButton,
		fileInput
	];

	const result = await setFiles(
		'UO ID CARD : Optional second upload',
		[{ filename: 'id-back.jpg', contentType: 'image/jpeg', storageKey: 'sample/id-back.jpg' }],
		async () => {
			fileInput.files = { length: 1 };
			return { ok: true };
		}
	);

	expect(result).toEqual({ ok: true });
	expect(firstUploadButton.clicked).toBe(false);
	expect(secondUploadButton.clicked).toBe(true);
});

test('distinguishes optional receipt upload labels', async () => {
	const dom = installFakeDom();
	const firstUploadButton = fakeElement('button', 'Upload File', 2, { visible: true });
	const optionalLabel = fakeElement('div', 'RECEIPT: Optional second upload if needed.', 3, {
		visible: true
	});
	const secondUploadButton = fakeElement('button', 'Upload File', 4, { visible: true });
	const fileInput = fakeElement('input', '', 5, { visible: false });

	dom.elements = [
		fakeElement('div', 'Please upload a photo of your itemized receipt.', 1, { visible: true }),
		firstUploadButton,
		optionalLabel,
		secondUploadButton,
		fileInput
	];

	const result = await setFiles(
		'RECEIPT : Optional second upload',
		[{ filename: 'receipt-2.jpg', contentType: 'image/jpeg', storageKey: 'sample/receipt-2.jpg' }],
		async () => {
			fileInput.files = { length: 1 };
			return { ok: true };
		}
	);

	expect(result).toEqual({ ok: true });
	expect(firstUploadButton.clicked).toBe(false);
	expect(secondUploadButton.clicked).toBe(true);
});

function installFakeDom() {
	const dom = {
		elements: [] as FakeElement[],
		contains() {
			return false;
		},
		querySelectorAll(selector: string) {
			return this.elements.filter((element) => matchesSelector(element, selector));
		}
	};

	globalThis.document = dom as unknown as Document;
	globalThis.HTMLInputElement = FakeElement as unknown as typeof HTMLInputElement;
	globalThis.MouseEvent = FakeEvent as unknown as typeof MouseEvent;
	globalThis.Node = FakeNode as unknown as typeof Node;
	globalThis.window = {
		setTimeout(callback: TimerHandler) {
			if (typeof callback === 'function') callback();
			return 0;
		}
	} as Window & typeof globalThis;

	return dom;
}

function fakeElement(
	tagName: 'button' | 'div' | 'input',
	textContent: string,
	order: number,
	options: { visible: boolean }
) {
	return new FakeElement(tagName, textContent, order, options.visible);
}

function matchesSelector(element: FakeElement, selector: string) {
	if (selector === 'input[type="file"]') return element.tagName === 'input';
	if (selector === 'label, div, p, span, strong') return element.tagName === 'div';
	if (selector === 'button, [role="button"], input[type="button"], a') {
		return element.tagName === 'button';
	}
	return false;
}

class FakeElement {
	closestElement: FakeElement | null = null;
	clicked = false;
	dataset: Record<string, string> = {};
	files: { length: number } | null = null;
	parentElement: FakeElement | null = null;
	readonly order: number;
	readonly tagName: 'button' | 'div' | 'input';
	readonly textContent: string;
	readonly visible: boolean;

	constructor(
		tagName: 'button' | 'div' | 'input',
		textContent: string,
		order: number,
		visible: boolean
	) {
		this.order = order;
		this.tagName = tagName;
		this.textContent = textContent;
		this.visible = visible;
	}

	click() {
		this.clicked = true;
	}

	closest(selector: string) {
		if (selector.includes('upload') || selector.includes('drop')) return this.closestElement;
		return null;
	}

	compareDocumentPosition(element: FakeElement) {
		return element.order > this.order ? Node.DOCUMENT_POSITION_FOLLOWING : 0;
	}

	dispatchEvent() {
		return true;
	}

	focus() {}

	getAttribute() {
		return null;
	}

	getBoundingClientRect() {
		return {
			height: this.visible ? 20 : 0,
			top: this.order * 20,
			width: this.visible ? 120 : 0
		};
	}

	querySelectorAll() {
		return [];
	}

	scrollIntoView() {}
}

class FakeEvent {}

class FakeNode {
	static DOCUMENT_POSITION_FOLLOWING = 4;
}
