const { app, BrowserWindow, ipcMain, desktopCapturer } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'ASICME Conferencia',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#202124',
      symbolColor: '#ffffff',
      height: 32
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadURL(process.env.ELECTRON_START_URL || 'https://app-frontend-z9ej.onrender.com');

  // Multi-platform screen sharing support
  ipcMain.handle('get-sources', async () => {
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
    return sources.map(source => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  });
});

app.on('window-all-closed', () => app.quit());

