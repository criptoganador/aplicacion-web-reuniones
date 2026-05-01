const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

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

  // Buscar actualizaciones automáticamente si la app está empaquetada
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

// Eventos del Auto-Updater
autoUpdater.on('update-available', () => {
  console.log('--- [AUTO-UPDATER] Actualización encontrada. Descargando de fondo... ---');
});

autoUpdater.on('update-downloaded', () => {
  console.log('--- [AUTO-UPDATER] Descarga completada. Lanzando ventana obligatoria... ---');
  
  const dialogOpts = {
    type: 'info',
    buttons: ['Actualizar Ahora'], // Solo hay un botón
    title: 'Actualización Obligatoria',
    message: 'Nueva actualización de ASICME Conferencias.',
    detail: 'Se ha descargado una nueva versión obligatoria. La aplicación se reiniciará para instalarla al presionar el botón.',
    noLink: true
  };

  dialog.showMessageBox(dialogOpts).then(() => {
    // Cuando presiona el botón o intenta cerrar el cuadro, forzamos la instalación
    autoUpdater.quitAndInstall();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
