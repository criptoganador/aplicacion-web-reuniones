const { contextBridge, ipcRenderer } = require("electron");

// Exponer funciones seguras al frontend
contextBridge.exposeInMainWorld("electron", {
  send: (channel, data) => {
    // Lista blanca de canales permitidos
    let validChannels = ["toMain"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ["fromMain"];
    if (validChannels.includes(channel)) {
      // Deliberadamente quitar el evento ya que es un riesgo de seguridad
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
