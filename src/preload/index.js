const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window control
  resizeWindow: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onToggleNotch: (callback) => {
    ipcRenderer.on('toggle-notch', () => callback());
  },

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
});
