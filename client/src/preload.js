/**
 * phAI - AI-powered Google Photos automation tool
 * Preload script for secure IPC communication between main and renderer processes
 */

// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs for image processing operations
contextBridge.exposeInMainWorld('electronAPI', {
	downloadImageWithSession: (url) => ipcRenderer.invoke('download-image-with-session', url)
});