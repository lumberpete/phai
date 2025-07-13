/**
 * phAI - AI-powered Google Photos automation tool
 * Main renderer process for the Electron application
 */

// DOM element selectors
const button = document.querySelector('[data-role="trigger"]');
const webview = document.querySelector('[data-role="webview"]');
const maxPhotosInput = document.querySelector('#max-photos');
const ollamaEndpointInput = document.querySelector('#ollama-endpoint');
const ollamaModelSelect = document.querySelector('#ollama-model');
const aiPromptInput = document.querySelector('#ai-prompt');
const infoPanel = document.querySelector('#info-panel');
const toggleBtn = document.querySelector('#toggle-panel');
const infoPanelContent = document.querySelector('.info-panel-content');
const scanButton = document.querySelector('#scan-button');
const stopButton = document.querySelector('#stop-button');

// Utilities
const phaiObjectName = 'phai_' + Math.random().toString(36).substring(2, 11);

// Application state
let collectedPhotos = [];
let isProcessing = false;
let shouldStop = false;

// Toggle panel functionality
toggleBtn.addEventListener('click', () => {
	infoPanel.classList.toggle('collapsed');
});

// Stop button functionality
stopButton.addEventListener('click', () => {
	shouldStop = true;
	updateButtonStates(false);
});

/**
 * Update button states during processing
 * @param {boolean} processing - Whether processing is active
 */
function updateButtonStates(processing) {
	isProcessing = processing;
	if (processing) {
		scanButton.style.display = 'none';
		stopButton.style.display = 'inline-block';
		shouldStop = false;
	} else {
		scanButton.style.display = 'inline-block';
		stopButton.style.display = 'none';
	}
}

/**
 * Get image description from Ollama llava model
 * @param {string} base64Image - Base64 encoded image data
 * @returns {Promise<string>} AI-generated image description
 */
