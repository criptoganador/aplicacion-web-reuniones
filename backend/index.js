import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Importa aquí tu app o tus rutas, asegúrate que la ruta sea correcta
// Si tu lógica está en server.js, impórtalo:
import app from "./server.js"; 

dotenv.config();

// Configuración básica si no viene de server.js
// const app = express(); 

const PORT = process.env.PORT || 4000;

// 1. Permitir CORS (Vital para que Vercel entre)
app.use(cors({
  origin: process.env.FRONTEND_URL || '*', // Usa la variable o permite todo si falla
  credentials: true
}));

app.use(express.json());

// 2. Arrancar el servidor (ESTO ES LO QUE TE FALTA)
app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
  console.log(`🔗 Aceptando conexiones de: ${process.env.FRONTEND_URL}`);
});