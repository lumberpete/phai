const button = document.querySelector('[data-role="trigger"]');
const webview = document.querySelector('[data-role="webview"]');
const maxPhotosInput = document.querySelector('#max-photos');
const infoPanel = document.querySelector('#info-panel');
const toggleBtn = document.querySelector('#toggle-panel');
const infoPanelContent = document.querySelector('.info-panel-content');

const encoder = new TextEncoder();

const phaiObjectName = 'phai_' + Math.random().toString(36).substring(2, 11);

// Toggle panel functionality
toggleBtn.addEventListener('click', () => {
	infoPanel.classList.toggle('collapsed');
});

// Store collected photo data
let collectedPhotos = [];

// Function to get image description from Ollama llava model
async function getImageDescription(base64Image) {
	try {
		const response = await fetch('http://localhost:11434/api/generate', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: 'llava:7b',
				prompt: 'Describe this image briefly in 1-2 sentences.',
				images: [base64Image],
				stream: false
			})
		});

		if (!response.ok) {
			throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
		}

		const data = await response.json();
		return data.response || 'No description available';
	} catch (error) {
		console.error('Failed to get image description from Ollama:', error);
		return 'Description unavailable';
	}
}

function displayPhotoInfo(photoInfo, photoNumber) {
	// Add to collected photos
	collectedPhotos.push({ ...photoInfo, photoNumber });

	// Create photo info element
	const photoItem = document.createElement('div');
	photoItem.className = 'photo-info-item';

	let html = `<h4>Photo ${photoNumber}</h4>`;

	// Display details
	if (photoInfo.details && photoInfo.details.length > 0) {
		html += '<div class="photo-details">';
		photoInfo.details.forEach((detailGroup, groupIndex) => {
			html += `<div class="detail-group">`;
			Object.entries(detailGroup).forEach(([key, value]) => {
				const formattedValue = String(value).replace(/\n/g, '<br>');
				html += `<div class="detail-item"><strong>${key}:</strong> ${formattedValue}</div>`;
			});
			html += `</div>`;
		});
		html += '</div>';
	}

	// Display location
	if (photoInfo.location && photoInfo.location.url) {
		html += '<div class="photo-location">';
		html += '<strong>Location:</strong><br>';
		html += `<a href="${photoInfo.location.url}" target="_blank">View on Map</a>`;
		html += '</div>';
	}

	// Display image info
	if (photoInfo.image) {
		html += '<div class="photo-image-info">';
		html += '<strong>Image Info:</strong><br>';

		// Display AI description if available
		if (photoInfo.image.description) {
			html += '<div class="ai-description">';
			html += `<strong>AI Description:</strong> ${photoInfo.image.description}`;
			html += '</div>';
		}

		// Display the image if base64 data is available
		if (photoInfo.image.data64) {
			html += '<div class="photo-preview">';
			html += `<img src="data:image/jpeg;base64,${photoInfo.image.data64}" alt="Photo ${photoNumber}" class="photo-thumbnail">`;
			html += '</div>';
		}

		html += `<div class="info-row"><span>Dimensions:</span><span>${photoInfo.image.width} × ${photoInfo.image.height}</span></div>`;
		html += `<div class="info-row"><span>Photo ID:</span><span>${photoInfo.image.photoId}</span></div>`;
		if (photoInfo.image.url) {
			html += `<div class="info-row"><span>URL:</span><span><a href="${photoInfo.image.url}" target="_blank">View Image</a></span></div>`;
		}
		html += '</div>';
	}

	photoItem.innerHTML = html;

	// Check if user was already scrolled near the bottom before adding new item
	const wasScrolledToBottom = infoPanelContent.scrollTop >= infoPanelContent.scrollHeight - infoPanelContent.clientHeight - 50;

	// Remove "no data" message if it exists
	const noDataMsg = infoPanelContent.querySelector('.no-data');
	if (noDataMsg) {
		noDataMsg.remove();
	}

	// Add to panel (newest at bottom)
	infoPanelContent.appendChild(photoItem);

	// Only scroll to bottom if user was already at or near the bottom
	if (wasScrolledToBottom) {
		infoPanelContent.scrollTop = infoPanelContent.scrollHeight;
	}
}

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

	// Process photos in sequence
	const maxIterations = parseInt(maxPhotosInput.value) || 10;
	const maxLocationAttempts = 50;
	let keepGoing = true;
	let iterationCount = 0;

	// Get initial window location to track changes
	let currentLocation = await webview.executeJavaScript(`window.location.href`);

	while (keepGoing) {
		iterationCount++;

		// Extract photo metadata
		const photoInfo = await webview.executeJavaScript(`
			(()=>{
				let photoInfo = {
					details: [],
					location: null,
					image: null
				};

				const panel = document.activeElement.closest(':has(dl)');
				if (panel) {
					const photoId = (window.location.pathname.match(/\\/photo\\/([^\\/]+)/) || [false]).pop();
					if (photoId) {
						const dataNode = document.querySelector('[data-p*="' + photoId + '"][data-width][data-height][data-url]');
						if (dataNode) {
							photoInfo.image = {
								url: dataNode.getAttribute('data-url'),
								width: parseInt(dataNode.getAttribute('data-width')),
								height: parseInt(dataNode.getAttribute('data-height')),
								photoId: photoId
							};
						}
						const img = new Image();
						img.src = dataNode.getAttribute('data-url');
					}

					panel.querySelectorAll('dl dd').forEach((detailNode) => {
						let details = {};
						Array.from(detailNode.children).forEach((child, childIndex) => {
							if (child.children.length > 0) {
								Array.from(child.children).forEach((grandchild, grandchildIndex) => {
									let label = grandchild.getAttribute('aria-label');
									if (label) {
										label = label.split(':')[0].trim();
									} else {
										label = 'detail-' + childIndex + '-' + grandchildIndex;
									}
									details[label] = grandchild.innerText.trim();
								});
							} else {
								let label = child.getAttribute('aria-label');
								if (label) {
									label = label.split(':')[0].trim();
								} else {
									label = 'detail-' + childIndex;
								}
								details[label] = child.innerText.trim();
							}
						});
						photoInfo.details.push(details);
					});

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

		// Add base64 image data if image URL exists
		if (photoInfo.image && photoInfo.image.url) {
			try {
				const imageBuffer = await loadImageInWebview(photoInfo.image.url);
				photoInfo.image.data64 = btoa(String.fromCharCode.apply(null, imageBuffer));

				// Get AI description using Ollama
				photoInfo.image.description = await getImageDescription(photoInfo.image.data64);
			} catch (error) {
				console.error('Failed to fetch image for base64 conversion:', error);
				photoInfo.image.data64 = null;
				photoInfo.image.description = 'Description unavailable due to image loading error';
			}
		}

		// Display photo info in the panel
		displayPhotoInfo(photoInfo, iterationCount);

		// Navigate to next photo
		webview.sendInputEvent({ type: 'char', keyCode: 'j' });

		// Wait for location to change
		let locationAttempts = 0;
		let newLocation = await webview.executeJavaScript(`window.location.href`);

		while (newLocation === currentLocation && locationAttempts < maxLocationAttempts) {
			await new Promise(res => setTimeout(res, 100));
			locationAttempts++;
			newLocation = await webview.executeJavaScript(`window.location.href`);
		}

		if (newLocation !== currentLocation) {
			currentLocation = newLocation;
		} else {
			console.warn('Location did not change after navigation attempt');
			keepGoing = false;
			break;
		}

		// Refocus info panel for next photo
		infoPanel = await focusInfoPanel([
			{ type: 'keyDown', keyCode: 'Tab' },
			{ type: 'keyUp', keyCode: 'Tab' }
		]);

		if (infoPanel === false) {
			console.error('Info panel not found - stopping execution');
			keepGoing = false;
			break;
		} else {
			await new Promise(res => setTimeout(res, 500));
		}

		if (iterationCount >= maxIterations) {
			keepGoing = false;
			break;
		}
	}
});

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

async function focusInfoPanel(inputEvents, update = false, maxAttempts = 200, delayMs = 10) {
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