async function getImageDescription(base64Image) {
	try {
		// Get the endpoint from the input field, with default fallback
		const endpoint = ollamaEndpointInput.value.trim() || 'localhost:11434';
		// Ensure endpoint has http:// prefix
		const fullEndpoint = endpoint.startsWith('http') ? endpoint : `http://${endpoint}`;
		const apiUrl = `${fullEndpoint}/api/generate`;

		// Get the selected model
		const selectedModel = ollamaModelSelect.value || 'llava:7b';

		// Get the custom prompt from the input field, with default fallback
		const customPrompt = aiPromptInput.value.trim() || 'Describe this image in detail, including: the main subject(s), setting/location, colors, mood, and any visible text or writing (spell out exactly what it says). Note any interesting or unique elements.';

		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				model: selectedModel,
				prompt: customPrompt,
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

/**
 * Display photo information in the info panel
 * @param {Object} photoInfo - Photo metadata and image data
 * @param {number} photoNumber - Sequential photo number
 */
function displayPhotoInfo(photoInfo, photoNumber) {
	// Add to collected photos
	collectedPhotos.push({ ...photoInfo, photoNumber });

	// Create photo info element
	const photoItem = document.createElement('div');
	photoItem.className = 'photo-info-item';

	let html = `<h4>Photo ${photoNumber}</h4>`;
	
	// Check what data is available
	const hasDetails = photoInfo.details && photoInfo.details.length > 0;
	const hasLocation = photoInfo.location && photoInfo.location.url;
	const hasImageMetadata = photoInfo.image && (photoInfo.image.photoId || (photoInfo.image.width && photoInfo.image.height));

	// Build collapsible details section if we have any metadata
	if (hasDetails || hasLocation || hasImageMetadata) {
		html += '<div class="photo-details">';
		html += '<div class="details-header" onclick="toggleDetails(this)">';
		html += '<span class="details-toggle">›</span>';
		html += '<span class="details-label">Filename, date, location and other details</span>';
		html += '</div>';
		html += '<div class="details-content">';
		html += '<table class="detail-table">';

		// Add Google Photos metadata
		if (hasDetails) {
			photoInfo.details.forEach((detailGroup) => {
				Object.entries(detailGroup).forEach(([key, value]) => {
					const formattedValue = String(value).replace(/\n/g, '<br>');
					html += `<tr><td>${key}:</td><td>${formattedValue}</td></tr>`;
				});
			});
		}

		// Add image technical metadata
		if (hasImageMetadata) {
			if (photoInfo.image.photoId) {
				html += `<tr><td>Photo ID:</td><td>${photoInfo.image.photoId}</td></tr>`;
			}
			if (photoInfo.image.width && photoInfo.image.height) {
				html += `<tr><td>Dimensions:</td><td>${photoInfo.image.width} × ${photoInfo.image.height}</td></tr>`;
			}
		}

		// Add location information
		if (hasLocation) {
			html += `<tr><td>Location:</td><td><a href="${photoInfo.location.url}" target="_blank">View on Map</a></td></tr>`;
		}

		html += '</table>';
		html += '</div>';
		html += '</div>';
	}

	// Display image info
	if (photoInfo.image) {
		html += '<div class="photo-image-info">';

		// Display the image if base64 data is available (make it clickable to view full image)
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

		// Display AI description if available
		if (photoInfo.image.description) {
			html += '<div class="ai-description">';
			html += `<strong>AI Description:</strong> ${photoInfo.image.description}`;
			html += '</div>';
		}

		html += '</div>';
	}

	photoItem.innerHTML = html;

	// Remove "no data" message if it exists
	const noDataMsg = infoPanelContent.querySelector('.no-data');
	if (noDataMsg) {
		noDataMsg.remove();
	}

	// Add to panel (newest at top)
	infoPanelContent.insertBefore(photoItem, infoPanelContent.firstChild);

	// Scroll to top to show newest item
	infoPanelContent.scrollTop = 0;
}

button.addEventListener('click', async (e) => {
	if (!webview || isProcessing) return;

	// Update UI to show processing state
	updateButtonStates(true);

	try {

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

	// Check if the current webview location is a Google Photos photo URL
	const currentUrl = await webview.executeJavaScript(`window.location.href`);
	if (!currentUrl.includes('photos.google.com/photo/')) {

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

	}

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

	while (keepGoing && !shouldStop) {
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

		// Check if user requested stop
		if (shouldStop) {
			console.log('Processing stopped by user');
			break;
		}
	}

	} catch (error) {
		console.error('Error during photo processing:', error);
	} finally {
		// Reset UI state when processing is complete
		updateButtonStates(false);
	}
});

/**
 * Toggles the visibility of collapsible details sections
 * @param {HTMLElement} headerElement - The header element that was clicked
 */
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

// Make function globally available for onclick handlers
window.toggleDetails = toggleDetails;

/**
 * Loads an image from a URL using the webview session
 * @param {string} url - The URL of the image to load
 * @returns {Promise<Uint8Array>} The image data as a Uint8Array
 * @throws {Error} If the image cannot be loaded
 */
async function loadImageInWebview(url) {
	try {
		const result = await window.electronAPI.downloadImageWithSession(url);
		return new Uint8Array(result);
	} catch (error) {
		console.error('Image load error:', error);
		throw error;
	}
}

/**
 * Gets the HTML of the currently focused element in the webview
 * @returns {Promise<string>} The outerHTML of the focused element
 */
async function getFocusedElementHTML() {
	return await webview.executeJavaScript(`
		(()=>{
			return document.activeElement.outerHTML;
		})();
	`);
}

/**
 * Sends a mouse click event to the webview at specified coordinates
 * @param {number} x - X coordinate for the click
 * @param {number} y - Y coordinate for the click
 * @param {string} button - Mouse button to click ('left', 'right', 'middle')
 */
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

/**
 * Focuses on the information panel in Google Photos by sending input events
 * @param {Object|Array} inputEvents - Input event(s) to send to focus the panel
 * @param {boolean} update - Whether to update the stored panel coordinates
 * @param {number} maxAttempts - Maximum number of attempts to find the panel
 * @param {number} delayMs - Delay between attempts in milliseconds
 * @returns {Promise<boolean|Object>} The info panel object if found, false otherwise
 */
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