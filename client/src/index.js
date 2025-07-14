/**
 * phAI - AI-powered Google Photos automation tool
 * Main process for the Electron application
 */

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const createWindow = () => {
	const mainWindow = new BrowserWindow({
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			webviewTag: true,
		},
		show: false,
		autoHideMenuBar: true
	});
	mainWindow.maximize();
	mainWindow.show();
	mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

// IPC Handlers
ipcMain.handle('download-image-with-session', async (event, url) => {
	return new Promise((resolve, reject) => {
		const session = event.sender.session;
		const { net } = require('electron');

		const request = net.request({
			method: 'GET',
			url: url,
			session: session
		});

		request.on('response', (response) => {
			const chunks = [];
			response.on('data', (chunk) => {
				chunks.push(chunk);
			});
			response.on('end', () => {
				const buffer = Buffer.concat(chunks);
				resolve(Array.from(buffer));
			});
			response.on('error', reject);
		});

		request.on('error', reject);
		request.end();
	});
});

ipcMain.handle('select-reference-image', async () => {
	const result = await dialog.showOpenDialog({
		title: 'Select Reference Image',
		filters: [
			{ name: 'JPEG Images', extensions: ['jpg', 'jpeg'] }
		],
		properties: ['openFile']
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	const filePath = result.filePaths[0];

	try {
		const fileBuffer = fs.readFileSync(filePath);
		const base64Data = fileBuffer.toString('base64');

		return {
			path: filePath,
			filename: path.basename(filePath),
			base64: base64Data
		};
	} catch (error) {
		console.error('Error reading file:', error);
		throw error;
	}
});

// Default Input Files Handlers
const defaultInputFiles = [
	{
		key: 'prompt',
		filename: 'prompt.txt',
		handler: () => {
			const promptPath = path.join(__dirname, 'prompt.txt');
			try {
				if (fs.existsSync(promptPath)) {
					return fs.readFileSync(promptPath, 'utf8').trim();
				}
				return null;
			} catch (err) {
				console.error('Error reading prompt.txt:', err);
				return null;
			}
		}
	},
	{
		key: 'reference-photo',
		filename: 'reference_photo.jpg',
		handler: () => {
			const photoPath = path.join(__dirname, 'reference_photo.jpg');
			try {
				if (fs.existsSync(photoPath)) {
					const base64 = fs.readFileSync(photoPath).toString('base64');
					return {
						path: photoPath,
						filename: path.basename(photoPath),
						base64
					};
				}
				return null;
			} catch (err) {
				console.error('Error reading reference_photo.jpg:', err);
				return null;
			}
		}
	}
];

defaultInputFiles.forEach(file => {
	ipcMain.handle(`read-${file.key}-file`, async () => file.handler());
});

// App Lifecycle
app.whenReady().then(() => {
	createWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});