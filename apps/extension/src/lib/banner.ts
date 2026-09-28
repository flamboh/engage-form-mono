export type BannerAction = { label: string; href: string } | { label: string; onClick: () => void };

export type BannerOptions = {
	text: string;
	tone?: 'working' | 'done' | 'error';
	actions?: BannerAction[];
	hideAfterMs?: number;
};

const bannerId = 'engage-form-banner';
let hideTimer: number | undefined;

export function showBanner(options: BannerOptions) {
	hideBanner();

	const banner = document.createElement('div');
	banner.id = bannerId;
	banner.setAttribute('role', 'status');
	banner.style.cssText = [
		'position: fixed',
		'top: 14px',
		'right: 14px',
		'z-index: 2147483647',
		'display: flex',
		'align-items: center',
		'gap: 10px',
		'max-width: 380px',
		'padding: 8px 12px',
		'border: 1px solid #d6d3d1',
		`border-left: 3px solid ${toneColor(options.tone ?? 'working')}`,
		'border-radius: 8px',
		'background: #fffefa',
		'color: #1c1917',
		'font: 13px/1.4 system-ui, sans-serif',
		'box-shadow: 0 8px 24px rgb(33 30 24 / 14%)'
	].join(';');

	const text = document.createElement('span');
	text.textContent = options.text;
	banner.append(text);

	for (const action of options.actions ?? []) {
		banner.append(actionElement(action));
	}

	document.body.append(banner);
	if (options.hideAfterMs !== undefined) {
		hideTimer = window.setTimeout(hideBanner, options.hideAfterMs);
	}
}

export function hideBanner() {
	window.clearTimeout(hideTimer);
	document.getElementById(bannerId)?.remove();
}

function actionElement(action: BannerAction) {
	const element = document.createElement('href' in action ? 'a' : 'button');
	element.textContent = action.label;
	element.style.cssText = [
		'flex: none',
		'padding: 0',
		'border: 0',
		'background: none',
		'color: #1c1917',
		'font: inherit',
		'font-weight: 600',
		'text-decoration: underline',
		'cursor: pointer'
	].join(';');

	if ('href' in action && element instanceof HTMLAnchorElement) {
		element.href = action.href;
		element.target = '_blank';
		element.rel = 'noreferrer';
	} else if ('onClick' in action && element instanceof HTMLButtonElement) {
		element.type = 'button';
		element.addEventListener('click', action.onClick);
	}

	return element;
}

function toneColor(tone: NonNullable<BannerOptions['tone']>) {
	if (tone === 'done') return '#15803d';
	if (tone === 'error') return '#b91c1c';
	return '#1c1917';
}
