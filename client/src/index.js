const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const createWindow = () => {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			webviewTag: true,
		},
		show: false
	});
	// mainWindow.maximize();
	mainWindow.show();

	// and load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'index.html'));

	// Open the DevTools.
	mainWindow.webContents.openDevTools();

	// Auto-open webview devtools on webview reload, closing any existing webview devtools windows first
	mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
		webContents.on('did-finish-load', async () => {
			// Close any existing devtools for this webview
			if (webContents.isDevToolsOpened()) {
				webContents.closeDevTools();
			}
			webContents.openDevTools();
		});
	});
};

const imagesDir = path.resolve(__dirname, '../../../images');
if (!fs.existsSync(imagesDir)) {
	fs.mkdirSync(imagesDir, { recursive: true });
}

let fileTypePromise; // cache for file-type import

async function saveImageFile(filePath, buffer) {
	try {
		fs.writeFileSync(filePath, buffer);
		console.log(`Saved: ${filePath}`);

		// Check file type after saving
		if (!fileTypePromise) {
			fileTypePromise = import('file-type');
		}
		const { fileTypeFromBuffer } = await fileTypePromise;
		const type = await fileTypeFromBuffer(buffer);
		console.log(type);

		if (type && type.ext) {
			const filePathWithExt = filePath + '.' + type.ext;
			fs.renameSync(filePath, filePathWithExt);
			console.log(`Updated: ${filePathWithExt}`);
			return filePathWithExt;
		} else {
			console.log(`Updated (unknown type): ${filePath}`);
			return filePath;
		}
	} catch (err) {
		console.error('File save error:', err);
		throw err;
	}
}

// Register IPC handlers before app.whenReady()
ipcMain.handle('save-image-file', async (event, filePath, buffer) => {
	return saveImageFile(filePath, Buffer.from(buffer));
});

ipcMain.handle('get-images-dir', () => {
	return imagesDir;
});

ipcMain.handle('download-image-with-session', async (event, url) => {
	return new Promise((resolve, reject) => {
		// Get the webview's session from the sender
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

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
	createWindow();

	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) {
			createWindow();
		}
	});
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.