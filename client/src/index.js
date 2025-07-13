/**
 * phAI - AI-powered Google Photos automation tool
 * Main process for the Electron application
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

const createWindow = () => {
	// Create the browser window.
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

	// and load the index.html of the app.
	mainWindow.loadFile(path.join(__dirname, 'index.html'));
};

// Register IPC handlers before app.whenReady()
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