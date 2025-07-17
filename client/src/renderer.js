/**
 * phAI - AI-powered Google Photos automation tool
 * Main renderer process for the Electron application
 */

// DOM Elements
const scanButton = document.querySelector('#scan-button');
const webview = document.querySelector('webview');
const maxPhotosInput = document.querySelector('#max-photos');
const ollamaEndpointInput = document.querySelector('#ollama-endpoint');
const ollamaModelSelect = document.querySelector('#ollama-model');
const aiPromptInput = document.querySelector('#ai-prompt');
const infoPanel = document.querySelector('#info-panel');
const toggleBtn = document.querySelector('#toggle-panel');
const stopButton = document.querySelector('#stop-button');
const referenceImageBtn = document.querySelector('#reference-image-btn');
const clearListBtn = document.querySelector('#clear-list-btn');
const photoList = document.querySelector('#photo-details-list');

// State Variables
const phaiObjectName = 'phai_' + Math.random().toString(36).substring(2, 11);
let collectedPhotos = [];
let isProcessing = false;
let shouldStop = false;
let referenceImageData = null;

// Event Listeners
clearListBtn.addEventListener('click', () => {
	collectedPhotos = [];
	photoList.innerHTML = '';
	updateClearButtonVisibility();
});

toggleBtn.addEventListener('click', () => {
	infoPanel.classList.toggle('collapsed');
});

stopButton.addEventListener('click', () => {
	shouldStop = true;
	isProcessing = false;
	updateButtonStates(false);
});

referenceImageBtn.addEventListener('click', async () => {
	if (referenceImageData) {
		clearReferenceImage();
	} else {
		try {
			const imageData = await window.electronAPI.selectReferenceImage();
			if (imageData) {
				setReferenceImage(imageData);
			}
		} catch (error) {
			console.error('Error selecting reference image:', error);
			alert('Failed to select image. Please try again.');
		}
	}
});

// Initialization
async function loadDefaultInputs() {
	const inputFiles = [
		{
			key: 'prompt',
			api: 'readPromptFile',
			apply: (data) => {
				if (data) {
					console.log('Loaded prompt from prompt.txt file');
					aiPromptInput.value = data;
				}
			}
		},
		{
			key: 'referencePhoto',
			api: 'readReferencePhotoFile',
			apply: (data) => {
				if (data) {
					console.log('Loaded reference photo from reference_photo.jpg file');
					setReferenceImage(data);
				}
			}
		}
	];

	for (const file of inputFiles) {
		try {
			const result = await window.electronAPI[file.api]();
			file.apply(result);
		} catch (error) {
			console.error(`Error loading ${file.key} from default file:`, error);
		}
	}
}
loadDefaultInputs();

// Initialize UI state
updateClearButtonVisibility();

// Reference Image Functions
function setReferenceImage(imageData) {
	referenceImageData = imageData;
	referenceImageBtn.textContent = 'Clear image';
	referenceImageBtn.classList.add('selected');
}

function clearReferenceImage() {
	referenceImageData = null;
	referenceImageBtn.textContent = 'Select image';
	referenceImageBtn.classList.remove('selected');
}

// UI State Functions
function updateClearButtonVisibility() {
	if (collectedPhotos.length > 0) {
		clearListBtn.classList.remove('hidden');
	} else {
		clearListBtn.classList.add('hidden');
	}
}

function updateButtonStates(processing) {
	isProcessing = processing;
	if (processing) {
		scanButton.classList.add('hidden');
		stopButton.classList.remove('hidden');
		shouldStop = false;
	} else {
		scanButton.classList.remove('hidden');
		stopButton.classList.add('hidden');
	}
}

