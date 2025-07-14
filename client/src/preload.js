/**
 * phAI - AI-powered Google Photos automation tool
 * Preload script for secure IPC communication between main and renderer processes
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	downloadImageWithSession: (url) => ipcRenderer.invoke('download-image-with-session', url),
	selectReferenceImage: () => ipcRenderer.invoke('select-reference-image'),
	readPromptFile: () => ipcRenderer.invoke('read-prompt-file'),
	readReferencePhotoFile: () => ipcRenderer.invoke('read-reference-photo-file')
});