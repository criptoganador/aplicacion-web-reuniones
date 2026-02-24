const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getSources: () => ipcRenderer.invoke('get-sources'),
  isElectron: true
});
