const { app, BrowserWindow } = require('electron');
const path = require('path');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'ASICME Meet',
    icon: path.join(__dirname, '..', 'public', 'favicon.png'),
    autoHideMenuBar: true,
  });
  win.loadURL('https://app-frontend-z9ej.onrender.com');
});

app.on('window-all-closed', () => app.quit());
