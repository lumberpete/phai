// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose additional APIs for file operations
contextBridge.exposeInMainWorld('electronAPI', {
	saveImageFile: (filePath, buffer) => ipcRenderer.invoke('save-image-file', filePath, buffer),
	getImagesDir: () => ipcRenderer.invoke('get-images-dir'),
	downloadImageWithSession: (url) => ipcRenderer.invoke('download-image-with-session', url)
});