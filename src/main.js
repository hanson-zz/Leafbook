'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav'
};

function fileToDataUrl(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  return 'data:' + mime + ';base64,' + fs.readFileSync(filePath).toString('base64');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 1024, minHeight: 640,
    title: 'Leafbook 叶书制作器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  return win;
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// 读取内置 StPageFlip 源码（导出 H5 时内嵌）
ipcMain.handle('read-pageflip', () => {
  return fs.readFileSync(path.join(__dirname, '..', 'vendor', 'page-flip.browser.min.js'), 'utf8');
});

// 导入图片（多选，按文件名排序）
ipcMain.handle('import-images', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '选择页面图片（可多选）',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (r.canceled) return [];
  return r.filePaths
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), 'zh-CN', { numeric: true }))
    .map(p => ({ name: path.basename(p), dataUrl: fileToDataUrl(p) }));
});

// 导入 PDF（单选，返回 dataURL，页面栅格化在渲染进程用 pdf.js 完成）
ipcMain.handle('import-pdf', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '选择 PDF 文件（每页转成一页）',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), dataUrl: 'data:application/pdf;base64,' + fs.readFileSync(p).toString('base64') };
});

// 导入阅读背景图（单选，JPG/PNG/WebP）
ipcMain.handle('import-background', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '选择阅读背景图',
    properties: ['openFile'],
    filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), dataUrl: fileToDataUrl(p) };
});

// 导入音乐（单选）
ipcMain.handle('import-music', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '选择背景音乐',
    properties: ['openFile'],
    filters: [{ name: '音频', extensions: ['mp3', 'm4a', 'wav'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const p = r.filePaths[0];
  return { name: path.basename(p), dataUrl: fileToDataUrl(p) };
});

// 打开项目 .leafbook
ipcMain.handle('open-project', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, {
    title: '打开 Leafbook 项目',
    properties: ['openFile'],
    filters: [{ name: 'Leafbook 项目', extensions: ['leafbook'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const text = fs.readFileSync(r.filePaths[0], 'utf8');
  return { path: r.filePaths[0], project: JSON.parse(text) };
});

// 保存项目 .leafbook
ipcMain.handle('save-project', async (e, { project, defaultName }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    title: '保存 Leafbook 项目',
    defaultPath: (defaultName || '我的电子书') + '.leafbook',
    filters: [{ name: 'Leafbook 项目', extensions: ['leafbook'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, JSON.stringify(project, null, 1), 'utf8');
  return r.filePath;
});

// 导出 H5 单文件
ipcMain.handle('export-html', async (e, { html, defaultName }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, {
    title: '导出微信 H5 电子书',
    defaultPath: (defaultName || '我的电子书') + '.html',
    filters: [{ name: 'HTML 网页', extensions: ['html'] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, html, 'utf8');
  return r.filePath;
});
