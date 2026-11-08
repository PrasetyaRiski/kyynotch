const { BrowserWindow, screen } = require('electron');
const path = require('path');
const store = require('./store');

let mainWindow = null;

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const bounds = primaryDisplay.bounds;

  const initialWidth = store.get('collapsedWidth') || 260;
  const initialHeight = store.get('collapsedHeight') || 34;
  const x = bounds.x + Math.round((bounds.width - initialWidth) / 2);
  const y = bounds.y;

  mainWindow = new BrowserWindow({
    width: initialWidth,
    height: initialHeight,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Re-center on display / resolution changes
  const recenter = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const currentBounds = mainWindow.getBounds();
    resizeWindow(currentBounds.width, currentBounds.height);
  };

  screen.on('display-metrics-changed', recenter);
  screen.on('display-added', recenter);
  screen.on('display-removed', recenter);

  return mainWindow;
}

function resizeWindow(width, height) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const bounds = primaryDisplay.bounds;

  const targetW = Math.round(width);
  const targetH = Math.round(height);
  const targetX = bounds.x + Math.round((bounds.width - targetW) / 2);
  const targetY = bounds.y;

  mainWindow.setBounds({
    x: targetX,
    y: targetY,
    width: targetW,
    height: targetH,
  });
}

function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createMainWindow,
  resizeWindow,
  getMainWindow,
};
