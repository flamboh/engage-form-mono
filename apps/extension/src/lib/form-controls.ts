import { choiceMatches } from '@engage-form/fill-engine';

export type ControlResult = { ok: true } | { ok: false; message: string };

export type ChoiceTarget = {
	labelIncludes: string;
	keywords?: string[];
};

const maxListedLabels = 8;
const maxLabelLength = 70;
const maxChoiceContainerText = 600;

export function setField(
	labelIncludes: string,
	alternatives: string[],
	value: string,
	selector: 'input' | 'textarea'
): ControlResult {
	const control = [labelIncludes, ...alternatives]
		.map((label) => findControl(label, selector))
		.find((found) => found !== null);
	if (control === undefined) {
		return {
			ok: false,
			message: missMessage(`${selector}:${labelIncludes}`, visibleFieldLabels())
		};
	}

	control.value = value;
	dispatchInput(control);
	return { ok: true };
}

export function setChoice(
	target: ChoiceTarget,
	type: 'checkbox' | 'radio',
	checked: boolean
): ControlResult {
	const choices = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${type}"]`));
	const resolved = resolveChoice(
		choices.map((choice) => choiceLabel(choice, type)),
		target,
		type,
		checked
	);
	if (resolved.type !== 'found') return resolved.result;

	const input = choices[resolved.index];
	if (input.checked !== checked) input.click();
	dispatchInput(input);

	return { ok: true };
}

export function resolveChoice(
	labels: string[],
	target: ChoiceTarget,
	type: 'checkbox' | 'radio',
	checked: boolean
): { type: 'found'; index: number } | { type: 'absent'; result: ControlResult } {
	const index = pickChoice(labels, target);
	if (index !== null) return { type: 'found', index };
	if (type === 'checkbox' && !checked) return { type: 'absent', result: { ok: true } };
	return {
		type: 'absent',
		result: { ok: false, message: missMessage(`${type}:${target.labelIncludes}`, labels) }
	};
}

export function pickChoice(labels: string[], target: ChoiceTarget) {
	const index = labels.findIndex((label) => choiceMatches(label, target));
	return index === -1 ? null : index;
}

export function missMessage(what: string, labels: string[]) {
	const listed = [
		...new Set(labels.map((label) => label.replace(/\s+/g, ' ').trim()).filter(Boolean))
	]
		.slice(0, maxListedLabels)
		.map((label) =>
			label.length > maxLabelLength ? `“${label.slice(0, maxLabelLength - 1)}…”` : `“${label}”`
		);
	if (listed.length === 0) return `${what} (no labels found on this page)`;
	return `${what} (this page has: ${listed.join(', ')})`;
}

export function setSelect(labelIncludes: string, valueIncludes: string) {
	const select = findControl(labelIncludes, 'select');
	if (select === null) return false;

	const option = Array.from(select.options).find((item) =>
		includes(item.textContent, valueIncludes)
	);
	if (option === undefined) return false;

	select.value = option.value;
	dispatchInput(select);
	return true;
}

export async function setComboBox(labelIncludes: string, valueIncludes: string) {
	const comboBox = findComboBox(labelIncludes);
	if (comboBox === null) return false;

	if (
		includes(comboBox.textContent, valueIncludes) ||
		includes(accessibleText(comboBox), valueIncludes)
	) {
		return true;
	}

	clickElement(comboBox);
	await waitForDom();

	const option = findComboBoxOption(valueIncludes);
	if (option === null) return false;

	clickElement(option);
	await waitForDom();
	return true;
}

export async function setFiles<File extends { filename: string; contentType: string }>(
	labelIncludes: string,
	files: File[],
	uploadFiles: (selector: string, files: File[], dropSelector: string) => Promise<FileUploadResult>
) {
	const uploadButton = findUploadButton(labelIncludes);
	if (uploadButton === null) return uploadMiss(`Upload button missing for "${labelIncludes}".`);

	clickElement(uploadButton);
	await waitForDom();

	const input = findActiveFileInput(uploadButton);
	if (input === null) return uploadMiss(`File input missing for "${labelIncludes}".`);

	const uploadId = crypto.randomUUID();
	const selector = `[data-engage-form-upload="${uploadId}"]`;
	const dropId = crypto.randomUUID();
	const dropSelector = `[data-engage-form-drop="${dropId}"]`;
	const dialog = findUploadDialog(input);
	const dropTarget = findDropTarget(input, dialog, uploadButton);
	input.dataset.engageFormUpload = uploadId;
	dropTarget.dataset.engageFormDrop = dropId;

	const uploadResult = await uploadFiles(selector, files, dropSelector);
	if (!uploadResult.ok) return uploadResult;
	if (!(await waitForFileSelection(input, files.length))) {
		return uploadMiss(
			`Files assigned but Engage did not keep ${files.length} file(s) for "${labelIncludes}".`
		);
	}
	await waitForDom();

	const okButton = findModalButton(input, 'OK');
	if (okButton === null) return uploadDone(await waitForUploadDialogDone(dialog), labelIncludes);

	clickElement(okButton);
	return uploadDone(await waitForUploadDialogDone(dialog), labelIncludes);
}

