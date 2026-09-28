const maxSide = 4000;
const maxBytes = 10 * 1024 * 1024 - 64 * 1024;

const extensionTypes: Record<string, string> = {
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	jfif: 'image/jpeg',
	png: 'image/png',
	pdf: 'application/pdf',
	heic: 'image/heic',
	heif: 'image/heif',
	webp: 'image/webp',
	gif: 'image/gif',
	avif: 'image/avif',
	bmp: 'image/bmp',
	tif: 'image/tiff',
	tiff: 'image/tiff'
};

export class UploadProblem extends Error {}

export function fileType(file: File) {
	if (file.type !== '') return file.type;
	const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
	return extensionTypes[extension] ?? '';
}

export function isAcceptableUpload(file: File) {
	const type = fileType(file);
	return type.startsWith('image/') || type === 'application/pdf';
}

export function previewable(type: string) {
	return ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(type);
}

export async function prepareForUpload(file: File): Promise<File> {
	const type = fileType(file);
	if (type === 'application/pdf') {
		if (file.size > 15 * 1024 * 1024) {
			throw new UploadProblem(`${file.name} is over 15 MB. Try a smaller PDF.`);
		}
		return withType(file, type);
	}
	if (!type.startsWith('image/')) {
		throw new UploadProblem(`${file.name} isn’t a photo or PDF.`);
	}
	if ((type === 'image/jpeg' || type === 'image/png') && file.size < maxBytes) {
		return withType(file, type);
	}
	return await toJpeg(file);
}

async function toJpeg(file: File) {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	} catch {
		throw new UploadProblem(
			`Couldn’t open ${file.name}. Save it as a JPEG, PNG, or PDF and try again.`
		);
	}
	try {
		let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
		for (let attempt = 0; attempt < 4; attempt += 1) {
			for (const quality of [0.9, 0.8, 0.7]) {
				const blob = await draw(bitmap, scale, quality);
				if (blob.size < maxBytes) {
					return new File([blob], jpegName(file.name), { type: 'image/jpeg' });
				}
			}
			scale *= 0.75;
		}
	} finally {
		bitmap.close();
	}
	throw new UploadProblem(`${file.name} is too large to send. Try a smaller photo.`);
}

async function draw(bitmap: ImageBitmap, scale: number, quality: number) {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	const context = canvas.getContext('2d');
	if (context === null) throw new UploadProblem('This browser can’t convert photos.');
	context.fillStyle = '#fff';
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	const blob = await new Promise<Blob | null>((resolve) =>
		canvas.toBlob(resolve, 'image/jpeg', quality)
	);
	if (blob === null) throw new UploadProblem('This browser can’t convert photos.');
	return blob;
}

function withType(file: File, type: string) {
	return file.type === type ? file : new File([file], file.name, { type });
}

function jpegName(name: string) {
	const base = name.replace(/\.[^./]+$/, '');
	return `${base || 'photo'}.jpg`;
}
