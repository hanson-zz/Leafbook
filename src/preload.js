'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('leafbookAPI', {
  readPageFlip: () => ipcRenderer.invoke('read-pageflip'),
  importImages: () => ipcRenderer.invoke('import-images'),
  importPDF: () => ipcRenderer.invoke('import-pdf'),
  importMusic: () => ipcRenderer.invoke('import-music'),
  importBackground: () => ipcRenderer.invoke('import-background'),
  openProject: () => ipcRenderer.invoke('open-project'),
  saveProject: (project, defaultName) => ipcRenderer.invoke('save-project', { project, defaultName }),
  exportHTML: (html, defaultName) => ipcRenderer.invoke('export-html', { html, defaultName })
});