export type FileUploadResult = ControlResult;

export function clickNextStep() {
	const button = findNavigationButton();
	if (button === null) return false;

	clickElement(button);
	return true;
}

function findControl<T extends 'input' | 'textarea' | 'select'>(
	labelIncludes: string,
	selector: T
) {
	const direct = Array.from(document.querySelectorAll<ControlElement<T>>(selector)).find(
		(control) => includes(accessibleText(control), labelIncludes)
	);

	if (direct !== undefined) return direct;

	const labelNode = findTextContainer(labelIncludes);
	if (labelNode === null) return null;

	return nextControl(labelNode, selector);
}

function findComboBox(labelIncludes: string) {
	const direct = Array.from(
		document.querySelectorAll<HTMLElement>('[role="combobox"], [aria-haspopup="listbox"]')
	).find((control) => includes(accessibleText(control), labelIncludes));

	if (direct !== undefined) return direct;

	const labelNode = findTextContainer(labelIncludes);
	if (labelNode === null) return null;

	return nextElement(labelNode, '[role="combobox"], [aria-haspopup="listbox"]');
}

function findComboBoxOption(valueIncludes: string) {
	const semanticOption = Array.from(
		document.querySelectorAll<HTMLElement>(
			'[role="option"], [role="listbox"] li, [role="listbox"] div'
		)
	).find((option) => isVisible(option) && includes(option.textContent, valueIncludes));

	if (semanticOption !== undefined) return semanticOption;

	return (
		Array.from(document.querySelectorAll<HTMLElement>('li, button, div, span'))
			.filter(isVisible)
			.sort((a, b) => nodeDepth(b) - nodeDepth(a))
			.find((option) => includes(option.textContent, valueIncludes)) ?? null
	);
}

function choiceLabel(choice: HTMLInputElement, type: 'checkbox' | 'radio') {
	const labelledBy = (choice.getAttribute('aria-labelledby') ?? '')
		.split(/\s+/)
		.map((id) => (id === '' ? '' : (document.getElementById(id)?.textContent ?? '')));
	const labels = Array.from(choice.labels ?? []).map((label) => label.textContent ?? '');
	return [
		choice.getAttribute('aria-label') ?? '',
		...labels,
		...labelledBy,
		choiceContainer(choice, type)?.textContent ?? ''
	]
		.map((text) => text.replace(/\s+/g, ' ').trim())
		.filter((text, index, all) => text !== '' && all.indexOf(text) === index)
		.join(' ');
}

function choiceContainer(choice: HTMLInputElement, type: 'checkbox' | 'radio') {
	let container: HTMLElement | null = null;
	let parent = choice.parentElement;
	while (
		parent !== null &&
		parent !== document.body &&
		parent.querySelectorAll(`input[type="${type}"]`).length === 1 &&
		(parent.textContent ?? '').length <= maxChoiceContainerText
	) {
		container = parent;
		parent = parent.parentElement;
	}
	return container;
}

function visibleFieldLabels() {
	return Array.from(document.querySelectorAll<HTMLElement>('label, legend, [role="heading"]'))
		.filter(isVisible)
		.map((label) => label.textContent ?? '');
}

function findUploadButton(labelIncludes: string) {
	const labelNode = findTextContainer(labelIncludes);
	const buttons = findClickableElements('Upload File');

	if (labelNode === null) return buttons[0] ?? null;

	const owningButton = labelNode.closest<HTMLElement>(
		'button, [role="button"], input[type="button"], a'
	);
	if (owningButton !== null && buttons.includes(owningButton)) return owningButton;

	return (
		findClickableElementsIn(labelNode, 'Upload File')[0] ??
		buttons.find((button) => follows(labelNode, button)) ??
		null
	);
}

function findActiveFileInput(uploadButton: HTMLElement) {
	const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="file"]'));
	const dialogInputs = inputs.filter((input) => findUploadDialog(input) !== null);

	return (
		dialogInputs.at(-1) ??
		inputs.find((input) => follows(uploadButton, input)) ??
		inputs.at(-1) ??
		null
	);
}

function findDropTarget(
	input: HTMLInputElement,
	dialog: HTMLElement | null,
	uploadButton: HTMLElement
) {
	return (
		input.closest<HTMLElement>('[data-testid*="upload"], [class*="upload"], [class*="drop"]') ??
		dialog ??
		uploadButton
	);
}

function findModalButton(input: HTMLInputElement, label: string) {
	const dialog = findUploadDialog(input);
	if (dialog !== null) {
		return findClickableElementsIn(dialog, label)[0] ?? null;
	}

	return findClickableElements(label).find(isVisible) ?? null;
}

