import { onRequest } from "firebase-functions/v2/https";
import app from "./server.js";

// Exportamos la app express como una función de Firebase llamada 'api'
export const api = onRequest({
  memory: "256MiB",
  timeoutSeconds: 60,
  minInstances: 0,
  secrets: ["DATABASE_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "SMTP_PASS"] 
}, app);
