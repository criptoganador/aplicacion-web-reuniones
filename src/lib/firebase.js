import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Configuración de Firebase obtenida de las variables de entorno para seguridad
const firebaseConfig = {
  apiKey: "AIzaSyC3OB49xRlIudBLesYJEFMidYwkFOhxVWs",
  authDomain: "video-confrerncia.firebaseapp.com",
  projectId: "video-confrerncia",
  storageBucket: "video-confrerncia.firebasestorage.app",
  messagingSenderId: "729069372557",
  appId: "1:729069372557:web:d2ab792603c7e0e0e50ec4",
  measurementId: "G-6L9DC23M68",
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;

export { app, analytics };
export default app;