function findUploadDialog(input: HTMLInputElement) {
	let element = input.parentElement;

	while (element !== null) {
		if (
			isVisible(element) &&
			includes(element.textContent, 'Upload File') &&
			findClickableElementsIn(element, 'CANCEL').length > 0
		) {
			return element;
		}

		element = element.parentElement;
	}

	return input.closest<HTMLElement>('[role="dialog"], .modal, [aria-modal="true"]');
}

function findNavigationButton() {
	const buttons = ['Save and Continue', 'Continue', 'Next']
		.flatMap((label) => findClickableElements(label))
		.filter((button) => !includes(elementText(button), 'submit'));

	return buttons.at(-1) ?? null;
}

function findClickableElements(labelIncludes: string) {
	return Array.from(
		document.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"], a')
	).filter((element) => isVisible(element) && includes(elementText(element), labelIncludes));
}

function accessibleText(element: Element) {
	return [
		element.getAttribute('aria-label'),
		element.getAttribute('title'),
		element.getAttribute('placeholder'),
		element.getAttribute('name'),
		element.getAttribute('id'),
		element.getAttribute('description')
	]
		.filter((value) => value !== null)
		.join(' ');
}

function elementText(element: Element) {
	return `${element.textContent ?? ''} ${accessibleText(element)} ${inputValue(element)}`;
}

function inputValue(element: Element) {
	return element instanceof HTMLInputElement ? element.value : '';
}

function findTextContainer(labelIncludes: string) {
	const nodes = Array.from(document.querySelectorAll<HTMLElement>('label, div, p, span, strong'));
	return (
		nodes
			.filter((node) => isVisible(node) && includes(node.textContent, labelIncludes))
			.sort((a, b) => elementScore(a) - elementScore(b))[0] ?? null
	);
}

function findClickableElementsIn(root: Element, labelIncludes: string) {
	return Array.from(
		root.querySelectorAll<HTMLElement>('button, [role="button"], input[type="button"], a')
	).filter((element) => isVisible(element) && includes(elementText(element), labelIncludes));
}

function nextControl<T extends 'input' | 'textarea' | 'select'>(
	start: Element,
	selector: T,
	predicate?: (control: ControlElement<T>) => boolean
) {
	const controls = Array.from(document.querySelectorAll<ControlElement<T>>(selector));
	const startRect = start.getBoundingClientRect();
	return (
		controls.find(
			(control) =>
				control.getBoundingClientRect().top >= startRect.top && (predicate?.(control) ?? true)
		) ?? null
	);
}

function nextElement(start: Element, selector: string) {
	const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
	const startRect = start.getBoundingClientRect();
	return elements.find((element) => element.getBoundingClientRect().top >= startRect.top) ?? null;
}

function follows(start: Element, element: Element) {
	return (start.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function dispatchInput(control: HTMLElement) {
	control.dispatchEvent(new Event('input', { bubbles: true }));
	control.dispatchEvent(new Event('change', { bubbles: true }));
}

function clickElement(element: HTMLElement) {
	element.scrollIntoView({ block: 'center', inline: 'center' });
	element.focus();
	if (typeof PointerEvent !== 'undefined') {
		element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
	}
	element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
	if (typeof PointerEvent !== 'undefined') {
		element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
	}
	element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
	element.click();
}

function includes(value: string | null, search: string) {
	return normalize(value ?? '').includes(normalize(search));
}

function normalize(value: string) {
	return value
		.toLowerCase()
		.replace(/\s*:\s*/g, ':')
		.replace(/\s+/g, ' ')
		.trim();
}

function waitForDom() {
	return new Promise<void>((resolve) => {
		window.setTimeout(resolve, 250);
	});
}

async function waitForUploadDialogDone(dialog: HTMLElement | null) {
	for (let attempt = 0; attempt < 40; attempt += 1) {
		await waitForDom();
		if (dialog === null || !document.contains(dialog) || !isVisible(dialog)) return true;
	}

	return false;
}

async function waitForFileSelection(input: HTMLInputElement, fileCount: number) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		if (input.files?.length === fileCount) return true;
		await waitForDom();
	}

	return false;
}

function uploadDone(done: boolean, labelIncludes: string): FileUploadResult {
	if (done) return { ok: true };
	return uploadMiss(`Upload dialog did not close for "${labelIncludes}".`);
}

export function uploadMiss(message: string): FileUploadResult {
	return { ok: false, message };
}

function isVisible(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return rect.width > 0 && rect.height > 0;
}

function elementScore(element: HTMLElement) {
	const rect = element.getBoundingClientRect();
	return rect.height * rect.width - nodeDepth(element);
}

function nodeDepth(element: Element) {
	let depth = 0;
	let current: Element | null = element;
	while (current !== null) {
		depth += 1;
		current = current.parentElement;
	}
	return depth;
}

type ControlElement<T extends 'input' | 'textarea' | 'select'> = T extends 'input'
	? HTMLInputElement
	: T extends 'textarea'
		? HTMLTextAreaElement
		: HTMLSelectElement;
