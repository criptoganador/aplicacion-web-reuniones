const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

let mainWindow;
let splashWindow;

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 400,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => (splashWindow = null));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "ASICME Meet",
    show: false, // Escondido hasta que esté listo
    titleBarStyle: "hidden", 
    titleBarOverlay: {
      color: "#000000",
      symbolColor: "#ffffff",
      height: 32,
    },
    backgroundColor: "#000000", // Fondo negro para evitar flash blanco
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
  });

  const startUrl = "https://app-frontend-z9ej.onrender.com";
  mainWindow.loadURL(startUrl);

  // ✨ Cuando la página esté lista, mostramos la principal y cerramos la splash
  mainWindow.once("ready-to-show", () => {
    if (splashWindow) {
      splashWindow.close();
    }
    mainWindow.show();
    mainWindow.maximize();
  });

  // Abrir enlaces externos en el navegador predeterminado
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  mainWindow.setMenuBarVisibility(false);
  
  // Crear menú contextual simple
  mainWindow.webContents.on("context-menu", (e, props) => {
    const { selectionText, isEditable } = props;
    const menuTemplate = [];

    if (selectionText) {
      menuTemplate.push({ label: "Copiar", role: "copy" });
    }
    if (isEditable) {
      menuTemplate.push({ label: "Pegar", role: "paste" });
    }
    
    menuTemplate.push({ type: "separator" });
    menuTemplate.push({ label: "Recargar", role: "reload" });
    menuTemplate.push({ label: "Inspeccionar", role: "toggleDevTools" });

    if (menuTemplate.length > 0) {
      const menu = Menu.buildFromTemplate(menuTemplate);
      menu.popup(mainWindow);
    }
  });
}

app.on("ready", () => {
  createSplashWindow();
  // Delay ligero para asegurar que la splash se vea bonita antes de cargar la web
  setTimeout(createWindow, 500);
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
