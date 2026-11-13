const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window control
  resizeWindow: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeWindow: () => ipcRenderer.send('window-close'),
  isPointerInside: (margin) => ipcRenderer.invoke('window-pointer-inside', margin),
  getPathForFile: (file) => {
    try { return webUtils.getPathForFile(file); } catch (_) { return ''; }
  },
  onToggleNotch: (callback) => {
    ipcRenderer.on('toggle-notch', () => callback());
  },

  // Drop Shelf
  shelfList: () => ipcRenderer.invoke('shelf-list'),
  shelfAdd: (paths) => ipcRenderer.invoke('shelf-add', paths),
  shelfRemove: (filePath) => ipcRenderer.invoke('shelf-remove', filePath),
  shelfClear: () => ipcRenderer.invoke('shelf-clear'),
  shelfReveal: (filePath) => ipcRenderer.invoke('shelf-reveal', filePath),
  shelfPick: () => ipcRenderer.invoke('shelf-pick'),

  // AI attachments
  attachFile: (filePath) => ipcRenderer.invoke('ai-attach-file', filePath),
  pickAttachment: () => ipcRenderer.invoke('ai-pick-file'),

  // Store & Settings
  getStore: (key) => ipcRenderer.invoke('store-get', key),
  setStore: (key, val) => ipcRenderer.invoke('store-set', key, val),
  getAllStore: () => ipcRenderer.invoke('store-get-all'),
  saveAllStore: (data) => ipcRenderer.invoke('store-save-all', data),

  // Notes
  getNotes: () => ipcRenderer.invoke('store-get-notes'),
  saveNotes: (notes) => ipcRenderer.invoke('store-save-notes', notes),

  // Pomodoro
  getPomoStats: () => ipcRenderer.invoke('store-get-pomo'),
  logPomoSession: (session) => ipcRenderer.invoke('store-log-pomo', session),

  // System Monitor
  getSystemStats: () => ipcRenderer.invoke('system-get-stats'),

  // Media Player
  pollMedia: () => ipcRenderer.invoke('media-poll'),
  mediaPlayPause: () => ipcRenderer.invoke('media-play-pause'),
  mediaNext: () => ipcRenderer.invoke('media-next'),
  mediaPrevious: () => ipcRenderer.invoke('media-previous'),

  // AI Assistant
  askAI: (params) => ipcRenderer.invoke('ai-ask', params),

  // Weather
  fetchWeather: (params) => ipcRenderer.invoke('weather-fetch', params),

  // Autostart
  getAutostart: () => ipcRenderer.invoke('app-get-autostart'),
  setAutostart: (enable) => ipcRenderer.invoke('app-set-autostart', enable),
});
