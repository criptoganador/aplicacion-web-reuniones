import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let backendProcess = null;
let frontendProcess = null;

const FRONTEND_URL = "http://localhost:5173";
const BACKEND_URL = "http://localhost:4000";

// Función para verificar si un servidor está listo
function waitForServer(url, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkServer = () => {
      attempts++;
      http
        .get(url, (res) => {
          resolve(true);
        })
        .on("error", () => {
          if (attempts >= maxAttempts) {
            reject(
              new Error(
                `Servidor no disponible en ${url} después de ${maxAttempts} intentos`,
              ),
            );
          } else {
            setTimeout(checkServer, 1000);
          }
        });
    };
    checkServer();
  });
}

// Iniciar el servidor backend
function startBackend() {
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(__dirname, "..");
    const backendPath = path.join(projectRoot, "backend");

    console.log("🚀 Iniciando servidor backend...");

    backendProcess = spawn("node", ["server.js"], {
      cwd: backendPath,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`[Backend] ${data.toString()}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`[Backend Error] ${data.toString()}`);
    });

    backendProcess.on("error", (error) => {
      console.error("Error al iniciar backend:", error);
      reject(error);
    });

    // Esperar a que el servidor esté listo
    waitForServer(BACKEND_URL)
      .then(() => {
        console.log("✅ Backend listo en", BACKEND_URL);
        resolve();
      })
      .catch(reject);
  });
}

// Iniciar el servidor frontend (Vite)
function startFrontend() {
  return new Promise((resolve, reject) => {
    const projectRoot = path.join(__dirname, "..");

    console.log("🚀 Iniciando servidor frontend (Vite)...");

    frontendProcess = spawn("npm", ["run", "dev"], {
      cwd: projectRoot,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    frontendProcess.stdout.on("data", (data) => {
      console.log(`[Frontend] ${data.toString()}`);
    });

    frontendProcess.stderr.on("data", (data) => {
      console.error(`[Frontend Error] ${data.toString()}`);
    });

    frontendProcess.on("error", (error) => {
      console.error("Error al iniciar frontend:", error);
      reject(error);
    });

    // Esperar a que Vite esté listo
    waitForServer(FRONTEND_URL)
      .then(() => {
        console.log("✅ Frontend listo en", FRONTEND_URL);
        resolve();
      })
      .catch(reject);
  });
}

// Terminar todos los procesos hijos
function killChildProcesses() {
  if (backendProcess) {
    console.log("🛑 Deteniendo servidor backend...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", backendProcess.pid, "/f", "/t"]);
    } else {
      backendProcess.kill("SIGTERM");
    }
    backendProcess = null;
  }

  if (frontendProcess) {
    console.log("🛑 Deteniendo servidor frontend...");
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", frontendProcess.pid, "/f", "/t"]);
    } else {
      frontendProcess.kill("SIGTERM");
    }
    frontendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    frame: false, // 🖼️ Sin bordes nativos
    titleBarStyle: "hidden", // Ocultar barra de título nativa
    transparent: true, // ✨ Habilitar transparencias (clave para bordes redondos)
    backgroundColor: "#00000000", // Fondo totalmente transparente
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    show: false, // No mostrar hasta que todo esté listo
    backgroundColor: "#000000", // Evitar flash blanco
  });

  // 🚫 Eliminar la barra de menú predeterminada (File, Edit, View...)
  mainWindow.setMenu(null);

  mainWindow.loadURL(FRONTEND_URL);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  // 🎮 IPC Listeners para controlar la ventana desde React
  ipcMain.on("window-minimize", () => mainWindow.minimize());
  ipcMain.on("window-maximize", () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on("window-close", () => mainWindow.close());

  // 📐 IPC para redimensionar (Custom Resizer)
  ipcMain.on(
    "window-resize",
    (event, { width, height, direction, deltaX, deltaY }) => {
      if (mainWindow) {
        // Método robusto: usar setBounds
        // Nota: setBounds puede ser pesado si se llama en cada pixel, pero es lo más seguro.
        const currentBounds = mainWindow.getBounds();

        let newBounds = { ...currentBounds };

        // Aplicar deltas según dirección
        if (direction.includes("e"))
          newBounds.width = currentBounds.width + deltaX;
        if (direction.includes("s"))
          newBounds.height = currentBounds.height + deltaY;

        // Para direcciones norte/oeste necesitamos mover la ventana también
        if (direction.includes("n")) {
          newBounds.height = currentBounds.height - deltaY;
          newBounds.y = currentBounds.y + deltaY;
        }
        if (direction.includes("w")) {
          newBounds.width = currentBounds.width - deltaX;
          newBounds.x = currentBounds.x + deltaX;
        }

        // Evitar errores de tamaño mínimo
        if (newBounds.width < 800) newBounds.width = 800;
        if (newBounds.height < 600) newBounds.height = 600;

        mainWindow.setBounds(newBounds);
      }
    },
  );
}

// Iniciar todo cuando Electron esté listo
app.on("ready", async () => {
  try {
    console.log("🎬 Iniciando ASICME Meet...");

    // Iniciar backend primero
    await startBackend();

    // Luego iniciar frontend
    await startFrontend();

    // Finalmente crear la ventana
    createWindow();

    console.log("✨ ASICME Meet iniciado correctamente");
  } catch (error) {
    console.error("❌ Error al iniciar la aplicación:", error);
    killChildProcesses();
    app.quit();
  }
});

app.on("window-all-closed", function () {
  killChildProcesses();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killChildProcesses();
});

app.on("activate", function () {
  if (mainWindow === null) {
    createWindow();
  }
});