// AI Image Description
async function getImageDescription(base64Image) {
	try {
		const endpoint = ollamaEndpointInput.value.trim() || 'localhost:11434';
		const fullEndpoint = endpoint.startsWith('http') ? endpoint : `http://${endpoint}`;
		const apiUrl = `${fullEndpoint}/api/generate`;

		const selectedModel = ollamaModelSelect.value || 'llava:7b';
		const customPrompt = aiPromptInput.value.trim() || 'Describe this image in detail, including: the main subject(s), setting/location, colors, mood, and any visible text or writing (spell out exactly what it says). Note any interesting or unique elements.';

		const images = [base64Image];
		if (referenceImageData && referenceImageData.base64) {
			images.unshift(referenceImageData.base64);
		}

		const requestBody = {
			model: selectedModel,
			prompt: customPrompt,
			images: images,
			stream: false
		};

		// Save request body to tmp/request.json (pretty-printed)
		try {
			await window.electronAPI.saveRequestJson(JSON.stringify(requestBody, null, 2));
		} catch (err) {
			console.warn('Could not save request.json:', err);
		}

		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(requestBody)
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

// Display Photo Information
function displayPhotoInfo(photoInfo, photoNumber) {
	let skipDisplay = false;
	let jsonResult = null;

	if (photoInfo.image && photoInfo.image.description) {
		jsonResult = detectAndFormatJSON(photoInfo.image.description);
		if (jsonResult && jsonResult.isJson) {
			if (typeof jsonResult.json.include !== 'undefined' && jsonResult.json.include === false) {
				skipDisplay = true;
			}
		}
	}

	if (skipDisplay) return;

	collectedPhotos.push({ ...photoInfo, photoNumber });

	const photoItem = document.createElement('div');
	photoItem.className = 'photo-info-item';

	let html = `<h4>Photo ${photoNumber}</h4>`;

	const hasDetails = photoInfo.details && photoInfo.details.length > 0;
	const hasLocation = photoInfo.location && photoInfo.location.url;
	const hasImageMetadata = photoInfo.image && (photoInfo.image.photoId || (photoInfo.image.width && photoInfo.image.height));

	if (hasDetails || hasLocation || hasImageMetadata) {
		html += '<div class="photo-details">';
		html += '<div class="details-header" onclick="toggleDetails(this)">';
		html += '<span class="details-toggle">›</span>';
		html += '<span class="details-label">Filename, date, location and other details</span>';
		html += '</div>';
		html += '<div class="details-content">';
		html += '<table class="detail-table">';

		if (hasDetails) {
			photoInfo.details.forEach((detailGroup) => {
				Object.entries(detailGroup).forEach(([key, value]) => {
					const formattedValue = String(value).replace(/\n/g, '<br>');
					html += `<tr><td>${key}:</td><td>${formattedValue}</td></tr>`;
				});
			});
		}

		if (hasImageMetadata) {
			if (photoInfo.image.photoId) {
				html += `<tr><td>Photo ID:</td><td>${photoInfo.image.photoId}</td></tr>`;
			}
			if (photoInfo.image.width && photoInfo.image.height) {
				html += `<tr><td>Dimensions:</td><td>${photoInfo.image.width} × ${photoInfo.image.height}</td></tr>`;
			}
		}

		if (hasLocation) {
			html += `<tr><td>Location:</td><td><a href="${photoInfo.location.url}" target="_blank">View on Map</a></td></tr>`;
		}

		html += '</table></div></div>';
	}

	if (photoInfo.image) {
		html += '<div class="photo-image-info">';

		if (photoInfo.image.data64) {
			html += '<div class="photo-preview">';
			if (photoInfo.image.url) {
				html += `<a href="${photoInfo.image.url}" target="_blank" title="Click to view full image">`;
				html += `<img src="data:image/jpeg;base64,${photoInfo.image.data64}" alt="Photo ${photoNumber}" class="photo-thumbnail">`;
				html += `</a>`;
			} else {
				html += `<img src="data:image/jpeg;base64,${photoInfo.image.data64}" alt="Photo ${photoNumber}" class="photo-thumbnail">`;
			}
			html += '</div>';
		}

		if (photoInfo.image.description) {
			if (jsonResult && jsonResult.isJson) {
				html += '<div class="json-response">';
				html += '<strong>JSON Response:</strong>';
				html += '<pre class="json-content">' + JSON.stringify(jsonResult.json, null, 2) + '</pre>';
				html += '</div>';
			} else {
				html += '<div class="ai-description">';
				html += `<strong>AI Description:</strong> ${photoInfo.image.description}`;
				html += '</div>';
			}
		}

		html += '</div>';
	}

	photoItem.innerHTML = html;

	photoList.insertBefore(photoItem, photoList.firstChild);
	photoList.scrollTop = 0;
	updateClearButtonVisibility();
}

// Main Photo Processing
scanButton.addEventListener('click', async () => {
	if (!webview || isProcessing) return;

	isProcessing = true;
	updateButtonStates(true);

	try {
		await initializePhaiObject();
		await navigateToFirstPhoto();

		const infoPanel = await focusInfoPanel({ type: 'char', keyCode: 'i' }, true, 3, 750);
		if (!infoPanel) {
			console.error('Info panel not found - stopping execution');
			return;
		}

		await processPhotos();
	} catch (error) {
		console.error('Error during photo processing:', error);
	} finally {
		isProcessing = false;
		updateButtonStates(false);
	}
});

async function initializePhaiObject() {
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
}

async function navigateToFirstPhoto() {
	const currentUrl = await webview.executeJavaScript(`window.location.href`);
	if (currentUrl.includes('photos.google.com/photo/')) return;

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

	webview.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' });
	webview.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' });
	await new Promise(res => setTimeout(res, 500));
}

async function processPhotos() {
	const maxIterations = parseInt(maxPhotosInput.value) || 10;
	const maxLocationAttempts = 50;
	let iterationCount = 0;
	let currentLocation = await webview.executeJavaScript(`window.location.href`);

	while (iterationCount < maxIterations && !shouldStop) {
		iterationCount++;

		const photoInfo = await extractPhotoMetadata();

		if (photoInfo.image && photoInfo.image.url) {
			try {
				const imageBuffer = await loadImageInWebview(photoInfo.image.url);
				photoInfo.image.data64 = uint8ToBase64(imageBuffer);
				photoInfo.image.description = await getImageDescription(photoInfo.image.data64);
			} catch (error) {
				console.error('Failed to fetch image for base64 conversion:', error);
				photoInfo.image.data64 = null;
				photoInfo.image.description = 'Description unavailable due to image loading error';
			}
		}

		displayPhotoInfo(photoInfo, iterationCount);

		webview.sendInputEvent({ type: 'char', keyCode: 'j' });

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
			break;
		}

		const infoPanel = await focusInfoPanel([
			{ type: 'keyDown', keyCode: 'Tab' },
			{ type: 'keyUp', keyCode: 'Tab' }
		]);

		if (!infoPanel) {
			console.error('Info panel not found - stopping execution');
			break;
		}

		await new Promise(res => setTimeout(res, 500));
	}
}

async function extractPhotoMetadata() {
	return await webview.executeJavaScript(`
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
							url: null,
							width: parseInt(dataNode.getAttribute('data-width')),
							height: parseInt(dataNode.getAttribute('data-height')),
							photoId: photoId
						};

						const ratio = photoInfo.image.width / photoInfo.image.height;
						const randomPixels = Math.floor(Math.random() * 101);
						photoInfo.image.width += randomPixels;
						photoInfo.image.height = Math.floor(photoInfo.image.width / ratio);

						photoInfo.image.url =
							dataNode.getAttribute('data-url') +
							'=w' + photoInfo.image.width +
							'-h' + photoInfo.image.height +
							'-no?authuser=0';

						const img = new Image();
						img.src = photoInfo.image.url;
					}
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
}

// Utility Functions
function toggleDetails(headerElement) {
	const toggle = headerElement.querySelector('.details-toggle');
	const content = headerElement.nextElementSibling;

	if (content.classList.contains('expanded')) {
		content.classList.remove('expanded');
		toggle.textContent = '›';
	} else {
		content.classList.add('expanded');
		toggle.textContent = '‹';
	}
}

window.toggleDetails = toggleDetails;

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

function detectAndFormatJSON(text) {
	if (!text || typeof text !== 'string') return { isJson: false };

	try {
		const jsonMatch = text.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const jsonString = jsonMatch[0];
			const parsed = JSON.parse(jsonString);
			return {
				isJson: true,
				json: parsed
			};
		}
		return { isJson: false };
	} catch (error) {
		return { isJson: false };
	}
}

function uint8ToBase64(uint8Array) {
	let binary = '';
	const len = uint8Array.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(uint8Array[i]);
	}
	return btoa(binary);
}