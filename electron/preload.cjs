const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al proceso de renderizado (React)
contextBridge.exposeInMainWorld('electron', {
  windowControls: {
    minimize: () => ipcRenderer.send('window-minimize'),
    maximize: () => ipcRenderer.send('window-maximize'),
    close: () => ipcRenderer.send('window-close'),
    resize: (width, height) => ipcRenderer.send('resize-app', width, height)
  }
});

console.log('--- [ELECTRON] Preload script cargado exitosamente ---');
