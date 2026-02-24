const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Silenciar advertencias de seguridad en consola
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

console.log('--- [ELECTRON] Cargando contenedor de ASICME Conferencias ---');
console.log('--- [DEBUG] Cargando main.cjs v1.0.1 ---');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    icon: path.join(__dirname, 'icon.png'),
  });

  // Manejadores de control de ventana
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => mainWindow.close());
  ipcMain.on('resize-app', (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setSize(width, height);
      win.center();
    }
  });

  const isDev = !app.isPackaged;
  
  // Cargamos la URL del servidor Render
  mainWindow.loadURL('https://app-frontend-z9ej.onrender.com');

  // Detectar errores de carga
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`--- [ERROR] Falló la carga: ${errorCode} - ${errorDescription} ---`);
    console.error(`--- [URL] Intentada: ${validatedURL} ---`);
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.setMenu(null);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
