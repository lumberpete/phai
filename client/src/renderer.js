const button = document.querySelector('[data-role="trigger"]');
const webview = document.querySelector('[data-role="webview"]');

const encoder = new TextEncoder();

button.addEventListener('click', async (e) => {
	if (!webview) return;

	let keepGoing = true;
	let previousBackgrounds = [];

	while (keepGoing) {
		const backgrounds = await webview.executeJavaScript(`
			(()=>{
				let backgrounds = [];
				document.querySelectorAll('a[href*="/photo/"] > div').forEach(element => {
					const style = element.getAttribute('style');
					const thumb = (style && (style.match(/background-image:\\s*url\\(["']?([^"')]+)["']?\\)/) || [null])).pop();
					if (style && thumb) {
						backgrounds.push(thumb);
					}
				});
				return backgrounds;
			})();
		`);

		// Check if we have new backgrounds
		const newBackgrounds = backgrounds.filter(bg => !previousBackgrounds.includes(bg));

		if (newBackgrounds.length > 0) {
			await window.processAndDownloadImagesInRenderer(newBackgrounds);
			previousBackgrounds = [...backgrounds];
		}

		// Send PageDown and wait
		webview.sendInputEvent({ type: 'keyDown', keyCode: 'PageDown' });
		webview.sendInputEvent({ type: 'keyUp', keyCode: 'PageDown' });
		await new Promise(res => setTimeout(res, 1200));

		// Stop if no new backgrounds found AND scroll position didn't change
		if (newBackgrounds.length === 0) {
			console.log('No new content found, stopping...');
			keepGoing = false;
		}
	}
});

async function generateHashFromString(str) {
	const data = encoder.encode(str);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function processAndDownloadImagesInRenderer(backgrounds) {
	const imagesDir = await window.electronAPI.getImagesDir();
	const promises = [];

	if (backgrounds && typeof backgrounds[0] !== "undefined") {
		for (const thumb of backgrounds) {
			const originalName = new URL(thumb).pathname.split('/').pop();
			const fileName = await generateHashFromString(originalName);
			const filePath = `${imagesDir}/${fileName}`;

			const promise = (async () => {
				try {
					const buffer = await loadImageInWebview(thumb);
					await window.electronAPI.saveImageFile(filePath, buffer);
				} catch (error) {
					console.error('Image processing error:', error);
				}
			})();
			promises.push(promise);
		}
	}

	return Promise.all(promises);
}

window.processAndDownloadImagesInRenderer = processAndDownloadImagesInRenderer;

async function loadImageInWebview(url) {
	try {
		const result = await window.electronAPI.downloadImageWithSession(url);
		return new Uint8Array(result);
	} catch (error) {
		console.error('Image load error:', error);
		throw error;
	}
}