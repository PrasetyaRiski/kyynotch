const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');
const { createMainWindow, resizeWindow, getMainWindow } = require('./window');
const store = require('./store');
const mediaManager = require('./media');
const systemMonitor = require('./system/monitor');
const aiManager = require('./ai');

let tray = null;

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    setupIpc();
    createMainWindow();
    setupTray();
    setupShortcut();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupTray() {
  try {
    const iconPath = path.join(__dirname, '../renderer/assets/icon.png');
    tray = new Tray(iconPath);
    tray.setToolTip('Kyynotch — Dynamic Island');

    const updateContextMenu = () => {
      const openAtLogin = app.getLoginItemSettings().openAtLogin;
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Buka / Sembunyikan Kyynotch',
          click: () => {
            const win = getMainWindow();
            if (win) {
              if (win.isVisible()) win.hide();
              else win.show();
            }
          },
        },
        {
          label: 'Mulai Otomatis saat Login (Auto-start)',
          type: 'checkbox',
          checked: openAtLogin,
          click: (item) => {
            app.setLoginItemSettings({ openAtLogin: item.checked });
            updateContextMenu();
          },
        },
        { type: 'separator' },
        {
          label: 'Keluar',
          click: () => app.quit(),
        },
      ]);
      tray.setContextMenu(contextMenu);
    };

    updateContextMenu();
    tray.on('click', () => {
      const win = getMainWindow();
      if (win) {
        if (win.isVisible()) win.focus();
        else win.show();
      }
    });
  } catch (_) {
    // Tray optional
  }
}

function setupShortcut() {
  try {
    globalShortcut.register('CommandOrControl+Shift+N', () => {
      const win = getMainWindow();
      if (win) {
        win.webContents.send('toggle-notch');
      }
    });
  } catch (_) {}
}

function setupIpc() {
  // Window management
  ipcMain.on('window-resize', (_event, { width, height }) => {
    resizeWindow(width, height);
  });

  ipcMain.on('window-hide', () => {
    const win = getMainWindow();
    if (win) win.hide();
  });

  ipcMain.on('window-show', () => {
    const win = getMainWindow();
    if (win) win.show();
  });

  ipcMain.on('window-close', () => {
    app.quit();
  });

  // Autostart on boot
  ipcMain.handle('app-get-autostart', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('app-set-autostart', (_event, enable) => {
    app.setLoginItemSettings({ openAtLogin: enable });
    return app.getLoginItemSettings().openAtLogin;
  });

  // Store & Settings
  ipcMain.handle('store-get', (_event, key) => store.get(key));
  ipcMain.handle('store-set', (_event, key, val) => store.set(key, val));
  ipcMain.handle('store-get-all', () => store.getAll());
  ipcMain.handle('store-save-all', (_event, data) => store.saveAll(data));

  ipcMain.handle('store-get-notes', () => store.getNotes());
  ipcMain.handle('store-save-notes', (_event, notes) => store.saveNotes(notes));

  ipcMain.handle('store-get-pomo', () => store.getPomoStats());
  ipcMain.handle('store-log-pomo', (_event, session) => store.logPomoSession(session));

  // System Monitor
  ipcMain.handle('system-get-stats', async () => {
    return await systemMonitor.getStats();
  });

  // Media Player
  ipcMain.handle('media-poll', async () => {
    return await mediaManager.poll();
  });
  ipcMain.handle('media-play-pause', async () => {
    await mediaManager.playPause();
  });
  ipcMain.handle('media-next', async () => {
    await mediaManager.next();
  });
  ipcMain.handle('media-previous', async () => {
    await mediaManager.previous();
  });

  // AI Assistant (Universal Gemini / Ollama / OpenAI)
  ipcMain.handle('ai-ask', async (_event, params) => {
    return await aiManager.ask(params);
  });

  // Weather fetcher (wttr.in API)
  ipcMain.handle('weather-fetch', async (_event, { location, unit }) => {
    try {
      const loc = encodeURIComponent((location || '').trim());
      const u = unit === 'imperial' ? 'u' : 'm';
      const url = `https://wttr.in/${loc}?format=j1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'kyynotch/1.0' },
      });
      if (!res.ok) throw new Error(`Weather HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      throw new Error(`Cuaca tidak dapat diakses: ${e.message}`);
    }
  });
}
