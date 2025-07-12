const button = document.querySelector('[data-role="trigger"]');
const webview = document.querySelector('[data-role="webview"]');
const maxPhotosInput = document.querySelector('#max-photos');

const encoder = new TextEncoder();

const phaiObjectName = 'phai_' + Math.random().toString(36).substring(2, 11);

button.addEventListener('click', async (e) => {
	if (!webview) return;

	// Initialize global phai object in the webview window scope
	await webview.executeJavaScript(`
		(()=>{
			if (!window.${phaiObjectName}) {
				window.${phaiObjectName} = {
					initialized: true,
					timestamp: Date.now(),
					version: '1.0.0'
				};
				console.log('Initialized global phai object:', window.${phaiObjectName});
			}
		})();
	`);

	// Navigate to first photo
	let firstPhoto = false;
	while (!firstPhoto) {
		firstPhoto = await webview.executeJavaScript(`
			(()=>{
				const focusedElement = document.activeElement;
				if (
					focusedElement &&
					focusedElement.tagName === 'A' &&
					focusedElement.href &&
					focusedElement.href.includes('/photo/')
				) {
					return focusedElement.outerHTML;
				}
				return false;
			})();
		`);

		if (!firstPhoto) {
			webview.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
			webview.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
			await new Promise(res => setTimeout(res, 200));
		}
	}

	// Open photo
	webview.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
	webview.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
	await new Promise(res => setTimeout(res, 500));

	// Focus info panel initially
	let infoPanel = await focusInfoPanel({ type: 'char', keyCode: 'i' }, true, 3, 750);

	if (infoPanel === false) {
		console.error('Info panel not found - stopping execution');
		return;
	}

	console.log('Info panel:', infoPanel);

	// Process photos in sequence
	const maxIterations = parseInt(maxPhotosInput.value) || 10;
	let keepGoing = true;
	let iterationCount = 0;

	while (keepGoing) {
		iterationCount++;
		console.log(`Processing photo ${iterationCount}/${maxIterations}`);

		// Extract photo metadata
		const photoInfo = await webview.executeJavaScript(`
			(()=>{
				let photoInfo = {
					details: [],
					location: null,
					photo: window.location.href.includes('/photo/') ? window.location.href : null
				};

				const panel = document.activeElement.closest(':has(dl)');
				if (panel) {
					panel.querySelectorAll('dl dd').forEach(n => photoInfo.details.push(n.innerText));

					const locationNode = panel.querySelector('[data-mapurl]');
					if (locationNode) {
						photoInfo.location = {
							url: locationNode.getAttribute('data-mapurl'),
						};
					}
				}
				return photoInfo;
			})();
		`);

		console.log('Photo info:', photoInfo);

		// Navigate to next photo
		webview.sendInputEvent({ type: 'char', keyCode: 'j' });
		await new Promise(res => setTimeout(res, 100));

		// Refocus info panel for next photo
		infoPanel = await focusInfoPanel([
			{ type: 'keyDown', keyCode: 'Tab' },
			{ type: 'keyUp', keyCode: 'Tab' }
		]);

		if (infoPanel === false) {
			console.error('Info panel not found - stopping execution');
			keepGoing = false;
			break;
		}

		if (iterationCount >= maxIterations) {
			console.log('Reached maximum iterations limit');
			keepGoing = false;
			break;
		}
	}
});

function drawDebugCircle(x, y, color = 'red', size = 50) {
	// Get webview position relative to the main app window
	const webviewRect = webview.getBoundingClientRect();

	// Calculate absolute position by adding webview offset
	const absoluteX = webviewRect.left + x;
	const absoluteY = webviewRect.top + y;

	// Create circle element in the main app window
	const circle = document.createElement('div');
	circle.style.position = 'fixed';
	circle.style.left = (absoluteX - size/2) + 'px';
	circle.style.top = (absoluteY - size/2) + 'px';
	circle.style.width = size + 'px';
	circle.style.height = size + 'px';
	circle.style.borderRadius = '50%';
	circle.style.border = `3px solid ${color}`;
	circle.style.backgroundColor = `rgba(255, 0, 0, 0.2)`;
	circle.style.zIndex = '9999';
	circle.style.pointerEvents = 'none';
	circle.className = 'phai-debug-circle';

	// Remove existing circles
	document.querySelectorAll('.phai-debug-circle').forEach(el => el.remove());

	// Add circle to the main app window
	document.body.appendChild(circle);

	console.log('Debug circle drawn at absolute coordinates:', { x: absoluteX, y: absoluteY });
	console.log('Webview position:', webviewRect);
	console.log('Element coordinates:', { x, y });

	return circle;
}

// Utility functions for image processing and hashing
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

async function getFocusedElementHTML() {
	return await webview.executeJavaScript(`
		(()=>{
			return document.activeElement.outerHTML;
		})();
	`);
}

async function sendMouseClick(x, y, button = 'left') {
	webview.sendInputEvent({
		type: 'mouseDown',
		x: Math.round(x),
		y: Math.round(y),
		button: button,
		clickCount: 1
	});
	webview.sendInputEvent({
		type: 'mouseUp',
		x: Math.round(x),
		y: Math.round(y),
		button: button,
		clickCount: 1
	});
}

async function focusInfoPanel(inputEvents, update = false, maxAttempts = 30, delayMs = 10) {
	let foundElement = false;
	let attempts = 0;

	const events = Array.isArray(inputEvents) ? inputEvents : [inputEvents];

	while (!foundElement && attempts < maxAttempts) {
		attempts++;

		for (const inputEvent of events) {
			webview.sendInputEvent(inputEvent);
		}
		await new Promise(res => setTimeout(res, delayMs));

		foundElement = await webview.executeJavaScript(`
			(()=>{
				const infoPanel = document.activeElement.closest(':has(dl)');
				if (
					infoPanel &&
					infoPanel.querySelectorAll('dl').length === 1
				) {
					if (${update ? 'true' : 'false'}) {
						const rect = infoPanel.getBoundingClientRect();
						window.${phaiObjectName}.infoPanel = {
							node: infoPanel,
							coordinates: {
								x: rect.left + rect.width / 2,
								y: rect.top + 5
							}
						};
					}
					return window.${phaiObjectName}.infoPanel;
				}
				return false;
			})();
		`);
	}

	return foundElement;
}